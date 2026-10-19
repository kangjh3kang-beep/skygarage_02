export const PLAN_VERSION = '2026.10-v1';
export const AUDIT_DATE = '2026-10-19';
export type RequirementState = 'code_verified' | 'partial' | 'planned' | 'external';
export const stateLabels: Record<RequirementState,string> = { code_verified:'소프트웨어 검증', partial:'일부 구현', planned:'구축 예정', external:'현장·제조사 검증 필요' };
export const phases = [
 {id:'P0',title:'기준선과 검증 관리',duration:'이번 보강 + 통합 검수',depends:'없음',exit:'구현 근거·실제 DB·승인 상태가 구분되고 운영 차단이 유지된다.'},
 {id:'P1',title:'본사·단지·현장 권한과 데이터',duration:'3–5주',depends:'P0',exit:'서로 다른 2개 현장의 API·DB·파일·이벤트 격리가 검증된다.'},
 {id:'P2',title:'템플릿과 현장 자동 구축',duration:'3–5주',depends:'P1',exit:'중간 실패·재실행·롤백을 거쳐도 현장·권한·설정이 중복되지 않는다.'},
 {id:'P3',title:'워크플로우와 장비 연결',duration:'6–10주 + 제조사 일정',depends:'P1·P2',exit:'명령 수명주기·연결 단절·안전 인터록을 실장비로 검증한다.'},
 {id:'P4',title:'LLM 지원과 개선 순환',duration:'4–6주',depends:'P1·P3 데이터 계약',exit:'현장 격리·도구 권한·평가·승인·복귀가 모두 검증된다.'},
 {id:'P5',title:'시범 현장과 확장 운영',duration:'4–8주 + 현장 인수',depends:'P1–P4',exit:'현장 인수·복구 훈련·서비스 지표·운영자 서명이 확보된다.'},
] as const;
export type PhaseId = typeof phases[number]['id'];
export type Requirement = {id:string;phase:PhaseId;title:string;state:RequirementState;owner:string;dependsOn:string[];acceptance:string;evidence:string[];next:string};
export const requirements: Requirement[] = [
 {id:'F01',phase:'P0',title:'DB 역할과 관리자 2단계 인증',state:'code_verified',owner:'보안·백엔드',dependsOn:[],acceptance:'무인증·일반회원·aal1·위조 역할 접근 거부, super_admin aal2만 집계 조회.',evidence:['src/admin/components/AdminSecurityGate.tsx','supabase/sql/implementation-readiness.verify.sql'],next:'실제 관리자 브라우저 세션과 역할 회수 시나리오 인수'},
 {id:'F02',phase:'P0',title:'입주민 요청과 감사 이력',state:'code_verified',owner:'백엔드·운영',dependsOn:['F01'],acceptance:'인증 회원만 요청, 중복 방지, 종료 후 불변, 관리자 답변·감사 이력 확인.',evidence:['supabase/sql/platform-foundation.sql','tests/platform-boundaries.test.mjs'],next:'현장 연결 후 요청 담당자 배정까지 E2E 검증'},
 {id:'F03',phase:'P0',title:'검증용 단지 템플릿 생성',state:'code_verified',owner:'플랫폼',dependsOn:['F01'],acceptance:'동일 요청 재시도 시 동일 현장, 내용 충돌 거부, 권한·비밀·회원 복제 없음.',evidence:['supabase/sql/site-template-generator.sql','tests/site-template.test.mjs'],next:'버전 카탈로그와 현장 인수 절차 연결'},
 {id:'F04',phase:'P0',title:'실제 구축 상태 집계',state:'code_verified',owner:'플랫폼·QA',dependsOn:['F01'],acceptance:'서버 집계 시간 표시, 누락·실패를 0으로 표시하지 않음, 민감정보 제외.',evidence:['supabase/sql/implementation-readiness.sql','tests/readiness.test.mjs'],next:'장비 수와 실제 연결·운행 가능 상태를 별도 측정'},
 {id:'F05',phase:'P0',title:'명령·이벤트 실패 모형',state:'code_verified',owner:'MOS·QA',dependsOn:[],acceptance:'범위 불일치·중복·기한·구버전·통신 단절·UNKNOWN 재구동 거부.',evidence:['src/lib/mission-contract.ts','tests/mission-contract.test.mjs'],next:'영속 inbox·outbox와 실제 adapter에 동일 계약 적용'},
 {id:'F06',phase:'P0',title:'고정 요구사항과 검수 증거',state:'partial',owner:'총괄·QA',dependsOn:['F01','F04'],acceptance:'요구사항별 시험·환경·버전·결과·독립 검수자·유효기간이 연결됨.',evidence:['src/lib/implementation-plan.ts','docs/INTEGRATED-PLATFORM-PLAN.md'],next:'증거 원장·독립 검수 DB 적용 완료; 실제 MFA 화면·독립 검수 인수 필요'},
 {id:'T01',phase:'P1',title:'조직·단지·현장의 기준 ID',state:'partial',owner:'데이터·플랫폼',dependsOn:['F03'],acceptance:'tenant/site/building/zone/device 관계와 기존 complex ID 매핑, FK 불일치 0건.',evidence:['supabase/sql/platform-foundation.sql'],next:'조직·현장 관계와 역할 RPC 배포; 건물·구역·legacy·금융 시설 매핑 인수 필요'},
 {id:'T02',phase:'P1',title:'현장 범위 역할과 접근 격리',state:'partial',owner:'보안·백엔드',dependsOn:['T01','F01'],acceptance:'2개 tenant의 조회·쓰기·검색·파일·Realtime 교차 접근 모두 차단.',evidence:['src/admin/contexts/TenantContext.tsx'],next:'증거·과제 RPC 배포·현장 격리 시험; 파일·검색·Realtime 등 전 경로 인수 필요'},
 {id:'T03',phase:'P1',title:'세대·회원 승인과 회수',state:'partial',owner:'운영·백엔드',dependsOn:['T02'],acceptance:'가입·입주 확인·승인·이사·탈퇴·권한회수가 이력과 함께 검증됨.',evidence:['supabase/sql/platform-foundation.sql'],next:'현장별 멤버십 관리 RPC와 승인 UI'},
 {id:'T04',phase:'P1',title:'차량·방문자와 권리 연결',state:'partial',owner:'서비스·백엔드',dependsOn:['T03'],acceptance:'차량 소유·위임·방문 유효기간·주차 권리 검증, 타현장 권한 거부.',evidence:['supabase/sql/platform-foundation.sql'],next:'차량 검증·방문 만료·권리 취소 API'},
 {id:'T05',phase:'P1',title:'현장 요청 배정과 서비스 티켓',state:'partial',owner:'운영·서비스',dependsOn:['T02','F02'],acceptance:'요청→현장→담당자→SLA→답변의 전 과정 감사, 무소속 요청 별도 처리.',evidence:['src/admin/pages/PlatformReadiness.tsx'],next:'service_requests의 nullable site_id 마이그레이션과 안전한 후속 배정'},
 {id:'T06',phase:'P1',title:'데이터 보존과 이전 검증',state:'planned',owner:'데이터·보안',dependsOn:['T01','T02'],acceptance:'운영·시연 데이터 분리, 개인정보 최소화·삭제·백업 보존 충돌 해결, 이전 대사 완료.',evidence:[],next:'소스별 실데이터 판별·격리·보존표와 이관 리허설'},
 {id:'C01',phase:'P2',title:'버전 고정 템플릿 카탈로그',state:'partial',owner:'플랫폼',dependsOn:['F03','T01'],acceptance:'아파트·오피스텔·주상복합·현장 유형의 모듈 의존성·해시·서명이 고정됨.',evidence:['src/lib/site-template.ts'],next:'draft→validated→approved→published 버전 원장'},
 {id:'C02',phase:'P2',title:'현장별 설정과 변경 비교',state:'planned',owner:'플랫폼·운영',dependsOn:['C01'],acceptance:'override는 허용 범위만 변경, 안전·권한 완화 금지, 사전 diff와 영향 표시.',evidence:[],next:'JSON schema와 설정 정책 검사기'},
 {id:'C03',phase:'P2',title:'구축 작업과 재시도',state:'partial',owner:'백엔드',dependsOn:['C01','T02'],acceptance:'DB 커밋과 outbox 원자성, 단계별 멱등성, worker 장애 복귀, DLQ·보상 검증.',evidence:[],next:'DB 내부 구축 outbox/inbox 배포; 외부 부작용 보상·현장 연결 인수 필요'},
 {id:'C04',phase:'P2',title:'현장 게이트웨이 등록',state:'planned',owner:'엣지·보안',dependsOn:['T02','C03'],acceptance:'일회용 등록·mTLS 장치 신원·키 회전·폐기·복제 인증 거부.',evidence:[],next:'장비 인증 발급·폐기와 현장 바인딩'},
 {id:'C05',phase:'P2',title:'비밀 관리와 연결 허용 목록',state:'planned',owner:'보안·SRE',dependsOn:['T02'],acceptance:'브라우저·템플릿·로그에 비밀 없음, SSRF·타현장 키 사용 차단.',evidence:[],next:'secret reference와 egress/endpoint 승인 정책'},
 {id:'C06',phase:'P2',title:'현장 승격·중지·회수',state:'partial',owner:'운영·QA',dependsOn:['C02','C03','F06'],acceptance:'sandbox→acceptance→ready는 증거와 독립 승인 필요; suspended 즉시 신규작업 차단.',evidence:[],next:'증거 기반 단계 전환·만료 점검 배포; 실제 현장 인수 필요'},
 {id:'M01',phase:'P3',title:'통합 이벤트 파이프라인',state:'partial',owner:'백엔드·데이터',dependsOn:['T02','C03'],acceptance:'tenant/site·원인/상관 ID·버전·스키마 포함, 중복·역순·유실·DLQ 대사 검증.',evidence:['src/lib/mission-contract.ts'],next:'CloudEvents envelope, outbox/inbox, 재처리 정책 영속화'},
 {id:'M02',phase:'P3',title:'미션 상태기계와 자원 점유',state:'partial',owner:'MOS',dependsOn:['M01','T04'],acceptance:'동시 점유 경합·fencing·TTL·미확인 상태 재조정, 물리 동작의 무조건 재시도 없음.',evidence:['src/lib/mission-contract.ts','skygarage_core/scheduler/multi_zone_engine.py'],next:'DB CAS·lease·미션 API·계약 기반 통합시험'},
 {id:'M03',phase:'P3',title:'제조사별 어댑터',state:'external',owner:'제조사·엣지',dependsOn:['C04','C05','M02'],acceptance:'실제 API·장치·firmware 버전으로 command/ack/status/fault/cancel 계약 시험.',evidence:[],next:'로봇·승강기·게이트·충전기 제조사 ICD와 시험 장비 확보'},
 {id:'M04',phase:'P3',title:'독립 안전 제어와 인터록',state:'external',owner:'안전 책임자·제조사',dependsOn:['M03'],acceptance:'위험분석·PLC/비상정지·문/점유센서·수동복구를 현장 조건에서 검증·서명.',evidence:['skygarage_core/actuator/unit_gate_control.py'],next:'모형과 실제 안전 회로 분리, 안전 설계·HIL 시험'},
 {id:'M05',phase:'P3',title:'통신 단절과 상태 복구',state:'partial',owner:'엣지·SRE',dependsOn:['M02','M03'],acceptance:'재부팅·망분리·시계오차·ACK 유실·재연결 시 재구동 없이 상태 대사.',evidence:['src/lib/mission-contract.ts'],next:'durable edge inbox, sequence·epoch·reconciliation 구현'},
 {id:'M06',phase:'P3',title:'운영 워크플로우와 수동 개입',state:'partial',owner:'서비스·운영',dependsOn:['M02','M04','M05'],acceptance:'접수→배정→운행→완료/보류→알림·민원 연결, 승인·수동 처리 전체 감사.',evidence:['src/admin/pages/WorkflowManager.tsx'],next:'차단된 legacy 흐름을 검증된 서버 워크플로우로 교체'},
 {id:'A01',phase:'P4',title:'현장별 근거 검색',state:'planned',owner:'AI·데이터',dependsOn:['T02','T06'],acceptance:'권한 있는 승인 문서만 검색, 문서 버전·출처 표시, 답을 모를 때 명시.',evidence:[],next:'tenant/site 필터를 서버에서 강제하는 RAG'},
 {id:'A02',phase:'P4',title:'LLM 도구 권한과 실행 경계',state:'planned',owner:'AI·보안',dependsOn:['A01','M06'],acceptance:'도구 allowlist·typed schema·최소권한, 지시 주입/직접 SQL/장비 명령 차단.',evidence:['supabase/functions/ai-agent/index.ts'],next:'읽기 도구부터 적용하고 쓰기는 작업별 승인·멱등성 적용'},
 {id:'A03',phase:'P4',title:'모델 평가와 제한 배포',state:'planned',owner:'AI·QA',dependsOn:['A01','A02'],acceptance:'고정 평가셋·격리/주입 공격 시험·정확도·회귀 기준을 통과한 버전만 canary.',evidence:[],next:'모델·프롬프트·검색 인덱스 버전별 평가 runner'},
 {id:'A04',phase:'P4',title:'학습·지식 개선과 승인',state:'partial',owner:'AI·운영',dependsOn:['A03','F06'],acceptance:'피드백→비식별→개선 후보→평가→독립 승인→제한 적용→복귀 이력 확보.',evidence:[],next:'사람의 개선·재검증·독립 검수 기반 구현; LLM 연결·평가·데이터 권리 검증 필요'},
 {id:'A05',phase:'P4',title:'모델 비용·장애·감사',state:'planned',owner:'AI·SRE',dependsOn:['A02'],acceptance:'요청/일/현장 예산·timeout·fallback·중지·민감정보 제거 로그 검증.',evidence:[],next:'model gateway와 서버 budget·tool audit'},
 {id:'A06',phase:'P4',title:'예지보전과 최적화 지원',state:'partial',owner:'AI·설비',dependsOn:['M01','A03'],acceptance:'실제 고장 라벨과 시간 누수 없는 평가, 오탐·누락 측정, shadow 운영 승인.',evidence:['skygarage_diagnostic/tests/test_phm_chain.py'],next:'모형을 실측 데이터로 보정; 안전 임계값 자동 변경 금지'},
 {id:'R01',phase:'P5',title:'SIL·HIL·현장 인수',state:'external',owner:'QA·안전·제조사',dependsOn:['M03','M04','M05','M06'],acceptance:'정상·고장·망분리·전원·비상정지·구조 시험의 로그와 실장비 서명 확보.',evidence:[],next:'현장·장비별 시험 절차, 계측기, 승인자 확정'},
 {id:'R02',phase:'P5',title:'시범 단지와 다현장 검증',state:'external',owner:'운영·QA',dependsOn:['R01','C06','A03'],acceptance:'1개 단지 제한 운영 후 2개 tenant 동시 운영·교차 오염 0건 검증.',evidence:[],next:'시범 현장·운영자·서비스 시간·철수 조건 확정'},
 {id:'R03',phase:'P5',title:'관측성과 서비스 수준',state:'partial',owner:'SRE',dependsOn:['M01','M06'],acceptance:'접수/운행 성공률·대기/완료 p95·unknown 체류·queue age·장비 가용성 실측.',evidence:['src/admin/pages/ObservabilityDashboard.tsx'],next:'trace·metric·log 연결, 알람·온콜·부하 시험'},
 {id:'R04',phase:'P5',title:'재해 복구와 운영 인수',state:'planned',owner:'SRE·운영',dependsOn:['T06','M05'],acceptance:'백업 복원·권한 회수·키 폐기·장애 대응·수동 운용 리허설과 RTO/RPO 실측.',evidence:[],next:'복구 runbook·운영 교육·실제 복원 훈련'},
 {id:'R05',phase:'P5',title:'미래 모빌리티 모듈 확장',state:'planned',owner:'서비스·플랫폼',dependsOn:['C01','M03','M06'],acceptance:'충전·배송·방문·주차 모듈을 기존 계약 회귀 없이 추가; 결제/정산 중복·환불 대사.',evidence:[],next:'capability registry·요금 원장·partner 계약별 plug-in 설계'},
 {id:'R06',phase:'P5',title:'출시·성장·변경 관리',state:'partial',owner:'총괄·QA·운영',dependsOn:['F06','R02','R03','R04','R05','A04','A05','A06'],acceptance:'36개 요구사항의 유효한 독립 인수 증거와 미해결 치명 결함 0건, 변경 후 재검수.',evidence:[],next:'고정 범위·증거 유효성·개선 원장 배포; 36개 현장 인수와 추가 금융 검수 필요'},
];
// No field-trial sign-offs have been provided. Code coverage is NOT operational acceptance.
export const operationalAcceptance = { approved:0, total:requirements.length, status:'인수 증거 등록 전' } as const;
