# 공식 도메인 연결과 앱 업데이트

## 확인한 상태 (2026-10-18)

- Cloudflare Pages `skygarage-02`의 `main` 배포가 공식 서비스다. `.net`과 `www.skygarage.net`은 동일한 최신 DOELV 번들을 반환했다.
- Netlify `skygarage-doelv`에는 이전 버전이 남아 있다. 공식 도메인을 이 주소로 연결하지 않는다.
- 기존 서비스 워커 `sgp-app-v2`는 앱 진입 HTML과 정적 파일을 저장했다. 오래 열린 탭은 새 배포 후에도 기존 JavaScript를 실행한다. 사용자 PC의 실제 저장소는 직접 검사하지 못했다.
- `skygarage.app`은 이 작업 환경에서 정상 접속을 확인하지 못했다. Cloudflare 작업 브라우저 로그인 오류로 관리 콘솔 설정은 변경하지 않았다.

## 최신 화면 복구

현재 접속했던 **같은 호스트**의 `/app-update`를 열고 **최신 앱 불러오기**를 누른다. 예: `https://skygarage.net/app-update`.
로그인용 localStorage, 쿠키, 다른 앱의 캐시는 삭제하지 않는다. SGP 이전 캐시만 정리하고 최신 서비스 워커 활성화 후 앱을 연다. 오프라인이나 갱신 실패 시 오류와 재시도 버튼을 표시한다.

배포마다 빌드 커밋을 `/app-version.json`에 기록한다. 앱은 진입 시, 다시 보일 때, 네트워크 복구 시, 5분 간격으로 확인한다. 새 버전이 있으면 안내를 표시하고 사용자가 저장 후 업데이트를 선택한다. 작성 중인 폼을 자동 새로고침하지 않는다. `/app*`, `/sw.js`, 진입 HTML에 `Cache-Control: no-store`를 적용한다.

## Cloudflare에서 공식 앱 도메인 연결

1. Cloudflare 계정에서 **Workers & Pages → skygarage-02 → Custom domains(사용자 지정 도메인) → Set up a custom domain**으로 이동한다. 도메인 DNS 편집부터 시작하지 않는다.
2. `skygarage.app`을 입력하고 **Continue → Activate domain**을 선택한다. 도메인이 같은 Cloudflare 계정에 있으면 Pages가 DNS 레코드를 생성한다.
3. 생성 결과를 DNS 화면에서 확인한다. 필요한 레코드는 `CNAME`, 이름 `@`(또는 `skygarage.app`), 대상 `skygarage-02.pages.dev`다. Pages 안내에 따라 프록시와 TTL을 유지한다. 기존 동일 이름 레코드가 있으면 연결 대상을 확인하고 충돌을 해소한다. MX/TXT 등 다른 서비스 레코드는 삭제하지 않는다.
4. `www.skygarage.app`도 사용할 경우 Custom domains에서 별도로 추가한 뒤 `CNAME www → skygarage-02.pages.dev`를 확인한다.
5. Custom domains에 **Active**, HTTPS 인증서 정상 상태가 표시되는지 확인한다. `https://skygarage.app/`와 `/app/login`에서 DOELV가 뜨는지 확인한다. 앱 호스트의 `/`는 `/app`으로 이동하도록 코드에 준비되어 있다.
6. 연결 확인 **후에만** Pages **Settings → Variables and Secrets → Production**에 텍스트 변수 `VITE_OFFICIAL_APP_ORIGIN=https://skygarage.app`을 추가한다. 저장만으로 기존 빌드가 바뀌지 않으므로 **Deployments → 최신 main 배포 → Retry deployment**로 다시 빌드한다.
7. 재배포 후 `.net` 기업페이지의 **APP** 버튼과 기존 `.net/app/...` 주소가 `.app/app/...`으로 이동하는지 확인한다. `/admin/...`은 `.net` 관리페이지로 유지된다. 다른 도메인의 로그인 세션은 자동 공유하지 않으므로 `.app`에서는 다시 로그인할 수 있다.
8. Supabase Authentication의 허용 Redirect URLs에 실제 이용하는 앱 URL을 추가하고, Site URL을 바꾸기 전 이메일/소셜 인증 및 관리자 복귀 경로를 확인한다. 현재 전화번호·비밀번호 직접 로그인은 Redirect URLs 설정 자체가 도메인 연결을 대신하지 않는다.

| 용도 | 주소 | 연결 |
| --- | --- | --- |
| 기업 홍보 | `https://www.skygarage.net/` | 기존 Pages 연결 유지 |
| 플랫폼 관리 | `https://www.skygarage.net/admin` | 기존 Pages 연결 유지 |
| 사용자 공식 앱 | `https://skygarage.app/` → `/app` | Pages Custom domains 신규 연결 |

`.net` DNS를 삭제하거나 Netlify로 바꾸지 않는다. DNS만 추가하고 Pages에 도메인을 등록하지 않으면 연결 오류가 발생할 수 있다.

## 인수 확인과 되돌리기

- 이전 앱이 열린 브라우저에서 `/app-update`를 통한 갱신, 동일 호스트의 로그인 보존, 새 DOELV 화면을 확인한다.
- 새 배포 알림이 자동으로 폼 내용을 지우지 않는지 확인한다. 오프라인은 실제 운행/명령 성공으로 표시하지 않는다.
- `.app` 연결 후 PC APP 링크, 모바일 설치, 로그인, 관리자 복귀 경로를 확인한다. HTTPS가 검증되기 전에 전환하지 않는다.
- 전환 장애 시 `VITE_OFFICIAL_APP_ORIGIN`을 제거하고 main을 재배포하면 `.net/app`을 계속 사용할 수 있다. DNS 전체를 삭제하지 않는다.

공식 참고: https://developers.cloudflare.com/pages/configuration/custom-domains/ · https://developers.cloudflare.com/pages/configuration/headers/

## 개발 검증

TypeScript 빌드와 도메인 분리 테스트를 통과했다. `tests/app-update.browser.cjs`는 이전 실제 서비스 워커와 로컬 구버전 화면을 사용해 갱신·저장소 보존·새 버전 알림·작성 폼 보존·외부 경로 거부·오프라인 실패와 복구 화면을 검증한다. 실제 운영 사용자 세션이나 문자 인증은 시험에 사용하지 않는다. 실행 환경에 Playwright와 Chromium을 준비한 뒤 `npm run build`, `node tests/app-update.browser.cjs`를 실행한다. 별도 Chromium은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`로 지정할 수 있다.
