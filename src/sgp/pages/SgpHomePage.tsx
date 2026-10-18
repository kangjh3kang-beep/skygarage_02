import { Link } from "react-router-dom";
import { PhotoHero } from "../components/BrandImagery";
import { useSgpAuth } from "../contexts/SgpAuthContext";
import { useResidentData } from "../contexts/ResidentDataContext";
import { DataState } from "./DoelvServicePages";
export default function SgpHomePage() {
  const { user } = useSgpAuth();
  const { memberships, vehicles, requests, loading, error } = useResidentData();
  return (
    <>
      <PhotoHero />
      <div className="doelv-content">
        <p className="doelv-eyebrow">
          WELCOME HOME{user?.display_name ? ` · ${user.display_name}님` : ""}
        </p>
        <h1>
          집 앞에서 완성되는
          <br />
          프라이빗 모빌리티
        </h1>
        <DataState />
        {!loading && !error && (
          <div className="doelv-card">
            <p className="doelv-eyebrow">YOUR PRIVATE GARAGE</p>
            <h2>{memberships[0]?.site?.name || "나의 게러지를 연결하세요"}</h2>
            <p>
              {memberships[0]?.unit_label ||
                "입주 단지 확인 후 전용 서비스를 이용할 수 있습니다."}
            </p>
            <small>확인된 차량 {vehicles.length}대</small>
          </div>
        )}
        <Link className="doelv-primary" to="/app/call">
          차량 호출 <span>↗</span>
        </Link>
        <div className="doelv-grid">
          <Link className="doelv-mini" to="/app/profile">
            <strong>입주 단지 연결</strong>
            <small>담당자에게 확인 요청</small>
          </Link>
          <Link className="doelv-mini" to="/app/garage">
            <strong>나의 게러지</strong>
            <small>차량 · 공간 확인</small>
          </Link>
        </div>
        <Link className="doelv-row" to="/app/requests">
          <div>
            <strong>내 요청 내역</strong>
            <small>
              {loading
                ? "조회 중"
                : error
                  ? "조회 상태 확인 필요"
                  : `${requests.length}건 · 접수 상태와 답변 확인`}
            </small>
          </div>
          <span>›</span>
        </Link>
        <p className="doelv-footnote">
          차량 운행 서비스는 현장 설비 검수 완료 후 이용 가능합니다.
        </p>
      </div>
    </>
  );
}
