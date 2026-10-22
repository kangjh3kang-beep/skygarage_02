# 피드백·성장 기록

기반 bc01dcad57bf298612cab7e3e4456d23d2a08789 · 2026-10-22 KST. 최종 head와 Actions 실행은 PR에 연결한다.

| ID | 관찰·기준 | 조치 | 재시험·검토 | 상태 |
|---|---|---|---|---|
| ENV-01 | Node 24.13.0에서 jsdom 계열 engine 경고 | 공식 LTS 24.22.1 고정 | 독립 npm ci 성공, engine 경고 0 | 로컬 검증 |
| QA-01 | 기존 오류 125/경고 23, CI에 린트 없음 | 진단별 baseline과 회귀 gate | RED 8 fail → GREEN 8 pass; CLI와 feedback 합계 15/15 | CI 연결·검토 중 |
| WEB-01 | 폼 유형이 관리자 사전에 없어 상세 값 누락 | Claude: 7종 추가와 공통 helper | Codex: prototype key 결함 재현 6 pass/1 fail → Claude 보완 → 7/7 | 로컬 검증 |
| FEED-01 | main 실패·회복이 업무 원장과 분리 | 최신 SHA·run·attempt만 bot 이슈 생성/재개/종료 | RED 6 fail → GREEN 6 pass, stale/fork/중복/사람 이슈 보호 | main 반영 후 작동 |
| SEC-01 | 깨끗한 설치 audit 9건(높음 7/보통 2) | package.json 호환 범위 내 lockfile 갱신 | 재설치 audit 0; 새 의존성 계약 136/136·build·lint gate 통과 | UI·CI 검증 중 |
| OPS-01 | 현재 DB: sandbox 6개, 통합 증거 8건, acceptance 0건 | 코드·자동 검사·실제 인수 분리 유지 | 읽기 전용 집계, 실사용 증거를 합성하지 않음 | 운영 인수 대기 |

실패 → 재현 → 담당 수정 → 상대 검토 → 동일 조건 재시험 → 기록의 루프를 실제로 수행했다. 아직 main에 없는 자동화가 이미 돌아간다고 주장하지 않는다. 같은 GitHub 계정의 도구 리뷰는 독립된 사람의 GitHub 승인으로 계산하지 않는다.

성장 가설 GROW-01은 실행 환경 차이와 신규 진단 누적 감소다. 관찰 결과: engine 경고 0, 신규 린트 진단 0, 기존 오류/경고 수 유지, 의존성 감사 9→0. 다음 성장 항목은 기존 린트 부채 감소와 서버 계약 기반 문의 접수·처리 성공 경로다. 실제 전환율·응답 시간은 실사용 수집·인수 후 측정한다.

같은 fingerprint의 기존/신규 진단 교체는 baseline만으로 판별할 수 없으므로 변경 코드 리뷰를 병행한다. 배포·계정·기기·현장 인수는 별도다.
