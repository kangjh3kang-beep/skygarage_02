import { useState } from 'react';
import { Link } from 'react-router-dom';

export function BrandIdentity({ stacked = false }: { stacked?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`doelv-identity${stacked ? ' doelv-identity-stacked' : ''}`}>
      {failed ? <span className="doelv-mark-fallback" aria-hidden="true">D</span> :
        <img className="doelv-mark" src="/doelv/mark-v2.svg" alt="" width="64" height="64" onError={() => setFailed(true)} />}
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
