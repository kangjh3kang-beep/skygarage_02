import { Link } from "react-router-dom";
import PwaInstallPrompt from "../components/PwaInstallPrompt";
import { BrandIdentity } from "../components/DoelvBrand";
import { PhotoHero } from "../components/BrandImagery";
import CorporateSiteLink from "../components/CorporateSiteLink";
export default function SgpWelcomePage() {
  return (
    <main className="doelv-welcome">
      <section className="doelv-welcome-copy">
        <span className="doelv-rule" />
        <p className="doelv-eyebrow">DOELV / SKY GARAGE</p>
        <h1>
          Luxury
          <br />
          <em>at your door.</em>
        </h1>
        <p>
          집 앞까지 연결되는 프라이빗 모빌리티.
          <br />
          나의 공간과 이동을 하나의 앱에서 만나세요.
        </p>
        <CorporateSiteLink />
      </section>
      <section className="doelv-welcome-panel" aria-label="공식 앱 시작">
        <p className="doelv-eyebrow">PRIVATE RESIDENCE EXPERIENCE</p>
        <BrandIdentity stacked />
        <PhotoHero compact />
        <h2>
          A NEW LAYER OF
          <br />
          <span>LUXURY LIVING</span>
        </h2>
        <p>
          집 앞까지 연결되는
          <br />
          프라이빗 모빌리티의 새로운 기준
        </p>
        <div className="doelv-welcome-actions">
          <Link className="doelv-primary" to="/app/login">
            로그인하고 시작하기 <span>↗</span>
          </Link>
          <Link className="doelv-secondary" to="/app/login?mode=register">
            처음 방문하셨나요? 회원가입
          </Link>
          <PwaInstallPrompt />
        </div>
        <small>DOELV · SKY GARAGE OFFICIAL APP</small>
      </section>
    </main>
  );
}
