# DOELV 메뉴 이미지 리뉴얼 · 2026-10-18

## 변경 목적

기존 200×178 래스터 심볼, 잘린 워드마크, 640px 폭 세로 사진의 가로 확대 사용을 개선한다. 앱 헤더의 심볼은 SVG로 재구성하고 DOELV·도엘브·SKY GARAGE SYSTEM 글자는 실제 텍스트로 출력한다. 상단 로고·환영화면·앱 설치 아이콘에 같은 심볼을 적용한다.

## 메뉴별 이미지

| 메뉴 | 장면 | 자산 |
| --- | --- | --- |
| 홈·시작 | 주거 공간과 연결된 프라이빗 게러지 | home |
| 차량 호출 | 차량용 엘리베이터와 대기 차량 | call |
| 게러지 | 개인 주차 공간과 전기차 충전기 | garage |
| 출입 | 스마트 리더가 있는 주거 현관 | access |
| 설정·멤버십 | 스마트폰·입주카드·차량키 | profile |
| 요청 내역 | 컨시어지 서비스 데스크 | requests |
| 결제 | 게러지 배경의 비접촉 결제 단말기 | wallet |

## 구현

- 이미지 생성 방식: 기본 내장 imagegen. CLI/API 폴백을 사용하지 않았다.
- 생성 원본의 실제 해상도는 **1672×941px**다. 요청 프롬프트는 2048×1152였으나 실제 결과를 기준으로 자산과 화면 속성을 설정했다. 인위적 업스케일은 하지 않았다.
- 모든 사진은 네이비·샴페인 골드·월넛·아이보리 소재의 일관된 실사형 AI 콘셉트 이미지다. 실제 설치 현장 사진이나 운행 증빙이 아니다.
- `public/doelv/imagery-v2/`의 800px / 1672px WebP 두 크기를 srcset으로 제공한다. 원본 비율을 유지해 모바일에서 차량·리더·단말기가 잘리지 않게 한다.
- 이미지 경로와 alt를 타입 지정된 메뉴 맵으로 관리한다. 로딩 실패 시 브라우저의 깨진 이미지 아이콘 대신 안내를 표시하며, 로고 파일 실패 시에도 DOELV 텍스트와 D 표시를 유지한다.
- 로고 생성 시안은 제작 참고용이다. 최종 앱 심볼은 `public/doelv/mark-v2.svg`로 재구성해 래스터 투명 경계의 노이즈와 확대 손실을 없앴다. 워드마크는 Georgia/serif 실제 텍스트다.
- 설치 아이콘은 SVG에서 PNG 180/192/512로 렌더링했다. 변경된 아이콘 URL과 서비스 워커 캐시 v5를 적용한다.
- 데이터 조회, 권한, 회원가입, 요청 저장, 하드웨어·결제 준비 상태는 기존 기능을 유지한다.

## 이미지 프롬프트

공통: photorealistic-natural, DOELV / SKY GARAGE 앱 히어로, 가로 구도, 차분한 럭셔리 건축·제품 사진, 네이비·샴페인 브론즈·아이보리 스톤·월넛, 따뜻한 3000K 조명과 블루아워, 현실적인 비례, 중앙 피사체, 읽기 쉬운 명암, 텍스트·워터마크·브랜드 로고·UI·콜라주 없음.

### home
A private SKY GARAGE integrated into a contemporary Korean high-rise luxury residence: an elegant pearl silver unbranded electric grand touring sedan parked safely on a recessed stone parking bay behind floor-to-ceiling glazing, next to a sophisticated apartment foyer, panoramic Seoul-like city skyline at blue hour. The architecture clearly connects vehicle storage and the resident's own home. Grounded credible architecture, not a hotel drop-off, no flying vehicle, no car on an exposed balcony. Hero subject centrally composed so both a wide desktop crop and central mobile crop retain the car and residential context.

### call
A luxury residential vehicle elevator arriving at the resident's private floor: large open brushed champagne-metal vehicle-lift doors, a physically credible graphite sedan entirely inside the vehicle-rated lift cabin, visible floor guide strips and unobtrusive safety sensors, viewed at a three-quarter angle from the clean residential transfer lobby. Vehicle elevator, not a human elevator. The car is stationary with doors closed. Clearly communicate vehicle arrival and calling a parked car. Car and lift entrance central, no person, no text, no holographic interface.

### garage
An exclusive private residential garage suite, with a beautiful pearl silver unbranded sedan parked in one of two spacious marked bays, a discrete wall-mounted EV charger with its cable neatly stowed, tailored cabinetry and clean storage, dark stone floor, acoustic walnut wall panels and bronze details. Three-quarter architectural view, car in center and charging/storage context to sides. Clearly vehicle parking and personal garage, not car showroom or hotel. Empty second bay conveys usable space; no numbered signs, no brand badges.

### access
A premium residential smart-entry vestibule: elegant bronze-framed glass doors, a clearly visible brushed-brass contactless access reader mounted on dark navy stone on the right of the doorway at realistic hand height, a subtle green status light, warm welcoming reception space behind the glass. Camera near the reader with door architecture still clear, sharp reader and tactile stone surfaces, no humans, no phone or floating interface. Subject is secure building entry, not a hotel bedroom.

### profile
A beautifully organized private resident account and personal mobility still-life: an unbranded smartphone standing upright with a deep navy blank screen, a sculptural silver car key fob, a plain champagne metal resident access card and an understated navy leather card holder, carefully arranged together on an ivory marble console in a contemporary luxury residence. Softly blurred walnut cabinetry and window in background. No printed names, no credit card numbers, no apps on screen. Close editorial product photograph, objects central and fully visible. Communicate personal resident settings and membership, not wealth accessories; no cash, watches or jewelry.

### requests
A dedicated luxury residential concierge service desk inside a private apartment building: tactile curved ivory stone counter, walnut and bronze shelving, a neatly arranged guest-service bell, closed navy service folio and a slim desk tablet with an understated blank navy screen. View from the resident's side of the counter, grounded inviting hospitality, task-oriented concierge context rather than generic apartment interior. No people, no food, no logos, no lettering, no hotel signage.

### wallet
A premium residential parking payment still-life: compact modern contactless payment terminal with an understated blank dark screen on an ivory stone desk, a plain dark navy card positioned beside it and a silver car key fob in the foreground. A softly blurred private garage and parked sedan in the background clearly connect the transaction to mobility services. Terminal, card and keys centrally composed in sharp focus, professional luxury product photography. No amounts, numbers, card logos, personal details, success tick, text or brand marks.


## 검증 범위

TypeScript/Vite 빌드와 관련 ESLint를 통과했다. PC·모바일 320/390/768/1440px의 7개 메뉴(28개 조합)에서 실제 이미지 디코딩·원본 비율·가로 넘침 없음, 로고·사진 실패 대체 표시를 확인했다. 시작·로그인 화면도 시각 검토했다. JavaScript 오류 0건이다. 인증 후 화면 검증에는 로컬 UI용 응답을 사용하며 운영 사용자·문자 인증을 생성하지 않는다. 운영 배포에서는 신규 정적 자산과 공개 앱 시작화면 로딩을 확인한다.

