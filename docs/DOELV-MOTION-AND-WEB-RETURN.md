# DOELV motion gallery and corporate return

Date: 2026-10-19 (Asia/Seoul)

## Implemented

- Corporate `/#films`: selectable gallery of active direct MP4/WebM videos from the existing `section_media` table. The existing three published MP4 files remain at their public Supabase Storage URLs; no duplicate movie uploads or database migration.
- Native controls and inline mobile playback. Video bytes are requested only after the visitor selects Play. Changing the selection unmounts the previous video. No automatic page-load playback or audio.
- Public read errors and media decoding/network errors provide separate retry paths. Unpublished/withdrawn videos are not resurrected from a hardcoded fallback. Invalid URLs and duplicates are ignored.
- Existing film posters are actual frames from the originals. Prior-brand introduction/concept films retain an archive notice; they are not represented as new DOELV installations or measured operational performance.
- Every authenticated app route shares a `PC 웹사이트` link, also present on welcome, login and registration. On the apex `.net` host its absolute destination is `https://skygarage.net/`; elsewhere it is `https://www.skygarage.net/`. Both serve the corporate site. This keeps the existing browser origin/session on the current `.net` hosts and also works when the app later moves to its separate domain. Clicking it performs ordinary navigation and never logs the user out.
- Corporate and app photographs use the exact approved metallic gold emblem and wordmark as a responsive overlay. The original pixels and proportions remain intact. No AI-redrawn mark, registered-trademark claim, or photo-source replacement.

## Existing film inventory

Public storage directory: `https://ykmeconwqbathcdejalr.supabase.co/storage/v1/object/public/section-media/videos/`

| File | Measured duration | Resolution | UI title |
| --- | --- | --- | --- |
| 1779601569837_66flwrlm8mo.mp4 | 83.32 s | 1920×1080 | 주차에서 시작되는 새로운 일상 |
| 1779140483488_lsschk76kn.mp4 | 8.00 s | 1280×720 | 내 공간으로 이어지는 차량의 여정 |
| 1779582138626_075931nq0kj6.mp4 | 81.92 s | 1920×1080 | 스카이게러지가 제안하는 주거의 미래 |

The database controls publication and ordering. Known file names only supply reviewed titles/posters; they do not force a file to remain published.

## HeyGen production jobs

Two user-requested jobs were submitted once with existing DOELV architecture as reference. The inline self-updating players were opened once for each. Do not regenerate automatically or spend additional credits on retries.

| Concept | Video ID | Reference asset ID | Requested output |
| --- | --- | --- | --- |
| Underground ATR valet time-lapse | f38078d72be942e1adf22923b80961ea | 8b6a17d5446144f3ad244657c397f2bc | 10 s, 1080p |
| Vehicle loading → elevator transport → unloading | de4cd3c2dafb428bbbf59a3a2b496771 | 4f7cda77a1844f62b3cb870abd2c660a | 10 s, 1080p, 16:9 |

Creation returned pending. Completion and output files have **not yet been verified or published**. No guessed playback URLs, empty players, or substitute footage are deployed for these jobs. HeyGen's workflow requires its player to receive completion updates and forbids conversational status polling merely to wait.

Before publication: retrieve the completed outputs when available through the permitted workflow, inspect the full clips, verify continuous car/robot identity, no collisions/morphing, stationary vehicle wheels during transport, doors closed before elevator movement, a stopped and aligned cabin before unloading, and no bystanders in the movement zone. Mark them `AI 콘셉트 영상 · 타임랩스`, not engineering verification or real field footage. Use the exact supplied logo outside the generator. Publish reviewed MP4 assets to durable public media storage, then add their active entries to `section_media`. Do not publish expiring signed HeyGen URLs.

## Verification

- TypeScript + Vite production build.
- `tests/corporate-films.browser.cjs`: real MP4 fixture playback (decoded frames and advancing time), controls, mobile inline mode, no eager downloads, video switching, failed media retry, failed list retry, empty/unpublished catalog, unsafe and duplicate URL filtering, five viewport widths.
- `tests/brand-imagery.browser.cjs`: original logo artwork, seven authenticated app scenes at four widths, return links on authenticated/welcome/login/register pages, logo/link collision check, image fallback and retry.
- `tests/corporate-brand.browser.cjs`: five corporate viewport widths, photo loading/recovery, navigation and existing inquiry behavior with intercepted requests.
- Tests use isolated local fixtures; they do not create accounts, send inquiries/messages, or issue hardware commands.

No claim is made that generated footage proves the hardware system works. Existing commissioning and safety gates remain unchanged.
