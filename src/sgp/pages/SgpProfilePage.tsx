import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PhotoHero } from "../components/BrandImagery";
import ServiceRequestForm from "../components/ServiceRequestForm";
import PwaInstallPrompt from "../components/PwaInstallPrompt";
import { useSgpAuth } from "../contexts/SgpAuthContext";
import { supabase } from "../../lib/supabase";
import MemberEnrollment from "../components/MemberEnrollment";
import { useResidentData } from "../contexts/ResidentDataContext";
export default function SgpProfilePage() {
  const { user, signOut } = useSgpAuth();
  const { reload: reloadResidentData } = useResidentData();
  const userId = user?.id;
  const [admin, setAdmin] = useState(false);
  const [form, setForm] = useState<"residence" | "concierge">("residence");
  useEffect(() => {
    let active = true;
    if (userId)
      void supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (active) setAdmin(!error && data?.role === "super_admin");
        });
    return () => {
      active = false;
    };
  }, [userId]);
  return (
    <>
      <PhotoHero photo="profile" />
      <div className="doelv-content">
        <p className="doelv-eyebrow">YOUR DOELV RESIDENCE</p>
        <h1>설정 · 컨시어지</h1>
        <div className="doelv-card">
          <p className="doelv-eyebrow">MEMBER ACCOUNT</p>
          <h2>{user?.display_name}님</h2>
          <p>{user?.phone}</p>
          <span className="doelv-badge">
            {user?.is_verified ? "휴대폰 인증 완료" : "휴대폰 인증 확인 필요"}
          </span>
          <p className="doelv-muted">PASS 본인확인은 추후 제공 예정입니다.</p>
        </div>
        {admin && (
          <Link className="doelv-row" to="/admin">
            <div>
              <strong>총괄 최고관리자</strong>
              <small>운영 준비 현황 · 요청 관리</small>
            </div>
            <span>↗</span>
          </Link>
        )}
        <Link className="doelv-row" to="/app/requests">
          <strong>내 요청 내역</strong>
          <span>›</span>
        </Link>
        <Link className="doelv-row" to="/help"><strong>설정·사용 방법 전체 보기</strong><span>›</span></Link>
        {userId && <MemberEnrollment key={userId} userId={userId} verified={user?.is_verified === true && !!user.phone_verified_at} onMembershipChange={reloadResidentData} />}
        <div className="doelv-grid">
          <button
            type="button"
            className="doelv-mini"
            aria-pressed={form === "residence"}
            onClick={() => setForm("residence")}
          >
            <strong>입주 단지 연결 문의</strong>
          </button>
          <button
            type="button"
            className="doelv-mini"
            aria-pressed={form === "concierge"}
            onClick={() => setForm("concierge")}
          >
            <strong>운영센터 문의</strong>
          </button>
        </div>
        <ServiceRequestForm key={form} category={form} />
        <PwaInstallPrompt />
        <a className="doelv-row" href="/app-update?returnTo=%2Fapp%2Fprofile">
          <div><strong>화면 업데이트</strong><small>이전 디자인이 보일 때 최신 화면 불러오기</small></div>
          <span>↗</span>
        </a>
        <button className="doelv-secondary" type="button" onClick={signOut}>
          로그아웃
        </button>
      </div>
    </>
  );
}
