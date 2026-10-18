import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import {
  HomeOutlined,
  DirectionsCarOutlined,
  GarageOutlined,
  ShieldOutlined,
  TuneOutlined,
} from "@mui/icons-material";
import { useSgpAuth } from "./contexts/SgpAuthContext";
import { ResidentDataProvider } from "./contexts/ResidentDataContext";
import DoelvBrand from "./components/DoelvBrand";
import SgpLoginPage from "./pages/SgpLoginPage";
import SgpWelcomePage from "./pages/SgpWelcomePage";
import "./renewal.css";
import "./doelv.css";
const tabs = [
  { label: "홈", icon: <HomeOutlined />, path: "/app" },
  { label: "차량 호출", icon: <DirectionsCarOutlined />, path: "/app/call" },
  { label: "게러지", icon: <GarageOutlined />, path: "/app/garage" },
  { label: "출입", icon: <ShieldOutlined />, path: "/app/access" },
  { label: "설정", icon: <TuneOutlined />, path: "/app/profile" },
];
export default function SgpLayout() {
  const { user, isAuthenticated, loading } = useSgpAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="sg-shell doelv-shell sg-loading" role="status">
        DOELV 앱을 준비하고 있습니다.
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="sg-shell doelv-shell">
        {location.pathname.replace(/\/$/, "") === "/app" ? (
          <SgpWelcomePage />
        ) : (
          <SgpLoginPage />
        )}
      </div>
    );
  if (location.pathname === "/app/login") return <Navigate to="/app" replace />;
  return (
    <ResidentDataProvider key={user?.id}>
      <div className="sg-shell doelv-shell">
        <a className="sg-skip" href="#sg-main">
          본문 바로가기
        </a>
        <header className="doelv-header">
          <DoelvBrand />
          <span className="doelv-signature">SIGNATURE</span>
        </header>
        <div className="doelv-frame">
          <nav className="doelv-navigation" aria-label="앱 주요 메뉴">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === "/app"}
                className={({ isActive }) =>
                  `doelv-nav-item${isActive ? " is-active" : ""}`
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
          <main id="sg-main" className="doelv-main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </ResidentDataProvider>
  );
}
