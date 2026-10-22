# 단계별 공동 작업 현황

2026-10-22 KST · 조사 기반 bc01dcad57bf298612cab7e3e4456d23d2a08789.

전체 관리: [#27](https://github.com/kangjh3kang-beep/skygarage_02/issues/27).

| 작업 | 담당 | 상태 | 선행 |
|---|---|---|---|
| [#20 공동 지침](https://github.com/kangjh3kang-beep/skygarage_02/issues/20) | Codex / Claude 검토 | 구현·검증, PR 준비 | 없음 |
| [#22 재현·린트 gate](https://github.com/kangjh3kang-beep/skygarage_02/issues/22) | Codex / Claude 검토 | 로컬 통과, CI·검토 대기 | #20 |
| [#23 문의 계약](https://github.com/kangjh3kang-beep/skygarage_02/issues/23) | Codex / Claude UX 분석 | 초안 v0.1 작성, 검토 대기 | #20 |
| [#26 문의 UI](https://github.com/kangjh3kang-beep/skygarage_02/issues/26) | Claude / Codex 검토 | 유형 표시 수정·7건 통과; 서버 연계 대기 | #23 |
| [#25 문의 서버](https://github.com/kangjh3kang-beep/skygarage_02/issues/25) | Codex / Claude 검토 | 계약 대기 | #23 |
| [#24 문의 통합](https://github.com/kangjh3kang-beep/skygarage_02/issues/24) | Codex / Claude 검토 | 선행 대기 | #22, #25, #26 |
| [#21 회원 실사용 인수](https://github.com/kangjh3kang-beep/skygarage_02/issues/21) | 운영자 + Claude, Codex 검증 지원 | 실제 계정·검수자 준비 필요 | #20 |

원 계획 36개 요구사항의 코드 분류는 검증 5 / 일부 17 / 예정 10 / 외부 4다. 이것은 운영 완료율이 아니다. 2026-10-22 10:44 KST 읽기 전용 집계: 현장 6개 모두 sandbox, 소속 2건, 문의·앱 요청·장비·HIL 기록 각 0건. 검증 범위 6개와 원 계획 카탈로그 36개가 존재한다. 등록 증거는 staging integration 성공 6건/실패 2건, 승인 기록 4건이며 acceptance 증거는 0건이다. 승인된 통합시험이 전체 요구사항의 운영 인수를 대신하지 않는다. 추가 웹·금융 범위와 과거 상세 카탈로그 대응은 #27에서 추적한다.

성장 가설 GROW-01: 동일한 Node 버전과 린트 회귀 차단을 적용하면 환경 차이와 새 진단 누적을 줄일 수 있다. 기준: 설치 engine 경고, 기존 오류 125/경고 23. 목표: 지원 버전 설치 경고 0, 새로운 진단 0, 기존 필수 시험 유지. 운영 서비스 성과는 별도 측정한다.

검증 후 의존성 감사에서 9건(높음 7, 보통 2)을 발견해 기존 호환 범위 내 lockfile을 갱신했고 재설치 감사 0건을 확인했다. 알려진 감사 목록의 현재 결과이며 모든 취약점 부재를 보증하지 않는다. 실제 CI 자동 이슈 흐름은 main 반영 후 활성화된다.
