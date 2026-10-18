import { Link } from 'react-router-dom';
import { master, wordmark, emblem } from '../assets/approved-brand';
import './approved-brand.css';

export function BrandIdentity({ stacked = false }: { stacked?: boolean }) {
  return <span className={`doelv-identity doelv-approved${stacked ? ' doelv-identity-stacked' : ''}`} role="img" aria-label="DOELV 도엘브 SKY GARAGE SYSTEM">
    {stacked ? <img className="doelv-master-logo" src={master} width={440} height={534} alt="" aria-hidden="true" />
      : <><img className="doelv-mark" src={emblem} width={200} height={178} alt="" aria-hidden="true" /><img className="doelv-original-wordmark" src={wordmark} width={650} height={232} alt="" aria-hidden="true" /></>}
    <span className="doelv-original-accessible doelv-wordmark"><strong>DOELV</strong><span>도엘브</span><small>SKY GARAGE SYSTEM</small></span>
  </span>;
}
export default function DoelvBrand() {
  return <Link className="doelv-brand" to="/app" aria-label="DOELV 스카이게러지 공식 앱 홈"><BrandIdentity /></Link>;
}
