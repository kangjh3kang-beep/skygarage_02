import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NearMeOutlined from "@mui/icons-material/NearMeOutlined";
import ArrowForward from "@mui/icons-material/ArrowForward";
import DirectionsCarOutlined from "@mui/icons-material/DirectionsCarOutlined";
import LocalParkingOutlined from "@mui/icons-material/LocalParkingOutlined";
import NfcOutlined from "@mui/icons-material/NfcOutlined";
import ApartmentOutlined from "@mui/icons-material/ApartmentOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import { useSgpAuth } from "../contexts/SgpAuthContext";
import { supabase } from "../../lib/supabase";
import type { SgpComplexMembership, SgpParkingPayment } from "../types";

const paymentLabels: Record<SgpParkingPayment["status"], string> = {
  pending: "정산 대기",
  completed: "결제 완료",
  refunded: "환불 완료",
};

export default function SgpHomePage() {
  const { user, wallet } = useSgpAuth();
  const [memberships, setMemberships] = useState<SgpComplexMembership[]>([]);
  const [payments, setPayments] = useState<SgpParkingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      supabase
        .from("sgp_complex_memberships")
        .select("*, complex:complexes(id, name, address)")
        .eq("user_id", user.id)
        .eq("request_status", "approved"),
      supabase
        .from("sgp_parking_payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ])
      .then(([membershipResult, paymentResult]) => {
        if (!active) return;
        if (membershipResult.error || paymentResult.error) {
          setError(true);
        } else {
          setMemberships(membershipResult.data || []);
          setPayments(paymentResult.data || []);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, reload]);
  const hour = new Date().getHours();
  const greeting =
    hour < 6
      ? "편안한 새벽이에요"
      : hour < 12
        ? "좋은 아침이에요"
        : hour < 18
          ? "좋은 오후예요"
          : "좋은 저녁이에요";

  return (
    <div className="sg-home">
      <div className="sg-welcome">
        <div>
          <p className="sg-eyebrow">YOUR DAILY MOBILITY</p>
          <h1>
            {greeting},<br />
            <span>{user?.display_name || "사용자"}님.</span>
          </h1>
          <p className="sg-muted">오늘의 이동도, 여유롭게 시작하세요.</p>
        </div>
        <span className="sg-date">
          {new Date().toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </span>
      </div>
      <section className="sg-hero" aria-labelledby="sg-hero-title">
        <div className="sg-hero-copy">
          <span className="sg-pill">MY PARKING</span>
          <h2 id="sg-hero-title">
            주차부터 이동까지,
            <br />내 손안의 게러지.
          </h2>
          <p>
            내 주차 내역과 차량 위치를
            <br />
            한곳에서 편리하게 확인하세요.
          </p>
          <Link className="sg-button sg-button-mint" to="/app/parking">
            내 주차 확인
            <ArrowForward fontSize="small" />
          </Link>
        </div>
        <div className="sg-garage-art" aria-hidden="true">
          <div className="sg-garage-frame" />
          <div className="sg-garage-frame sg-frame-inner" />
          <div className="sg-parking-line" />
          <DirectionsCarOutlined className="sg-car-art" />
          <span>SKY GARAGE / PRIVATE MOBILITY</span>
        </div>
      </section>
      <section className="sg-shortcuts" aria-label="빠른 서비스">
        {[
          {
            path: "/app/map",
            icon: <NearMeOutlined />,
            title: "내 차 위치",
            sub: "위치 확인",
          },
          {
            path: "/app/spots",
            icon: <LocalParkingOutlined />,
            title: "주차면 찾기",
            sub: "빈자리 확인",
          },
          {
            path: "/app/pay",
            icon: <NfcOutlined />,
            title: "간편 결제",
            sub: "NFC · 주차 정산",
          },
          {
            path: "/app/profile",
            icon: <ApartmentOutlined />,
            title: "내 단지",
            sub: "등록 및 관리",
          },
        ].map((item) => (
          <Link to={item.path} key={item.path} className="sg-shortcut">
            <span className="sg-shortcut-icon">{item.icon}</span>
            <strong>{item.title}</strong>
            <small>{item.sub}</small>
          </Link>
        ))}
      </section>
      <div className="sg-home-columns">
        <section
          className="sg-panel sg-wallet-panel"
          aria-labelledby="sg-wallet-title"
        >
          <div className="sg-section-heading">
            <h2 id="sg-wallet-title">
              <AccountBalanceWalletOutlined fontSize="small" />내 지갑
            </h2>
            <Link to="/app/wallet">
              관리
              <ArrowForward />
            </Link>
          </div>
          <p className="sg-muted">사용 가능한 코인</p>
          <p className="sg-balance">
            {wallet ? wallet.balance.toLocaleString() : "—"}
            <span>C</span>
          </p>
          <Link className="sg-button sg-button-outline" to="/app/wallet">
            충전 · 이용내역
            <ArrowForward fontSize="small" />
          </Link>
        </section>
        <section className="sg-panel" aria-labelledby="sg-complex-title">
          <div className="sg-section-heading">
            <h2 id="sg-complex-title">나의 단지</h2>
            <Link to="/app/profile">
              관리
              <ArrowForward />
            </Link>
          </div>
          {loading ? (
            <p className="sg-empty" role="status">
              단지 정보를 불러오고 있어요.
            </p>
          ) : error ? (
            <p className="sg-empty">단지 정보를 확인할 수 없습니다.</p>
          ) : memberships.length ? (
            <div className="sg-complex-list">
              {memberships.map((m) => (
                <Link to="/app/profile" key={m.id} className="sg-complex">
                  <span className="sg-complex-icon">
                    <ApartmentOutlined />
                  </span>
                  <span>
                    <strong>{m.complex?.name || "등록 단지"}</strong>
                    <small>
                      {[
                        m.building_dong && `${m.building_dong}동`,
                        m.unit_number && `${m.unit_number}호`,
                      ]
                        .filter(Boolean)
                        .join(" ") || "입주 정보 확인"}
                    </small>
                  </span>
                  <ArrowForward />
                </Link>
              ))}
            </div>
          ) : (
            <div className="sg-empty">
              <ApartmentOutlined />
              <p>나의 단지를 연결해 주세요.</p>
              <Link to="/app/profile">
                단지 등록하기
                <ArrowForward fontSize="small" />
              </Link>
            </div>
          )}
        </section>
      </div>
      <section
        className="sg-panel sg-activity"
        aria-labelledby="sg-activity-title"
      >
        <div className="sg-section-heading">
          <h2 id="sg-activity-title">최근 이용</h2>
          <Link to="/app/parking">
            전체 보기
            <ArrowForward />
          </Link>
        </div>
        {loading ? (
          <p className="sg-empty" role="status">
            이용내역을 불러오고 있어요.
          </p>
        ) : error ? (
          <div className="sg-empty" role="alert">
            <p>정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
            <button
              type="button"
              className="sg-text-button"
              onClick={() => {
                setLoading(true);
                setError(false);
                setReload((value) => value + 1);
              }}
            >
              다시 불러오기
            </button>
          </div>
        ) : payments.length ? (
          payments.map((p) => (
            <Link to="/app/parking" className="sg-payment" key={p.id}>
              <span className="sg-payment-icon">
                <DirectionsCarOutlined />
              </span>
              <span className="sg-payment-copy">
                <strong>{p.vehicle_plate}</strong>
                <small>
                  {new Date(p.entry_at).toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                  })}
                  {p.duration_minutes > 0 ? ` · ${p.duration_minutes}분` : ""}
                </small>
              </span>
              <span className="sg-payment-end">
                <span className={`sg-status sg-status-${p.status}`}>
                  {paymentLabels[p.status]}
                </span>
                <small>{p.amount_coins.toLocaleString()} C</small>
              </span>
            </Link>
          ))
        ) : (
          <div className="sg-empty">
            <DirectionsCarOutlined />
            <p>아직 이용내역이 없어요.</p>
            <span>주차 서비스를 이용하면 이곳에서 확인할 수 있어요.</span>
          </div>
        )}
      </section>
      <footer className="sg-home-footer">
        SKY GARAGE<span>일상의 이동에 여유를 더하다.</span>
      </footer>
    </div>
  );
}
