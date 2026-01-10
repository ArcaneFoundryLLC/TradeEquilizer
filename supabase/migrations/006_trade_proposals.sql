-- Trade Proposals Migration
-- Implements real-time trade proposal system with conflict detection

-- Trade proposals table
CREATE TABLE trade_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES trade_sessions(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Proposal content
  proposer_items JSONB NOT NULL DEFAULT '[]', -- Array of {item_id, quantity, condition, language, finish}
  recipient_items JSONB NOT NULL DEFAULT '[]', -- Array of {item_id, quantity, condition, language, finish}
  
  -- Pricing and fairness
  proposer_total_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  recipient_total_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  fairness_percentage DECIMAL(5,2) NOT NULL DEFAULT 0, -- Calculated fairness difference
  price_version VARCHAR(50) NOT NULL DEFAULT 'current', -- Price snapshot version
  
  -- Status and timestamps
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  message TEXT, -- Optional message from proposer
  rejection_reason TEXT, -- Optional reason for rejection
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'), -- Proposals expire in 10 minutes
  responded_at TIMESTAMPTZ, -- When recipient responded
  
  -- Constraints
  CONSTRAINT valid_participants CHECK (proposer_id != recipient_id),
  CONSTRAINT valid_items CHECK (
    jsonb_array_length(proposer_items) > 0 OR 
    jsonb_array_length(recipient_items) > 0
  ),
  CONSTRAINT valid_values CHECK (
    proposer_total_value >= 0 AND 
    recipient_total_value >= 0
  )
);

-- Indexes for performance
CREATE INDEX idx_trade_proposals_session_id ON trade_proposals(session_id);
CREATE INDEX idx_trade_proposals_proposer_id ON trade_proposals(proposer_id);
CREATE INDEX idx_trade_proposals_recipient_id ON trade_proposals(recipient_id);
CREATE INDEX idx_trade_proposals_status ON trade_proposals(status);
CREATE INDEX idx_trade_proposals_expires_at ON trade_proposals(expires_at);
CREATE INDEX idx_trade_proposals_created_at ON trade_proposals(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_trade_proposals_session_status ON trade_proposals(session_id, status);
CREATE INDEX idx_trade_proposals_recipient_status ON trade_proposals(recipient_id, status);

-- Item reservations table for conflict detection
CREATE TABLE item_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('NM', 'LP', 'MP', 'HP')),
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  finish VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (finish IN ('normal', 'foil', 'etched', 'showcase')),
  
  -- Reservation details
  proposal_id UUID REFERENCES trade_proposals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES trade_sessions(id) ON DELETE CASCADE,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'), -- 5-minute reservation timeout
  
  -- Constraints
  UNIQUE(user_id, item_id, condition, language, finish, session_id),
  CONSTRAINT valid_reservation_quantity CHECK (quantity > 0)
);

-- Indexes for reservations
CREATE INDEX idx_item_reservations_user_id ON item_reservations(user_id);
CREATE INDEX idx_item_reservations_item_id ON item_reservations(item_id);
CREATE INDEX idx_item_reservations_session_id ON item_reservations(session_id);
CREATE INDEX idx_item_reservations_expires_at ON item_reservations(expires_at);
CREATE INDEX idx_item_reservations_proposal_id ON item_reservations(proposal_id);

-- Composite index for conflict detection
CREATE INDEX idx_item_reservations_conflict ON item_reservations(item_id, condition, language, finish, expires_at);

-- Function to calculate trade fairness
CREATE OR REPLACE FUNCTION calculate_trade_fairness(
  proposer_value DECIMAL,
  recipient_value DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  -- Avoid division by zero
  IF proposer_value = 0 AND recipient_value = 0 THEN
    RETURN 0;
  END IF;
  
  IF proposer_value = 0 THEN
    RETURN 100; -- 100% in favor of recipient
  END IF;
  
  IF recipient_value = 0 THEN
    RETURN -100; -- 100% in favor of proposer
  END IF;
  
  -- Calculate percentage difference: (recipient - proposer) / proposer * 100
  RETURN ROUND(((recipient_value - proposer_value) / proposer_value * 100)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check item availability (not reserved by others)
CREATE OR REPLACE FUNCTION check_item_availability(
  p_user_id UUID,
  p_item_id UUID,
  p_quantity INTEGER,
  p_condition VARCHAR,
  p_language VARCHAR,
  p_finish VARCHAR,
  p_session_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  available_quantity INTEGER;
  reserved_quantity INTEGER;
BEGIN
  -- Get user's inventory quantity for this specific variant
  SELECT COALESCE(quantity, 0) INTO available_quantity
  FROM inventory 
  WHERE user_id = p_user_id 
    AND item_id = p_item_id 
    AND condition = p_condition 
    AND language = p_language 
    AND finish = p_finish 
    AND tradable = true;
  
  -- Get currently reserved quantity (excluding expired reservations)
  SELECT COALESCE(SUM(quantity), 0) INTO reserved_quantity
  FROM item_reservations 
  WHERE user_id = p_user_id 
    AND item_id = p_item_id 
    AND condition = p_condition 
    AND language = p_language 
    AND finish = p_finish 
    AND session_id != p_session_id -- Allow same session reservations
    AND expires_at > NOW();
  
  -- Check if requested quantity is available
  RETURN (available_quantity - reserved_quantity) >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Function to reserve items for a proposal
CREATE OR REPLACE FUNCTION reserve_proposal_items(
  p_proposal_id UUID,
  p_user_id UUID,
  p_session_id UUID,
  p_items JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  item_record RECORD;
  reservation_id UUID;
BEGIN
  -- Loop through each item in the proposal
  FOR item_record IN 
    SELECT 
      (item->>'item_id')::UUID as item_id,
      (item->>'quantity')::INTEGER as quantity,
      item->>'condition' as condition,
      COALESCE(item->>'language', 'en') as language,
      COALESCE(item->>'finish', 'normal') as finish
    FROM jsonb_array_elements(p_items) as item
  LOOP
    -- Check availability
    IF NOT check_item_availability(
      p_user_id,
      item_record.item_id,
      item_record.quantity,
      item_record.condition,
      item_record.language,
      item_record.finish,
      p_session_id
    ) THEN
      -- Rollback any reservations made so far
      DELETE FROM item_reservations WHERE proposal_id = p_proposal_id;
      RETURN FALSE;
    END IF;
    
    -- Create reservation
    INSERT INTO item_reservations (
      user_id, item_id, quantity, condition, language, finish,
      proposal_id, session_id
    ) VALUES (
      p_user_id, item_record.item_id, item_record.quantity,
      item_record.condition, item_record.language, item_record.finish,
      p_proposal_id, p_session_id
    );
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired proposals and reservations
CREATE OR REPLACE FUNCTION cleanup_expired_proposals() RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Update expired proposals
  UPDATE trade_proposals 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Delete expired reservations
  DELETE FROM item_reservations WHERE expires_at < NOW();
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trade_proposal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trade_proposal_timestamp
  BEFORE UPDATE ON trade_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_trade_proposal_timestamp();

-- RLS Policies for trade_proposals
ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;

-- Users can see proposals where they are proposer or recipient
CREATE POLICY "Users can view their own proposals" ON trade_proposals
  FOR SELECT USING (
    auth.uid() = proposer_id OR 
    auth.uid() = recipient_id
  );

-- Users can create proposals where they are the proposer
CREATE POLICY "Users can create proposals as proposer" ON trade_proposals
  FOR INSERT WITH CHECK (auth.uid() = proposer_id);

-- Users can update proposals where they are proposer or recipient
CREATE POLICY "Users can update their proposals" ON trade_proposals
  FOR UPDATE USING (
    auth.uid() = proposer_id OR 
    auth.uid() = recipient_id
  );

-- RLS Policies for item_reservations
ALTER TABLE item_reservations ENABLE ROW LEVEL SECURITY;

-- Users can see their own reservations
CREATE POLICY "Users can view their own reservations" ON item_reservations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create reservations for their own items
CREATE POLICY "Users can create their own reservations" ON item_reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reservations
CREATE POLICY "Users can delete their own reservations" ON item_reservations
  FOR DELETE USING (auth.uid() = user_id);

-- Function to create proposal with item reservations (atomic operation)
CREATE OR REPLACE FUNCTION create_trade_proposal_with_reservations(
  p_session_id UUID,
  p_proposer_id UUID,
  p_recipient_id UUID,
  p_proposer_items JSONB,
  p_recipient_items JSONB,
  p_proposer_total DECIMAL,
  p_recipient_total DECIMAL,
  p_fairness_percentage DECIMAL,
  p_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  proposal_id UUID;
  result JSONB;
BEGIN
  -- Create the proposal
  INSERT INTO trade_proposals (
    session_id, proposer_id, recipient_id,
    proposer_items, recipient_items,
    proposer_total_value, recipient_total_value,
    fairness_percentage, message
  ) VALUES (
    p_session_id, p_proposer_id, p_recipient_id,
    p_proposer_items, p_recipient_items,
    p_proposer_total, p_recipient_total,
    p_fairness_percentage, p_message
  ) RETURNING id INTO proposal_id;
  
  -- Reserve proposer's items
  IF NOT reserve_proposal_items(proposal_id, p_proposer_id, p_session_id, p_proposer_items) THEN
    -- Rollback the proposal if reservation fails
    DELETE FROM trade_proposals WHERE id = proposal_id;
    RAISE EXCEPTION 'Some proposer items are not available for trade';
  END IF;
  
  -- Reserve recipient's items (if any)
  IF jsonb_array_length(p_recipient_items) > 0 THEN
    IF NOT reserve_proposal_items(proposal_id, p_recipient_id, p_session_id, p_recipient_items) THEN
      -- Rollback everything if reservation fails
      DELETE FROM item_reservations WHERE proposal_id = proposal_id;
      DELETE FROM trade_proposals WHERE id = proposal_id;
      RAISE EXCEPTION 'Some recipient items are not available for trade';
    END IF;
  END IF;
  
  -- Grant permissions
GRANT SELECT, INSERT, UPDATE ON trade_proposals TO authenticated;
GRANT SELECT, INSERT, DELETE ON item_reservations TO authenticated;
GRANT EXECUTE ON FUNCTION create_trade_proposal_with_reservations TO authenticated;

-- Add helpful comments
COMMENT ON TABLE trade_proposals IS 'Real-time trade proposals between users in trading sessions';
COMMENT ON TABLE item_reservations IS 'Temporary item reservations to prevent double-spend during active proposals';
COMMENT ON FUNCTION calculate_trade_fairness IS 'Calculates fairness percentage between two trade values';
COMMENT ON FUNCTION check_item_availability IS 'Checks if items are available for reservation (not already reserved)';
COMMENT ON FUNCTION reserve_proposal_items IS 'Reserves items for a trade proposal with conflict detection';
COMMENT ON FUNCTION cleanup_expired_proposals IS 'Cleans up expired proposals and reservations';