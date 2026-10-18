import { Link } from 'react-router-dom';

export function BrandIdentity({ stacked = false }: { stacked?: boolean }) {
  return (
    <span className={`doelv-identity${stacked ? ' doelv-identity-stacked' : ''}`}>
      {/* Inline geometry: the brand never depends on a second image request. */}
      <svg className="doelv-mark" viewBox="0 0 128 128" fill="currentColor" width="64" height="64" aria-hidden="true" focusable="false">
        <path d="M25 20 43 36v68l-18 5V20Z" />
        <path d="m47 48 15 13v43H47V48Z" />
        <path d="m66 70 13 12v13l-10 9h-3V70Z" />
        <path d="M23 12c49 9 82 25 82 55 0 11-5 23-16 34 5-10 7-19 7-27 0-23-22-43-73-62Z" />
        <path d="m70 108 48-57-29 58-19-1Z" />
        <path d="M9 116c31-12 76-13 110 0-37-5-73-5-110 0Z" />
      </svg>
      <span className="doelv-wordmark">
        <strong>DOELV</strong>
        <span className="doelv-brand-korean">도엘브</span>
        <small>SKY GARAGE SYSTEM</small>
      </span>
    </span>
  );
}

export default function DoelvBrand() {
  return (
    <Link className="doelv-brand" to="/app" aria-label="DOELV 스카이게러지 공식 앱 홈">
      <BrandIdentity />
    </Link>
  );
}
