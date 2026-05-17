/*
  # Add DELETE policy to complexes table

  1. Security Changes
    - Add DELETE policy for authenticated users on `complexes` table
    - This allows admin users to remove complexes from the system

  2. Notes
    - Matches existing SELECT/INSERT/UPDATE policy pattern
    - Only authenticated users can delete
*/

CREATE POLICY "Authenticated users can delete complexes"
  ON complexes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
