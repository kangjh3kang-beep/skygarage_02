import { Link } from "react-router-dom";
export default function DoelvBrand() {
  return (
    <Link
      className="doelv-brand"
      to="/app"
      aria-label="DOELV 스카이게러지 공식 앱 홈"
    >
      <img src="/doelv/emblem.webp" alt="" width="64" height="57" />
      <img
        src="/doelv/wordmark.webp"
        alt="DOELV 도엘브 · SKY GARAGE SYSTEM"
        width="174"
        height="62"
      />
    </Link>
  );
}
export function PhotoHero({
  photo = "residence",
  caption = "PRIVATE RESIDENCE / SKY GARAGE",
}: {
  photo?: string;
  caption?: string;
}) {
  return (
    <div
      className={`doelv-photo doelv-photo-${photo}`}
      role="img"
      aria-label="DOELV 주거 공간 브랜드 이미지"
    >
      <span className="doelv-photo-tag">DOELV SIGNATURE</span>
      <span className="doelv-photo-caption">{caption}</span>
      <small className="doelv-photo-note">브랜드 이미지</small>
    </div>
  );
}
