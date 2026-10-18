import { Outlet, NavLink } from "react-router-dom";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import NearMeOutlined from "@mui/icons-material/NearMeOutlined";
import PersonOutline from "@mui/icons-material/PersonOutlined";
import LocalParkingOutlined from "@mui/icons-material/LocalParkingOutlined";
import { useSgpAuth } from "./contexts/SgpAuthContext";
import SgpLoginPage from "./pages/SgpLoginPage";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import "./renewal.css";

const tabs = [
  { label: "홈", icon: <HomeOutlined />, path: "/app" },
  { label: "주차", icon: <LocalParkingOutlined />, path: "/app/parking" },
  { label: "내 차 위치", icon: <NearMeOutlined />, path: "/app/map" },
  {
    label: "지갑",
    icon: <AccountBalanceWalletOutlined />,
    path: "/app/wallet",
  },
  { label: "내 정보", icon: <PersonOutline />, path: "/app/profile" },
];

export default function SgpLayout() {
  const { isAuthenticated, loading, wallet } = useSgpAuth();
  if (loading)
    return (
      <div className="sg-shell sg-loading" role="status">
        <span className="sg-brand-mark">S</span>
        <p>스카이게러지를 준비하고 있어요</p>
        <span className="sg-loader" />
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="sg-shell">
        <SgpLoginPage />
      </div>
    );

  return (
    <div className="sg-shell">
      <a className="sg-skip" href="#sg-main">
        본문 바로가기
      </a>
      <header className="sg-header">
        <NavLink to="/app" className="sg-brand" aria-label="스카이게러지 홈">
          <span className="sg-brand-mark">S</span>
          <span>
            SKY GARAGE<small>EVERYDAY, ELEVATED.</small>
          </span>
        </NavLink>
        <NavLink to="/app/wallet" className="sg-wallet-link">
          <AccountBalanceWalletOutlined fontSize="small" />
          {wallet ? `${wallet.balance.toLocaleString()} C` : "내 지갑"}
        </NavLink>
      </header>
      <div className="sg-frame">
        <nav className="sg-navigation" aria-label="주요 메뉴">
          <span className="sg-nav-caption">MY SKY GARAGE</span>
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === "/app"}
              className={({ isActive }) =>
                `sg-nav-item${isActive ? " is-active" : ""}`
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
            </NavLink>
          ))}
          <span className="sg-nav-foot">
            일상의 이동을
            <br />더 여유롭게.
          </span>
        </nav>
        <main id="sg-main" className="sg-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <PwaInstallPrompt />
    </div>
  );
}
