# 단계별 공동 작업 현황

2026-10-22 KST · 최초 조사 기반 bc01dcad57bf298612cab7e3e4456d23d2a08789; 통합 기준 932e820d1044e73826165c82a3fe64db4f5610de (다른 작업의 PR #28/#29 포함).

전체 관리: [#27](https://github.com/kangjh3kang-beep/skygarage_02/issues/27).

| 작업 | 담당 | 상태 | 선행 |
|---|---|---|---|
| [#20 공동 지침](https://github.com/kangjh3kang-beep/skygarage_02/issues/20) | Codex / Claude 검토 | 구현·검증, PR 준비 | 없음 |
| [#22 재현·린트 gate](https://github.com/kangjh3kang-beep/skygarage_02/issues/22) | Codex / Claude 검토 | 로컬 통과, CI·검토 대기 | #20 |
| [#23 문의 계약](https://github.com/kangjh3kang-beep/skygarage_02/issues/23) | Codex / Claude UX 분석 | 관리자 v1 고정·Claude UI 연계 검토; 공개 접수 계약 후속 | #20 |
| [#26 문의 UI](https://github.com/kangjh3kang-beep/skygarage_02/issues/26) | Claude / Codex 검토 | 유형 표시 수정·7건 통과; 서버 연계 대기 | #23 |
| [#25 문의 서버](https://github.com/kangjh3kang-beep/skygarage_02/issues/25) | Codex / Claude 검토 | 서버 18/18 native 검증, 최종 리뷰·CI 진행 | #23 |
| [#24 문의 통합](https://github.com/kangjh3kang-beep/skygarage_02/issues/24) | Codex / Claude 검토 | 선행 대기 | #22, #25, #26 |
| [#21 회원 실사용 인수](https://github.com/kangjh3kang-beep/skygarage_02/issues/21) | 운영자 + Claude, Codex 검증 지원 | 실제 계정·검수자 준비 필요 | #20 |

원 계획 36개 요구사항의 코드 분류는 검증 5 / 일부 17 / 예정 10 / 외부 4다. 이것은 운영 완료율이 아니다. 2026-10-22 10:44 KST 읽기 전용 집계: 현장 6개 모두 sandbox, 소속 2건, 문의·앱 요청·장비·HIL 기록 각 0건. 검증 범위 6개와 원 계획 카탈로그 36개가 존재한다. 등록 증거는 staging integration 성공 6건/실패 2건, 승인 기록 4건이며 acceptance 증거는 0건이다. 승인된 통합시험이 전체 요구사항의 운영 인수를 대신하지 않는다. 추가 웹·금융 범위와 과거 상세 카탈로그 대응은 #27에서 추적한다.

성장 가설 GROW-01: 동일한 Node 버전과 린트 회귀 차단을 적용하면 환경 차이와 새 진단 누적을 줄일 수 있다. 기준: 설치 engine 경고, 기존 오류 125/경고 23. 목표: 지원 버전 설치 경고 0, 새로운 진단 0, 기존 필수 시험 유지. 운영 서비스 성과는 별도 측정한다.

검증 후 의존성 감사에서 9건(높음 7, 보통 2)을 발견해 기존 호환 범위 내 lockfile을 갱신했고 재설치 감사 0건을 확인했다. 알려진 감사 목록의 현재 결과이며 모든 취약점 부재를 보증하지 않는다. 실제 CI 자동 이슈 흐름은 main 반영 후 활성화된다.

구현 PR: [#30](https://github.com/kangjh3kang-beep/skygarage_02/pull/30). Claude 계약·UI 검토는 차단 결함 없음으로 회신했으며, 별도 전체 코드 리뷰의 Important 2건(하위 lint 설정 우회, 포크 PR에 의한 main 알림 누락)과 Actions의 경로 의존 fingerprint 문제를 재현 후 수정했다. 이슈 #23에는 확인한 사실과 다음 UI 작업을 인계한다.

전체 단계 분담: [ROADMAP.md](ROADMAP.md). 로컬 통합 결과는 계약 140/140, UI 25/25(95경로 × 3상태), Python 167/167, 빌드·목록·lint 회귀 검사 통과다. 최신 PR head의 CI 판정은 연결된 Actions 실행을 따른다.


## 문의 서버 후속 단계 (2026-10-22)

기반 PR #30 e3407de, 작업 #23/#25. 관리자 v1: MFA+현재 DB 역할 확인, 5개 RPC, 배정·메모·답변 초안·상태 명령, revision·중복 명령 방지, 변경/조회 감사. 원래 text ID와 레거시 기록, 공개 폼 6열 INSERT 유지. 익명과 로그인 제출을 모두 SQL 역할로 검증했다.

Claude CLI는 계약 148244d와 기존 UI를 읽고 직접 CRUD/발송 표시/상태 선택/revision/이벤트/커서/삭제 제거의 전환 필요성을 확인했다. 당시 SQL 미구현 지적은 TDD RED 단계였고 이후 native 18/18로 구현됐다. 기존 UI는 아직 전환 전이므로 게이트를 유지하며 이 변경만으로 운영 배포하지 않는다. Claude가 제안한 idempotency_conflict의 자동 새 UUID 재시도는 채택하지 않는다. 해당 충돌은 입력·결과를 재확인한 뒤 사용자가 새 작업을 결정해야 한다.

전체 계약 158건: 157 통과, native 전용 동시성 1건 기본 WASM 실행에서 제외(별도 native 18/18 포함). 코드가 운영에 배포되거나 실제 문의가 인수된 것은 아니다. 운영 권한 함수 정의 조회는 자동 승인 검토에서 거부되어 운영 정책 대조가 미완료다. 이후 배포 전 확인할 항목으로 유지한다.
