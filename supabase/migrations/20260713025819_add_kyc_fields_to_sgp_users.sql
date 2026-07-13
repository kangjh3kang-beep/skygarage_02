/*
# Add KYC fields to sgp_users for identity verification

## Summary
Extends the sgp_users table with Know-Your-Customer fields required for
phone-based identity verification and future payment/coin operations.
Also adds rate limiting columns to sgp_phone_verifications for spam prevention.

## Modified Tables

### sgp_users - New Columns
- `birth_date` (text) - 생년월일 6자리 (YYMMDD format), nullable until KYC Level 2
- `gender_code` (text) - 주민번호 뒷자리 첫번째 (1~4), nullable until KYC Level 2
- `address` (text) - 주소 (시/도 + 구/군 + 상세), nullable until registration complete
- `address_detail` (text) - 상세주소 (동/호수), nullable
- `kyc_level` (integer) - KYC 인증 레벨 (0=미인증, 1=SMS인증, 2=실명인증, 3=계좌인증)
- `ci_hash` (text) - 본인인증 연계정보 CI 해시값 (NICE/KCB 인증 시 저장), nullable
- `phone_verified_at` (timestamptz) - 전화번호 인증 완료 시각

### sgp_phone_verifications - New Columns
- `ip_address` (text) - 요청자 IP (rate limiting용)
- `sent_via` (text) - 발송 채널 (aligo, test 등)
- `message_id` (text) - 알리고 발송 메시지 ID (발송 추적용)

## Security
- No policy changes (existing RLS still applies)
- KYC data (birth_date, gender_code) is sensitive PII - only owner can read via existing policy

## Important Notes
1. 주민번호 전체 저장 금지 - birth_date(6자리) + gender_code(1자리)만 저장
2. kyc_level 기본값 0: 회원가입 완료 시 1로 업데이트 (SMS 인증 완료)
3. ci_hash는 향후 NICE/KCB 본인인증 연동 시 사용
*/

-- Add KYC columns to sgp_users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_users' AND column_name = 'birth_date') THEN
    ALTER TABLE sgp_users ADD COLUMN birth_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_users' AND column_name = 'gender_code') THEN
    ALTER TABLE sgp_users ADD COLUMN gender_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_users' AND column_name = 'address') THEN
    ALTER TABLE sgp_users ADD COLUMN address text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_users' AND column_name = 'address_detail') THEN
    ALTER TABLE sgp_users ADD COLUMN address_detail text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_users' AND column_name = 'kyc_level') THEN
    ALTER TABLE sgp_users ADD COLUMN kyc_level integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_users' AND column_name = 'ci_hash') THEN
    ALTER TABLE sgp_users ADD COLUMN ci_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_users' AND column_name = 'phone_verified_at') THEN
    ALTER TABLE sgp_users ADD COLUMN phone_verified_at timestamptz;
  END IF;
END $$;

-- Add tracking columns to sgp_phone_verifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_phone_verifications' AND column_name = 'ip_address') THEN
    ALTER TABLE sgp_phone_verifications ADD COLUMN ip_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_phone_verifications' AND column_name = 'sent_via') THEN
    ALTER TABLE sgp_phone_verifications ADD COLUMN sent_via text DEFAULT 'aligo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sgp_phone_verifications' AND column_name = 'message_id') THEN
    ALTER TABLE sgp_phone_verifications ADD COLUMN message_id text;
  END IF;
END $$;

-- Index for rate limiting by phone number + time
CREATE INDEX IF NOT EXISTS idx_sgp_phone_verifications_phone_created
  ON sgp_phone_verifications(phone, created_at DESC);

-- Index for KYC level queries
CREATE INDEX IF NOT EXISTS idx_sgp_users_kyc_level
  ON sgp_users(kyc_level);
