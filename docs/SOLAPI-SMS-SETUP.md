# SOLAPI 인증문자 전환

2026-10-18 Supabase `ykmeconwqbathcdejalr`의 `sms-verify`를 SOLAPI 전용으로 전환했다. 알리고 호출 및 자동 대체 발송은 제거했다. Edge Function JWT 검사는 유지한다.

## 설정

권장 Supabase Edge Function 비밀값:

- `SOLAPI_API_KEY`
- `SOLAPI_API_SECRET`
- `SOLAPI_SENDER`: SOLAPI에서 등록·인증한 발신번호

기존 설정 호환을 위해 각각 `COOLSMS_API_KEY`, `COOLSMS_API_SECRET`, `COOLSMS_SENDER`를 대체값으로 읽는다. SOLAPI 이름의 설정이 있으면 우선 사용한다. 이 값들은 서버 비밀값이며 Netlify의 VITE 변수나 GitHub에 저장하지 않는다.

현재 기존 비밀값이 설정되어 있고, 서버에서 SOLAPI의 `GET /cash/v1/balance`를 서명해 호출한 결과 인증 성공을 확인했다. 진단 응답은 설정·인증 성공 여부만 반환하고 실제 잔액·계정정보·발신번호·키는 반환하지 않는다. 인증 결과는 워커당 60초 캐시한다.

## 발송 처리

- 공식 `POST /messages/v4/send-many/detail`에 단일 SMS를 전송한다.
- `registeredSuccess=1`, `registeredFailed=0`, 상태코드 `2000`과 메시지 ID가 있어야 접수 성공으로 판정한다.
- 접수 성공은 단말기 수신 완료를 뜻하지 않는다.
- 10초 통신 제한을 두고 통신 결과가 불명확한 경우 자동 재발송하지 않는다.
- API 응답 원문, 전화번호, OTP 및 비밀값을 로그에 기록하지 않는다.
- OTP는 Web Crypto로 생성한다. 기존 3분 유효기간 및 확인 횟수 제한을 유지한다.
- 전화번호별 요청 제한 조회에 실패하면 문자 발송을 차단한다.

## 검증

- `node --test tests/solapi.test.mjs`: 13개 통과.
- 어댑터 TypeScript 검사 통과.
- 배포된 `/sms-verify/health?verify=1`: HTTP 200, `provider=solapi`, `configured=true`, `authenticated=true` 확인.
- 실제 SMS 발송·발신번호 등록 상태·단말 수신 및 인증코드 확인은 미검증. 사용자 수신번호 없이 임의 문자 발송을 수행하지 않았다.

## 사용자 확인

https://skygarage-doelv.netlify.app/app 에서 회원가입 → 전화번호 입력 → 인증코드 발송 → 수신한 번호 입력 순서로 확인한다. 등록되지 않은 발신번호 오류가 발생하면 SOLAPI 콘솔의 발신번호 등록 상태와 `SOLAPI_SENDER`/`COOLSMS_SENDER`를 대조한다. 잔액 부족은 SOLAPI 콘솔에서 확인한다.

공식 문서:
- https://solapi.com/developers/api/authentication-api-key
- https://solapi.com/developers/api/messages
- https://solapi.com/developers/api/getBalance

## 2026-10-18 후속 점검

실제 앱의 설정 오류 제보 후 API 인증과 발신번호를 함께 재검증했다. 현 설정에서는 SOLAPI 발신번호 조회가 `HTTP 400 / SignatureDoesNotMatch`로 실패하고, 발신번호 설정값에 유효한 번호가 없는 것을 확인했다. 앞선 인증 확인 결과만으로 발송 준비 완료를 판단할 수 없다. API Key/Secret 한 쌍과 인증된 발신번호를 Supabase Secrets에서 다시 확인해야 한다.

코드는 활성 발신번호를 SOLAPI에서 직접 확인하도록 보완했다. 발신번호 설정이 비어 있거나 유효하지 않고 활성 번호가 정확히 하나일 때에만 해당 번호를 자동 선택한다. 여러 개이면 명시적으로 지정해야 하며, 설정된 번호가 유효하지만 인증목록에 없으면 다른 번호로 바꾸지 않는다. API 키와 Secret은 SOLAPI/COOLSMS 두 환경변수 쌍 사이에서 섞어 읽지 않는다.
