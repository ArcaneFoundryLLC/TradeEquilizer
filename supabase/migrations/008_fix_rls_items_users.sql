-- Fix RLS policies for items and users tables
-- Resolves: "new row violates row-level security policy for table items"
-- when the wants API tries to insert a new item fetched from Scryfall.

-- Allow any authenticated user to INSERT into items (crowd-sourced catalog from Scryfall)
CREATE POLICY "Authenticated users can insert items" ON items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prices" ON prices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to create their own profile row (needed on first login/want creation)
CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
