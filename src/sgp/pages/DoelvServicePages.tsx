import { Link } from "react-router-dom";
import { PhotoHero } from "../components/BrandImagery";
import ServiceRequestForm from "../components/ServiceRequestForm";
import { requestStatusLabels } from "../request-labels";
import { useResidentData } from "../contexts/ResidentDataContext";
export function DataState() {
  const { loading, error, reload } = useResidentData();
  return loading ? (
    <p role="status" className="doelv-notice">
      내 정보를 불러오는 중입니다.
    </p>
  ) : error ? (
    <div role="alert" className="doelv-notice">
      정보를 불러오지 못했습니다.{" "}
      <button onClick={reload}>다시 불러오기</button>
    </div>
  ) : null;
}
export function CallPage() {
  const { vehicles, memberships, loading, error } = useResidentData();
  const active = memberships.some((m) => m.status === "active");
  return (
    <>
      <PhotoHero photo="call" />
      <div className="doelv-content">
        <p className="doelv-eyebrow">CALL YOUR VEHICLE</p>
        <h1>차량 호출</h1>
        <DataState />
        <div className="doelv-card">
          <p className="doelv-eyebrow">YOUR REGISTERED VEHICLE</p>
          <h2>
            {loading
              ? "조회 중"
              : error
                ? "확인 필요"
                : vehicles.length
                  ? vehicles[0].model
                  : "등록 차량이 없습니다"}
          </h2>
          <p>
            {vehicles[0]?.plate ||
              "차량 등록 요청 후 담당자 확인이 필요합니다."}
          </p>
          <div className="doelv-steps">
            <span>계정 인증</span>
            <span>{active ? "소속 확인" : "소속 미연결"}</span>
            <span>설비 연동 대기</span>
          </div>
        </div>
        <button className="doelv-primary" disabled>
          설비 연동 후 호출 가능
        </button>
        <p className="doelv-notice">
          현재 운행 현장 검수가 완료되지 않아 차량 호출을 제공하지 않습니다.
          실제 주차 위치와 예상 도착 시간은 설비 연결 후 표시됩니다.
        </p>
        <Link className="doelv-row" to="/app/garage">
          차량 등록 요청 <span>›</span>
        </Link>
      </div>
    </>
  );
}
export function GaragePage() {
  const { memberships, vehicles, loading, error } = useResidentData();
  return (
    <>
      <PhotoHero photo="garage" />
      <div className="doelv-content">
        <p className="doelv-eyebrow">PRIVATE SKY GARAGE</p>
        <h1>나의 스카이게러지</h1>
        <DataState />
        {!loading && !error && (
          <div className="doelv-card">
            <h2>{memberships[0]?.site?.name || "연결된 단지가 없습니다"}</h2>
            <p>
              {memberships[0]?.unit_label ||
                "입주 정보를 확인한 후 나의 게러지가 연결됩니다."}
            </p>
            <p>확인된 차량 {vehicles.length}대</p>
            {vehicles.map((v) => (
              <p key={v.id}>
                {v.model} · {v.plate}
              </p>
            ))}
          </div>
        )}
        <div className="doelv-row">
          <div>
            <strong>차량용 엘리베이터 · ATR</strong>
            <small>장비 연결 및 현장 검수 대기</small>
          </div>
          <span className="doelv-badge">연동 전</span>
        </div>
        <ServiceRequestForm category="vehicle" />
      </div>
    </>
  );
}
export function AccessPage() {
  return (
    <>
      <PhotoHero photo="access" />
      <div className="doelv-content">
        <p className="doelv-eyebrow">YOUR SECURE ARRIVAL</p>
        <h1>출입 · 방문 서비스</h1>
        <div className="doelv-card">
          <h2>방문 이용 안내</h2>
          <p>
            방문객 출입권 발급과 출입 기록은 운영 현장 연결 후 제공됩니다.
            지금은 이용 문의를 접수할 수 있습니다.
          </p>
        </div>
        <ServiceRequestForm category="visit" />
      </div>
    </>
  );
}
export function RequestsPage() {
  const { requests, loading, error, reload } = useResidentData();
  return (
    <><PhotoHero photo="requests" /><div className="doelv-content">
      <p className="doelv-eyebrow">YOUR SERVICE HISTORY</p>
      <h1>내 요청 내역</h1>
      <p className="doelv-muted">최근 요청 30건을 표시합니다. 이전 요청은 접수번호를 적어 운영센터에 문의하세요. 목표 기한은 운영상 안내이며 자동 알림·계약상 SLA와 별개입니다.</p>
      <button type="button" className="doelv-secondary" disabled={loading} onClick={reload}>내 요청 새로 조회</button>
      <DataState />
      {!loading && !error && !requests.length && (
        <p className="doelv-notice">아직 접수한 요청이 없습니다.</p>
      )}
      {requests.map((r) => (
        <article className="doelv-card" key={r.id}>
          <span className="doelv-badge">{requestStatusLabels[r.status]}</span>
          <h2>{r.subject}</h2>
          <p>{r.site_name??'본사 공통 문의'} · 목표 기한 {r.due_at?new Date(r.due_at).toLocaleString('ko-KR'):'미설정'}{r.overdue?' · 기한 초과':''}</p>
          <p className="doelv-preline">{r.description}</p>
          <small>
            {new Date(r.created_at).toLocaleString("ko-KR")} ·{" "}
            {r.id.slice(0, 8)}
          </small>
          {r.response && (
            <div className="doelv-response">
              <strong>운영센터 답변</strong>
              <p className="doelv-preline">{r.response}</p>
            </div>
          )}
        </article>
      ))}
    </div></>
  );
}
export function WalletPage() {
  return (
    <><PhotoHero photo="wallet" /><div className="doelv-content">
      <p className="doelv-eyebrow">PAYMENTS</p>
      <h1>결제 서비스 준비 중</h1>
      <p className="doelv-notice">
        결제 사업자 연동과 정산 검증이 완료된 후 제공됩니다. 현재 앱에서
        충전·결제·환불을 진행할 수 없습니다.
      </p>
      <Link className="doelv-row" to="/app/profile">
        운영센터 문의 <span>›</span>
      </Link>
    </div></>
  );
}
