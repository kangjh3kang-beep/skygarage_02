# 로그인 후 메뉴 이미지 재정비 · 2026-10-18

## 이번 수정의 범위

사용자가 로그인 후 로고와 사진 깨짐을 다시 신고했다. 공개 운영 시작 화면에서 이전 배포 이미지는 로딩됐지만, 사용자 PC의 로그인 세션과 실패 당시 요청은 직접 관찰하지 못했다. 따라서 캐시를 단일 원인으로 단정하지 않는다. 기존의 별도 로고 파일 요청, 고정된 사진 경로, 실패 후 복구 부재를 개선했다.

- **로고**: 공통 BrandIdentity의 건축형 D 심볼을 React 인라인 SVG로 구현했다. 별도 이미지 다운로드가 필요 없으며 DOELV / 도엘브 워드마크는 실제 텍스트다. 시작·로그인·로그인 후 공통 헤더가 같은 로고를 사용한다.
- **사진**: 7개 장면을 내장 imagegen으로 다시 제작했다. 실제 원본은 모두 **1672×941px**다. 인위적 확대를 하지 않았다. 사진은 AI 실사형 콘셉트이며, 준공 현장이나 승인된 기계 설계 도면이 아니다.
- **콘셉트**: 첨부 v25-1 명세서의 고층 세대 전용 게러지, 차량 엘리베이터, 낮은 자율이송 플랫폼, 분리된 주거 출입 동선에 맞췄다. 과거 구조도보다 최신 명세서의 회전판 비의존 개념을 우선한다. 기계 구조의 제작 적합성을 이 이미지로 검증하지 않는다.
- **표시 구조**: 소스에서 직접 가져오는 이미지로 변경해 파일 누락은 빌드에서 검사하고, 배포 파일명은 내용 해시를 가진다. 800px / 원본 WebP와 원본 JPEG를 제공한다. 정상 표시에서 원본 비율을 보존한다.
- **장애 복구**: WebP 로딩·디코딩 실패 시 동일 장면의 JPEG로 자동 전환한다. 두 형식이 모두 실패하면 깨진 이미지 요소를 제거하고 사진만 다시 불러오는 버튼을 제공한다. 메뉴별 이미지 상태를 분리해 오류가 다른 메뉴에 남지 않게 한다.
- **구버전 호환**: 빌드 시 이전 imagery-v2 경로 14개와 residence / garage / lobby / arrival 경로에도 새 사진을 출력한다. 이전 래스터 로고 3개도 벡터 원본으로 교체한다. 오래 열린 문서는 기존 코드가 남을 수 있어 설정에 '화면 업데이트' 링크를 추가한다.
- **범위 유지**: 인증·역할·실운행 승인·결제 동작을 변경하지 않는다.

## 메뉴와 파일

| 메뉴 | 이미지 중심 | 파일 접두사 |
| --- | --- | --- |
| 홈 | 주거 거실과 유리벽으로 분리된 고층 전용 게러지 | home |
| 차량 호출 | 차량용 엘리베이터와 자율이송 플랫폼 | call |
| 게러지 | 전용 차량 공간·충전·도킹 구역 | garage |
| 출입 | 주거 출입문·리더·게러지의 연결 | access |
| 설정 | 입주민 휴대폰·인증 카드·차량 키 | profile |
| 요청 | 차량·주거 서비스 지원 공간 | requests |
| 결제 | 게러지·충전과 연결된 이용 정산 콘셉트 | wallet |

실제 앱 자산: `src/sgp/assets/photography/{메뉴}-800.webp`, `{메뉴}-full.webp`, `{메뉴}-fallback.jpg`.
매핑: `src/sgp/assets/photography.ts`.
로고: `src/sgp/components/DoelvBrand.tsx`.
구버전 로고: `public/doelv/emblem.webp`, `wordmark.webp`, `logo.webp`. 워드마크와 전체 로고의 SVG 원본도 보관한다. 한글 호환 로고에는 Noto Sans KR의 글자 윤곽을 사용했다.

## 검증

- TypeScript / Vite 생산 빌드, 관련 ESLint, diff 공백 검사.
- 생산 빌드를 로컬 서버에서 실행한 인증 후 7개 메뉴 × 4개 화면폭(320 / 390 / 768 / 1440) 검사.
- 실제 사진 디코딩, 원본 비율, 인라인 로고, 가로 넘침, 잘못된 이미지 요소 여부 검사.
- 링크로 메뉴를 전환하는 SPA 동작과 과거 경로 4개(parking / map / spots / pay) 검사.
- 7개 사진의 WebP 대신 HTML이 반환되는 고장 시나리오에서 JPEG 복구 확인.
- 두 형식 모두 실패한 뒤 사진만 재시도하는 동작과 설비 미연동 호출 제한 유지 확인.
- 백엔드 응답은 로컬 화면 검증용으로 격리했다. 실제 사용자 로그인 또는 운영 데이터 쓰기를 실행하지 않는다.
- 운영 배포에서는 배포 상태와 공개 화면, 사진 파일의 응답·내용 해시를 별도로 확인한다.

재현:
```bash
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/brand-imagery.browser.cjs
```

## 최종 이미지 제작 프롬프트

내장 imagegen을 사용했으며 CLI/API 폴백을 사용하지 않았다. 요청 해상도와 실제 반환 해상도를 구분해 위에 명시했다.

### home

Use case: photorealistic-natural. Asset type: final production photograph for the Korean DOELV / SKY GARAGE resident app, not a UI mockup. Create one exceptionally detailed, premium architectural/editorial photograph, wide landscape 16:9, 2048x1152 or highest supported native resolution. This is a real-estate mobility concept: a private high-rise residence has its own enclosed garage connected to a vehicle elevator and autonomous low-profile transport robot. Consistent understated materials: deep midnight navy, brushed champagne bronze, warm walnut, pale limestone; restrained soft morning daylight plus warm architectural light. Balanced exposure, crisp subject details, true physical scale, straight verticals, believable engineering, 35mm architectural lens. No text, no lettering, no logos, no watermarks, no UI, no collages, no brands on cars, no futuristic holograms. Preserve full main subject with safe margins; no extreme wide angle. View from the elegant quiet apartment living room toward a floor-to-ceiling glass partition enclosing a private vehicle bay on the same high floor. A beautiful unbranded graphite silver electric sedan, side-three-quarter view, parked fully behind the closed glass; clearly separated safe resident walkway and residential entry door to the right. Broad real city skyline outside glazed windows. A glimpse of understated sofa in foreground, no furniture in the vehicle zone. The private garage and dwelling are the story, not a hotel, showroom or exposed balcony. Sedan fully visible, soft daytime light, calm residence.

### call

Use case: photorealistic-natural. Asset type: final production photograph for the Korean DOELV / SKY GARAGE resident app, not a UI mockup. Create one exceptionally detailed, premium architectural/editorial photograph, wide landscape 16:9, 2048x1152 or highest supported native resolution. This is a real-estate mobility concept: a private high-rise residence has its own enclosed garage connected to a vehicle elevator and autonomous low-profile transport robot. Consistent understated materials: deep midnight navy, brushed champagne bronze, warm walnut, pale limestone; restrained soft morning daylight plus warm architectural light. Balanced exposure, crisp subject details, true physical scale, straight verticals, believable engineering, 35mm architectural lens. No text, no lettering, no logos, no watermarks, no UI, no collages, no brands on cars, no futuristic holograms. Preserve full main subject with safe margins; no extreme wide angle. Three-quarter view at a private high-rise transfer floor. A stationary graphite silver sedan is fully carried on a discreet low-profile autonomous vehicle-transport platform, just inside a realistically large car elevator with open bronze metal doors. The thin robotic carrier supports the four tires, visible rubber omnidirectional wheels and small sensors; no giant robotic arms and no rail turntable. Realistic floor leveling at the threshold. A protected human walkway is visibly separate on the side. Architecture matches a luxury residence but elevator hardware is credible. Whole car, wheel-support platform and elevator opening visible centrally. No people inside transport area.

### garage

Use case: photorealistic-natural. Asset type: final production photograph for the Korean DOELV / SKY GARAGE resident app, not a UI mockup. Create one exceptionally detailed, premium architectural/editorial photograph, wide landscape 16:9, 2048x1152 or highest supported native resolution. This is a real-estate mobility concept: a private high-rise residence has its own enclosed garage connected to a vehicle elevator and autonomous low-profile transport robot. Consistent understated materials: deep midnight navy, brushed champagne bronze, warm walnut, pale limestone; restrained soft morning daylight plus warm architectural light. Balanced exposure, crisp subject details, true physical scale, straight verticals, believable engineering, 35mm architectural lens. No text, no lettering, no logos, no watermarks, no UI, no collages, no brands on cars, no futuristic holograms. Preserve full main subject with safe margins; no extreme wide angle. Inside one resident's exclusive enclosed high-rise garage. One unbranded graphite silver sedan is fully parked in a generous dedicated bay; a flush low-profile docking pad lies under the wheels. Beside the car a neatly docked wall EV charger, organized walnut storage and a glass wall to the resident's entry lounge; distant city buildings visible through the far windows. Camera three-quarter front side, whole car and EV charger both clear. Private personal parking, not generic basement, dealership or hotel. Engineering quietly integrated into immaculate architecture.

### access

Use case: photorealistic-natural. Asset type: final production photograph for the Korean DOELV / SKY GARAGE resident app, not a UI mockup. Create one exceptionally detailed, premium architectural/editorial photograph, wide landscape 16:9, 2048x1152 or highest supported native resolution. This is a real-estate mobility concept: a private high-rise residence has its own enclosed garage connected to a vehicle elevator and autonomous low-profile transport robot. Consistent understated materials: deep midnight navy, brushed champagne bronze, warm walnut, pale limestone; restrained soft morning daylight plus warm architectural light. Balanced exposure, crisp subject details, true physical scale, straight verticals, believable engineering, 35mm architectural lens. No text, no lettering, no logos, no watermarks, no UI, no collages, no brands on cars, no futuristic holograms. Preserve full main subject with safe margins; no extreme wide angle. Secure transition between the private home entrance and its enclosed vehicle garage. Foreground on right a sharply focused minimalist champagne-bronze RFID/NFC reader mounted at normal hand height on dark stone, softly glowing tiny neutral indicator; central elegant closed bronze-framed glazed door and a clearly separate walkway. Through the glass, farther left, a graphite sedan in its private bay and a glimpse of city skyline. Balanced medium-wide composition so reader is recognisable and garage/home connection readable. No people, no holograms, no misleading successful authentication screen.

### profile

Use case: photorealistic-natural. Asset type: final production photograph for the Korean DOELV / SKY GARAGE resident app, not a UI mockup. Create one exceptionally detailed, premium architectural/editorial photograph, wide landscape 16:9, 2048x1152 or highest supported native resolution. This is a real-estate mobility concept: a private high-rise residence has its own enclosed garage connected to a vehicle elevator and autonomous low-profile transport robot. Consistent understated materials: deep midnight navy, brushed champagne bronze, warm walnut, pale limestone; restrained soft morning daylight plus warm architectural light. Balanced exposure, crisp subject details, true physical scale, straight verticals, believable engineering, 35mm architectural lens. No text, no lettering, no logos, no watermarks, no UI, no collages, no brands on cars, no futuristic holograms. Preserve full main subject with safe margins; no extreme wide angle. Resident settings and membership editorial still life: an elegant blank-screen dark smartphone, a plain embossed geometric resident access card and a compact unbranded vehicle key, carefully arranged on a walnut-and-limestone console inside a private high-rise home. In the background a softly focused graphite sedan behind a glazed partition makes the private garage context unmistakable. Natural morning light, tactile materials, restrained premium design. No fashion accessories, no cash, no watch, no text or numbers. Focus on the resident's phone and credential, not on generic wealth.

### requests

Use case: photorealistic-natural. Asset type: final production photograph for the Korean DOELV / SKY GARAGE resident app, not a UI mockup. Create one exceptionally detailed, premium architectural/editorial photograph, wide landscape 16:9, 2048x1152 or highest supported native resolution. This is a real-estate mobility concept: a private high-rise residence has its own enclosed garage connected to a vehicle elevator and autonomous low-profile transport robot. Consistent understated materials: deep midnight navy, brushed champagne bronze, warm walnut, pale limestone; restrained soft morning daylight plus warm architectural light. Balanced exposure, crisp subject details, true physical scale, straight verticals, believable engineering, 35mm architectural lens. No text, no lettering, no logos, no watermarks, no UI, no collages, no brands on cars, no futuristic holograms. Preserve full main subject with safe margins; no extreme wide angle. Premium residential mobility support workspace, not a hotel concierge: a clean slim limestone console with an open unbranded laptop showing a blank navy screen, a tablet and a simple closed service folio, all framed in foreground. Through the tall interior glass behind, one graphite sedan parked safely in its enclosed private garage beside a compact EV charger. Warm walnut cabinetry, bronze frame, soft morning city daylight. The scene communicates resident assistance and vehicle/home service coordination. No service bell, no reception lobby, no people, no text or fictional dashboards.

### wallet

Use case: photorealistic-natural. Asset type: final production photograph for the Korean DOELV / SKY GARAGE resident app, not a UI mockup. Create one exceptionally detailed, premium architectural/editorial photograph, wide landscape 16:9, 2048x1152 or highest supported native resolution. This is a real-estate mobility concept: a private high-rise residence has its own enclosed garage connected to a vehicle elevator and autonomous low-profile transport robot. Consistent understated materials: deep midnight navy, brushed champagne bronze, warm walnut, pale limestone; restrained soft morning daylight plus warm architectural light. Balanced exposure, crisp subject details, true physical scale, straight verticals, believable engineering, 35mm architectural lens. No text, no lettering, no logos, no watermarks, no UI, no collages, no brands on cars, no futuristic holograms. Preserve full main subject with safe margins; no extreme wide angle. Resident mobility billing still life in a private high-rise garage lounge. In foreground a discreet handheld contactless payment terminal and plain navy resident card placed neatly on light limestone next to a compact vehicle key; the terminal has a neutral blank dark screen, no success tick. In the mid-background the same graphite sedan and a small wall-mounted EV charging unit are clearly recognisable behind glass. Premium natural product photography, restrained warm metal, realistic tactile buttons, soft daylight. No cash, no currency, no numbers, no credit card logo, no claims of active payment service.

