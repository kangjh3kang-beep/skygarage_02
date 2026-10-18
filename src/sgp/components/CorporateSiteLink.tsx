import './corporate-site-link.css';

export default function CorporateSiteLink() {
  // Both .net hosts serve the corporate site. Keep the current origin so a later
  // click on its App link can reuse the browser's existing Supabase session.
  const destination = window.location.hostname === 'skygarage.net' ? 'https://skygarage.net/' : 'https://www.skygarage.net/';
  return <a className="doelv-corporate-link" href={destination} aria-label="도엘브 PC 웹사이트로 돌아가기">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
    <span>PC 웹사이트</span>
  </a>;
}
