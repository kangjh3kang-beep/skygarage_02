/*
  # Create CRM leads table

  1. New Tables
    - `crm_leads`
      - `id` (uuid, primary key)
      - `company_name` (text) - prospect company
      - `contact_name` (text) - decision maker
      - `contact_email` (text)
      - `contact_phone` (text)
      - `source` (text) - website, referral, event, cold_call, partner, advertisement
      - `stage` (text) - prospect, qualified, proposal, negotiation, closed_won, closed_lost
      - `deal_value` (numeric) - estimated deal value in KRW
      - `probability` (integer) - win probability 0-100
      - `expected_units` (integer) - number of parking units
      - `assigned_to` (text) - sales rep name
      - `next_action` (text) - next follow-up action
      - `next_action_date` (date, nullable)
      - `notes` (text)
      - `lost_reason` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `crm_leads` table
    - Add policies for authenticated users

  3. Seed Data
    - 20 leads across different pipeline stages
*/

CREATE TABLE IF NOT EXISTS crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'website',
  stage text NOT NULL DEFAULT 'prospect',
  deal_value numeric NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 10,
  expected_units integer NOT NULL DEFAULT 0,
  assigned_to text NOT NULL DEFAULT '',
  next_action text NOT NULL DEFAULT '',
  next_action_date date,
  notes text NOT NULL DEFAULT '',
  lost_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm leads"
  ON crm_leads FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert crm leads"
  ON crm_leads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update crm leads"
  ON crm_leads FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Seed data
INSERT INTO crm_leads (company_name, contact_name, contact_email, contact_phone, source, stage, deal_value, probability, expected_units, assigned_to, next_action, next_action_date, notes, created_at, updated_at) VALUES
  ('현대건설', '이상준 부장', 'sjlee@hyundai-enc.com', '02-3456-7890', 'referral', 'negotiation', 15000000000, 75, 450, '박수진', '최종 견적 협의', now()::date + interval '3 days', '강동구 프리미엄 아파트 단지 신축. 주차타워 3동 검토중', now() - interval '45 days', now() - interval '2 days'),
  ('대우건설', '김민정 차장', 'mjkim@daewoo-ec.com', '02-4567-8901', 'event', 'proposal', 8500000000, 60, 280, '박수진', '기술 PT 일정 확정', now()::date + interval '5 days', '마곡지구 복합단지. 경쟁사 비교 진행중', now() - interval '30 days', now() - interval '1 day'),
  ('포스코이앤씨', '장현우 과장', 'hwjang@posco-enc.com', '02-5678-9012', 'website', 'qualified', 12000000000, 40, 360, '김재현', '현장 방문 제안', now()::date + interval '7 days', '송도 R&D 단지 주차솔루션. ESG경영 관심 높음', now() - interval '20 days', now() - interval '3 days'),
  ('GS건설', '최서윤 부장', 'sychoi@gsenc.com', '02-6789-0123', 'cold_call', 'prospect', 6000000000, 20, 200, '박수진', '초기 미팅 제안', now()::date + interval '10 days', '분당 재개발 프로젝트. 1차 접촉 시도중', now() - interval '7 days', now() - interval '5 days'),
  ('롯데건설', '박진우 팀장', 'jwpark@lottecns.com', '02-7890-1234', 'partner', 'closed_won', 9200000000, 100, 300, '김재현', '계약 체결 완료', NULL, '잠실 트리니티 타워. 3개동 주차타워 시공 확정', now() - interval '90 days', now() - interval '10 days'),
  ('SK에코플랜트', '오진수 과장', 'jsoh@skecoplant.com', '02-8901-2345', 'referral', 'negotiation', 11000000000, 70, 330, '김재현', '가격 재협의', now()::date + interval '2 days', '판교 테크원시티. EV충전 통합 요청', now() - interval '60 days', now() - interval '1 day'),
  ('한화건설', '유미영 대리', 'myyoo@hanwha-enc.com', '02-9012-3456', 'website', 'prospect', 5000000000, 15, 150, '박수진', '소개자료 발송', now()::date + interval '14 days', '세종시 스마트시티. 초기 관심 문의', now() - interval '5 days', now() - interval '4 days'),
  ('두산건설', '신동현 차장', 'dhshin@doosan-con.com', '02-0123-4567', 'event', 'qualified', 7500000000, 35, 250, '박수진', '2차 미팅 일정 조율', now()::date + interval '8 days', 'MIPIM 전시회 접촉. 해외사업부 관심', now() - interval '15 days', now() - interval '2 days'),
  ('삼성물산', '한소희 부장', 'shhan@samsungcnt.com', '02-1234-5670', 'referral', 'proposal', 22000000000, 55, 600, '김재현', '임원 보고 대기', now()::date + interval '12 days', '래미안 프리미엄 라인 도입 검토. 그룹사 ESG위원회 승인 필요', now() - interval '40 days', now() - interval '5 days'),
  ('DL이앤씨', '고승현 과장', 'shgo@dlenc.com', '02-2345-6780', 'cold_call', 'closed_lost', 4500000000, 0, 120, '박수진', '-', NULL, '아크로 시리즈 적용 검토', now() - interval '120 days', now() - interval '60 days'),
  ('호반건설', '임채원 대리', 'cwim@hoban.co.kr', '02-3456-7891', 'website', 'prospect', 3500000000, 10, 100, '박수진', '첫 미팅 요청', now()::date + interval '15 days', '김포 신도시 프로젝트 문의', now() - interval '3 days', now() - interval '2 days'),
  ('현대엔지니어링', '백재훈 팀장', 'jhbaek@hdc-eng.com', '02-4567-8902', 'partner', 'qualified', 18000000000, 45, 500, '김재현', '공동 R&D MOU 논의', now()::date + interval '6 days', '스마트홈 연동 패키지. 현대차그룹 시너지', now() - interval '25 days', now() - interval '3 days'),
  ('태영건설', '문지은 과장', 'jemoon@taeyoung.com', '02-5678-9013', 'advertisement', 'prospect', 2800000000, 10, 80, '박수진', '관심 표명 확인', now()::date + interval '20 days', 'LinkedIn 광고 통해 유입', now() - interval '2 days', now() - interval '1 day'),
  ('제일건설', '권도윤 부장', 'dykwon@jeil-con.com', '02-6789-0124', 'referral', 'proposal', 6800000000, 50, 220, '박수진', '시범운영 계약서 검토', now()::date + interval '4 days', '강남 오피스텔. 시범 10면 선행설치 제안', now() - interval '35 days', now() - interval '2 days'),
  ('중흥건설', '조민수 대리', 'msjo@joonghung.co.kr', '062-345-6789', 'event', 'closed_lost', 4000000000, 0, 130, '박수진', '-', NULL, '가격 이슈로 유찰. 예산 초과', now() - interval '80 days', now() - interval '40 days'),
  ('금호건설', '송하늘 차장', 'hnsong@kumho-con.com', '02-7891-2345', 'website', 'qualified', 5500000000, 30, 180, '김재현', '현장 실사 제안', now()::date + interval '9 days', '아시아드 선수촌 리모델링. 기존 주차시설 개선', now() - interval '18 days', now() - interval '4 days'),
  ('한양', '나은정 과장', 'ejra@hanyang.co.kr', '02-8902-3456', 'cold_call', 'prospect', 3200000000, 5, 90, '박수진', '담당자 연결 대기', now()::date + interval '25 days', '수원 재건축 프로젝트. 아직 초기단계', now() - interval '4 days', now() - interval '3 days'),
  ('코오롱글로벌', '양태호 부장', 'thyyang@kolon.com', '02-9013-4567', 'partner', 'negotiation', 8000000000, 65, 260, '김재현', '계약 조건 최종 협의', now()::date + interval '1 day', '하늘채 브랜드 표준 적용. 3개 단지 일괄계약 추진', now() - interval '55 days', now() - interval '1 day'),
  ('HDC현대산업개발', '전소영 팀장', 'syjun@hdc-ipark.com', '02-0124-5678', 'referral', 'proposal', 13500000000, 50, 400, '김재현', '기술검증(POC) 제안서 제출', now()::date + interval '6 days', '아이파크 시리즈 전면 도입 검토. 기술검증 필수', now() - interval '28 days', now() - interval '3 days'),
  ('신세계건설', '도현석 과장', 'hsdo@shinsegae-con.com', '02-1235-6789', 'advertisement', 'qualified', 7000000000, 25, 230, '박수진', 'RFP 참여 확인', now()::date + interval '11 days', '스타필드 복합시설 주차. RFP 발행 예정', now() - interval '12 days', now() - interval '2 days');
