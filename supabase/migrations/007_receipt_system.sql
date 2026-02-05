-- Receipt System Migration
-- Implements PDF receipt generation with immutable trade snapshots

-- Trade snapshots table for immutable trade records
CREATE TABLE trade_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL, -- References completed trade/proposal
  session_id UUID NOT NULL REFERENCES trade_sessions(id) ON DELETE CASCADE,
  
  -- Participants
  proposer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposer_name VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  
  -- Trade Items (JSON arrays with complete item details)
  proposer_items JSONB NOT NULL DEFAULT '[]',
  recipient_items JSONB NOT NULL DEFAULT '[]',
  
  -- Pricing Information
  proposer_total_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  recipient_total_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  fairness_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  price_version VARCHAR(50) NOT NULL,
  price_timestamp TIMESTAMPTZ NOT NULL,
  price_source VARCHAR(50) NOT NULL DEFAULT 'tcgplayer_market',
  
  -- Manual Overrides and Adjustments
  manual_overrides JSONB NOT NULL DEFAULT '[]',
  fairness_adjustments JSONB NOT NULL DEFAULT '[]',
  
  -- Metadata
  completed_at TIMESTAMPTZ NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity
  integrity_verified BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit Trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Constraints
  CONSTRAINT valid_participants CHECK (proposer_id != recipient_id),
  CONSTRAINT valid_values CHECK (
    proposer_total_value >= 0 AND 
    recipient_total_value >= 0
  ),
  CONSTRAINT valid_items CHECK (
    jsonb_array_length(proposer_items) > 0 OR 
    jsonb_array_length(recipient_items) > 0
  )
);

-- Receipts table for PDF receipt management
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_snapshot_id UUID NOT NULL REFERENCES trade_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- PDF Details
  pdf_url TEXT, -- URL to stored PDF file
  pdf_size INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ,
  
  -- Email Details
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_retries INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed', 'queued')),
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 years'), -- 2-year retention
  
  -- Constraints
  CONSTRAINT valid_pdf_size CHECK (pdf_size >= 0),
  CONSTRAINT valid_email_retries CHECK (email_retries >= 0 AND email_retries <= 10)
);

-- Receipt queue table for offline and retry processing
CREATE TABLE receipt_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL, -- Trade/proposal ID to generate receipt for
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  
  -- Queue Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Timing
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Error Handling
  last_error TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'), -- 7-day expiry
  
  -- Constraints
  CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= max_attempts),
  CONSTRAINT valid_error_count CHECK (error_count >= 0)
);

-- Indexes for performance
CREATE INDEX idx_trade_snapshots_trade_id ON trade_snapshots(trade_id);
CREATE INDEX idx_trade_snapshots_session_id ON trade_snapshots(session_id);
CREATE INDEX idx_trade_snapshots_proposer_id ON trade_snapshots(proposer_id);
CREATE INDEX idx_trade_snapshots_recipient_id ON trade_snapshots(recipient_id);
CREATE INDEX idx_trade_snapshots_created_at ON trade_snapshots(created_at DESC);
CREATE INDEX idx_trade_snapshots_completed_at ON trade_snapshots(completed_at DESC);

CREATE INDEX idx_receipts_trade_snapshot_id ON receipts(trade_snapshot_id);
CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);
CREATE INDEX idx_receipts_expires_at ON receipts(expires_at);

CREATE INDEX idx_receipt_queue_user_id ON receipt_queue(user_id);
CREATE INDEX idx_receipt_queue_status ON receipt_queue(status);
CREATE INDEX idx_receipt_queue_scheduled_at ON receipt_queue(scheduled_at);
CREATE INDEX idx_receipt_queue_next_retry_at ON receipt_queue(next_retry_at);
CREATE INDEX idx_receipt_queue_expires_at ON receipt_queue(expires_at);

-- Function to generate SHA-256 hash for trade snapshot integrity
CREATE OR REPLACE FUNCTION generate_snapshot_hash(
  p_trade_id UUID,
  p_proposer_items JSONB,
  p_recipient_items JSONB,
  p_proposer_total DECIMAL,
  p_recipient_total DECIMAL,
  p_completed_at TIMESTAMPTZ
) RETURNS VARCHAR(64) AS $
BEGIN
  -- Create hash from critical trade data
  RETURN encode(
    digest(
      p_trade_id::TEXT || 
      p_proposer_items::TEXT || 
      p_recipient_items::TEXT || 
      p_proposer_total::TEXT || 
      p_recipient_total::TEXT || 
      p_completed_at::TEXT,
      'sha256'
    ),
    'hex'
  );
END;
$ LANGUAGE plpgsql IMMUTABLE;

-- Function to verify trade snapshot integrity
CREATE OR REPLACE FUNCTION verify_snapshot_integrity(p_snapshot_id UUID) RETURNS BOOLEAN AS $
DECLARE
  snapshot_record RECORD;
  calculated_hash VARCHAR(64);
BEGIN
  -- Get snapshot record
  SELECT * INTO snapshot_record
  FROM trade_snapshots
  WHERE id = p_snapshot_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate hash from current data
  calculated_hash := generate_snapshot_hash(
    snapshot_record.trade_id,
    snapshot_record.proposer_items,
    snapshot_record.recipient_items,
    snapshot_record.proposer_total_value,
    snapshot_record.recipient_total_value,
    snapshot_record.completed_at
  );
  
  -- Compare with stored hash
  RETURN calculated_hash = snapshot_record.snapshot_hash;
END;
$ LANGUAGE plpgsql;

-- Function to cleanup expired receipts and queue items
CREATE OR REPLACE FUNCTION cleanup_expired_receipts() RETURNS INTEGER AS $
DECLARE
  expired_count INTEGER;
BEGIN
  -- Delete expired receipts
  DELETE FROM receipts WHERE expires_at < NOW();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Delete expired queue items
  DELETE FROM receipt_queue WHERE expires_at < NOW();
  
  -- Update failed queue items that have exceeded max attempts
  UPDATE receipt_queue 
  SET status = 'failed', processed_at = NOW()
  WHERE status = 'pending' AND attempts >= max_attempts;
  
  RETURN expired_count;
END;
$ LANGUAGE plpgsql;

-- Function to get next queued receipt for processing
CREATE OR REPLACE FUNCTION get_next_queued_receipt() RETURNS SETOF receipt_queue AS $
BEGIN
  RETURN QUERY
  SELECT *
  FROM receipt_queue
  WHERE status = 'pending'
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    AND attempts < max_attempts
    AND expires_at > NOW()
  ORDER BY priority DESC, scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$ LANGUAGE plpgsql;

-- Trigger to update receipt queue retry timing
CREATE OR REPLACE FUNCTION update_receipt_queue_retry()
RETURNS TRIGGER AS $
BEGIN
  -- Set next retry time with exponential backoff
  IF NEW.status = 'failed' AND NEW.attempts < NEW.max_attempts THEN
    NEW.next_retry_at = NOW() + (INTERVAL '1 minute' * POWER(2, NEW.attempts));
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_receipt_queue_retry
  BEFORE UPDATE ON receipt_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_queue_retry();

-- RLS Policies for trade_snapshots
ALTER TABLE trade_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view snapshots where they are proposer or recipient
CREATE POLICY "Users can view their trade snapshots" ON trade_snapshots
  FOR SELECT USING (
    auth.uid() = proposer_id OR 
    auth.uid() = recipient_id
  );

-- Only system can create snapshots (via service role)
CREATE POLICY "System can create trade snapshots" ON trade_snapshots
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Users can view their own receipts
CREATE POLICY "Users can view their own receipts" ON receipts
  FOR SELECT USING (auth.uid() = user_id);

-- System can manage receipts
CREATE POLICY "System can manage receipts" ON receipts
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for receipt_queue
ALTER TABLE receipt_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue items
CREATE POLICY "Users can view their queue items" ON receipt_queue
  FOR SELECT USING (auth.uid() = user_id);

-- System can manage queue
CREATE POLICY "System can manage receipt queue" ON receipt_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON trade_snapshots TO authenticated;
GRANT SELECT ON receipts TO authenticated;
GRANT SELECT ON receipt_queue TO authenticated;

GRANT ALL ON trade_snapshots TO service_role;
GRANT ALL ON receipts TO service_role;
GRANT ALL ON receipt_queue TO service_role;

GRANT EXECUTE ON FUNCTION generate_snapshot_hash TO service_role;
GRANT EXECUTE ON FUNCTION verify_snapshot_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_receipts TO service_role;
GRANT EXECUTE ON FUNCTION get_next_queued_receipt TO service_role;

-- Add helpful comments
COMMENT ON TABLE trade_snapshots IS 'Immutable snapshots of completed trades for audit compliance';
COMMENT ON TABLE receipts IS 'PDF receipt management with email delivery tracking';
COMMENT ON TABLE receipt_queue IS 'Queue for receipt generation during poor connectivity';
COMMENT ON FUNCTION generate_snapshot_hash IS 'Generates SHA-256 hash for trade snapshot integrity verification';
COMMENT ON FUNCTION verify_snapshot_integrity IS 'Verifies trade snapshot has not been tampered with';
COMMENT ON FUNCTION cleanup_expired_receipts IS 'Cleans up expired receipts and queue items';
COMMENT ON FUNCTION get_next_queued_receipt IS 'Gets next receipt to process from queue with locking';