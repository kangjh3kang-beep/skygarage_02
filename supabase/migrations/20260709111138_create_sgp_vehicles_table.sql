/*
# Create SGP Vehicles Table

1. New Tables
- `sgp_vehicles`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, NOT NULL, defaults to auth.uid())
  - `plate` (text, vehicle plate number)
  - `brand` (text, manufacturer)
  - `model` (text, model name)
  - `color` (text, vehicle color)
  - `is_default` (boolean, default false)
  - `is_verified` (boolean, default false)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `sgp_vehicles`.
- Owner-scoped CRUD: authenticated users can only manage their own vehicles.

3. Indexes
- Unique constraint on (user_id, plate) to prevent duplicate vehicle registration.

4. Notes
- Each user can have multiple vehicles but only one default.
- Vehicles are linked to mission requests for tracking purposes.
*/

CREATE TABLE IF NOT EXISTS sgp_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plate text NOT NULL,
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plate)
);

ALTER TABLE sgp_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vehicles" ON sgp_vehicles;
CREATE POLICY "select_own_vehicles" ON sgp_vehicles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vehicles" ON sgp_vehicles;
CREATE POLICY "insert_own_vehicles" ON sgp_vehicles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vehicles" ON sgp_vehicles;
CREATE POLICY "update_own_vehicles" ON sgp_vehicles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vehicles" ON sgp_vehicles;
CREATE POLICY "delete_own_vehicles" ON sgp_vehicles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
