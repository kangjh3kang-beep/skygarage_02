/*
  # Add detailed address columns to complexes table

  1. Modified Tables
    - `complexes`
      - `road_address` (text) - 도로명 주소
      - `jibun_address` (text) - 지번 주소
      - `zip_code` (text) - 우편번호
      - `si_nm` (text) - 시/도명
      - `sgg_nm` (text) - 시/군/구명
      - `emd_nm` (text) - 읍/면/동명
      - `bd_nm` (text) - 건물명
      - `adm_cd` (text) - 행정동코드

  2. Notes
    - Supports structured address data from Juso.go.kr API
    - Existing `address` column preserved for backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'road_address'
  ) THEN
    ALTER TABLE complexes ADD COLUMN road_address text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'jibun_address'
  ) THEN
    ALTER TABLE complexes ADD COLUMN jibun_address text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'zip_code'
  ) THEN
    ALTER TABLE complexes ADD COLUMN zip_code text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'si_nm'
  ) THEN
    ALTER TABLE complexes ADD COLUMN si_nm text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'sgg_nm'
  ) THEN
    ALTER TABLE complexes ADD COLUMN sgg_nm text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'emd_nm'
  ) THEN
    ALTER TABLE complexes ADD COLUMN emd_nm text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'bd_nm'
  ) THEN
    ALTER TABLE complexes ADD COLUMN bd_nm text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'adm_cd'
  ) THEN
    ALTER TABLE complexes ADD COLUMN adm_cd text DEFAULT '';
  END IF;
END $$;
