# DOELV corporate renewal and approved gold identity

Review date: 2026-10-18. Repository: kangjh3kang-beep/skygarage_02.

## Scope and deployment

The corporate root is rebranded to DOELV with tower, city, village, private residence garage, underground robotic valet, vehicle elevator, ATR and autonomous carrier concepts. It uses the existing Cloudflare Pages deployment. Public app and platform entry links continue to `/app` and `/admin`; this release does not claim that skygarage.app has been connected or change DNS.

`LandingPage`, `BrandGuidePage`, and the legacy `/valet` entry use the new corporate presentation. The legacy `/valet` URL leads to the valet section. Eight original AI photographic concepts have explicit concept labels; they are not photographs of commissioned installations. All sources are 1672 × 941 pixels, with 800-pixel WebP alternatives and independent JPEG fallbacks. The cover photograph uses the full source even on a tall mobile viewport to avoid enlarging a small source. Static Vite imports give deployed assets hashed URLs.

## Exact approved identity

The source of truth is the user's supplied `DOELV_LUXURY_APP_STANDALONE(앱시안).html`, which embeds transparent gold PNG artwork. The previous simplified vector interpretation is replaced by these original bytes. No new symbol, color filter, artificial metallic overlay, or font substitute is used.

| Artwork | Native dimensions | SHA-256 of original PNG |
| --- | --- | --- |
| Stacked master | 440 × 534 | 914fddbb899a3bc4fd28cb1addb36fa444f6f8f0a92a109355b98cbe8369ff2e |
| Wordmark | 650 × 232 | d17eadcb1dfde1d24d3546ff9292fd57ad731ee30265a68142f54b8ba0454c78 |
| Emblem | 200 × 178 | 679e55109b5f45c02c92bc62d49c53ba44bec22a8c797b4accd3cdb8a53229e3 |

`approved-brand.ts` embeds the exact PNGs so the logo does not depend on a separate asset request. Shared `BrandIdentity` displays them in the welcome page, authenticated app header, corporate header/footer and brand guide. Lossless public WebP compatibility files and SVG wrappers contain the original artwork. Versioned v3 favicon and install icons use the emblem with safe padding on the app background. The public service-worker cache and manual update page both use `sgp-public-install-v6`. Existing home-screen icon refresh timing remains controlled by the browser/OS.

## Business value and evidence boundary

A new section presents new-development and retrofit use cases: parking capacity, possible underground excavation/structure savings, robotic valet convenience, premium residential positioning and presale differentiation. A capacity comparison uses a **20–45% planning target supplied by the project owner**, not verified DOELV field results. It multiplies a valid integer input by 1.20 and 1.45 and rounds down; it is a transparent scenario, not a layout optimizer, quotation or guarantee. Equipment investment, operations, peak dispatch, transfer bays and safety circulation must be assessed alongside capacity. The increase in parking capacity is not a claimed construction-cost reduction percentage.

Primary legal sources reviewed:

- Parking Act Enforcement Rule, effective 2026-07-27, Ordinance 1604: https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288421
- Housing Construction Standards Rules, effective 2026-07-29, Ordinance 1605: https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288501
- Full housing amendment: https://www.law.go.kr/LSW/lsRvsDocInfoR.do?lsiSeq=288501
- Full parking amendment: https://www.law.go.kr/LSW/lsRvsDocInfoR.do?lsiSeq=288421

The housing amendment includes a residential-environment determination by the project approval authority, and transition provisions depend on approval application timing (including specified changes before tenant recruitment). Existing buildings still need project-specific installation/change approval and structural, fire/egress, management and equipment-safety review. The page therefore does not state that every residential building can install without conditions.

## Inquiry and operating boundaries

The inquiry form inserts into the existing `inquiries` table under its existing anonymous insert policy, using a dedicated public Supabase client with no session persistence. It does not alter a resident's login or expose inquiry records. Name, company, contact, project type, interest and message flow into the existing admin inquiry workflow. Required consent, invalid input, double submission prevention, timeout, failure retention and accepted-response success states are implemented. There were no schema changes and no production test leads.

The site describes future system integration, not commissioned hardware operation. It does not imply robot/elevator certification or bypass existing hardware safety gates. The source planning documents' in-situ robot alignment and safety-interlock concepts are retained without advertising a mandatory turntable.

## Validation

- TypeScript and Vite production build passed.
- Corporate layout checked at 320, 390, 768, 1440 and 1920 pixels: 9 rendered photo placements, no broken images and no horizontal overflow.
- Mobile navigation, collection-to-inquiry selection, keyboard journey tabs, app/admin links, brand guide and legacy valet route checked.
- Inquiry required fields, rejected-response data retention and accepted-response feedback checked with intercepted local requests; no real submission.
- Capacity comparison checked for 100, 500, empty and zero inputs; adjacent planning-target qualification verified.
- WebP decode failure recovers to JPEG; failure of both formats gives a recoverable UI; manual retry checked.
- App's 7 menu scenes checked at 320, 390, 768 and 1440 pixels (28 combinations), including SPA navigation, legacy aliases, image fallback/retry, logo decoding and exact approved-artwork hashes. Isolated local authenticated fixtures were used; no real production user login or backend mutation.
- Manual app update preserves login storage and unrelated cache, replaces legacy app cache, and provides offline retry/fallback. Its cache name is kept aligned with the new install icons.
- The existing large main chunk and embedded brand chunk produce a Vite size advisory; the original raster identity intentionally remains exact. Images are lazy loaded outside the main cover.

## Generated photographic sources

All final assets live under `src/corporate/assets/` as `<scene>-full.webp`, `<scene>-800.webp`, and `<scene>-fallback.jpg`. The social preview is `public/doelv/corporate-cover.jpg`.

### tower

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. Hero image: a spectacular slender 50-story luxury mixed-use residential tower rising from a sculptural limestone podium in a Seoul-inspired riverside neighborhood at blue hour, vertical bronze fins and warm inhabited windows, refined landscaped arrival plaza with one unbranded graphite sedan, three-quarter ground view with tower on the RIGHT TWO THIRDS, left third largely deep dusk sky and dark landscaped space suitable for white headline overlay. Building's upper crown visible, no cut-off top. Elegant realism, meticulous facade, 24mm architectural photography with straight verticals. Entire building and rich landscape are main subject.

### city

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. A beautifully designed next-generation mobility residential district, three premium high-rise mixed-use towers in the background, pedestrian landscaped central green promenade with terraced water garden and street level boutiques, a separate discreet vehicle arrival pavilion at right, few distant people naturally walking, aerial oblique view at about 30 meters above the plaza showing urban composition, late afternoon warm sun, luxurious but real Korean metropolitan architecture, no flying cars, no highways through park. Entire district visible with architecture and human-scaled nature.

### village

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. An exclusive low-density residential village on a wooded hillside, four stepped three-story limestone and warm timber villas with broad terraces and floor-to-ceiling glazing, each has a discreet private attached garage integrated into the lower level, stone driveway with one graphite sedan, lush grasses and mature trees, early morning sun, eye-level architectural photograph from slightly elevated garden, quiet privacy and expansive natural landscape, realistic Korean mountain suburban setting.

### residence

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. Interior photograph of a luxury high-rise private residence with direct-entry private car garage visible behind a FULL HEIGHT GLASS PARTITION. Frame from the travertine and walnut residential lounge in left foreground toward a graphite luxury sedan in the separate attached private garage on right, skyline visible through exterior glazing beyond, flush bronze framed connecting door, warm indirect light, sensible ventilation grille in garage, strict clean spatial separation between car and living room. Broad panoramic composition, no vehicle in living room. Car and threshold unmistakably visible, refined welcoming home.

### valet

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. A beautifully plausible premium underground robotic valet parking facility. Foreground graphite sedan in three-quarter view carried by a very low flat silver autonomous parking robot beneath the car, compact visible wheel-support arms, floor clearance only inches, four tires properly supported. Clearly visible entrance handover bay to left, neat rows of parked cars behind, broad circulation lanes, brushed metal columns, warm white ceiling linear lights and clean stone-gray epoxy floor. Horizontal real parking proportions, no people near moving platform. Light enough to see parking robot and parked cars. NO huge pallet, no turntable, no driver.

### elevator

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. A full-size DOELV concept vehicle elevator shown with doors OPEN from the arrival bay, graphite sedan on a very low autonomous transfer robot inside the large rectangular elevator cabin, flush floor bridge aligned perfectly, two thick brushed bronze sliding door jambs and industrial stainless steel cabin lining make the vehicle elevator function unmistakable, architectural luxury meets credible engineering, vertical rails only subtly visible, warm controlled light, enough clearance over and beside sedan. No glass elevator shaft, no open abyss, no people, no turntable.

### robot

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. Industrial product photography at low three-quarter angle inside a refined underground car facility: a genuinely compact low-profile autonomous vehicle transfer robot in brushed silver and graphite with bronze service-panel accents. Slim rectangular central chassis about 2 meters long and half meter wide only 14cm tall, four small omnidirectional wheel modules, articulated tire-support arms extended to front and rear sides; a parked graphite sedan in soft-focus background gives scale. Robot is unobstructed in foreground, physically plausible machined steel and safety sensors, extremely low underbody height, not a tall delivery box, not humanoid. Clean floor, no labels, no sci-fi. Main robot occupies lower center two-thirds.

### carrier

Create one exquisite photorealistic luxury architecture / industrial design editorial photograph for the Korean premium brand DOELV. Landscape 16:9, highest native resolution available. Warm ivory limestone, bronze details, walnut, deep forest green landscaping, graphite vehicles, restrained champagne highlights; natural colors, photographic dynamic range, crisp realistic materials, plausible structures. This is an envisioned project, no actual known landmark. No words, no lettering, no logos, no watermarks, no diagrams, no collage, no futuristic neon, no glowing holograms. Architectural Digest / premium real-estate editorial art direction, not a generic rendered game. A luxury residence back-of-house logistics hub with a small autonomous transport robot moving a secured compact brushed-metal luggage and parcel carrier toward a separate large elevator doorway. Low-profile four-wheel base, strapped closed parcels and one elegant suitcase on a contained wheeled cargo platform, tasteful ivory stone walls, walnut service door, brushed bronze trim, wide safe corridor, natural realistic proportions. Three-quarter view, entire robot and cargo visible in foreground, elevator portal in background, discrete premium hotel-residence service atmosphere. No people, no branding, no text, no humanoid.
