import { useEffect, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
export default function AdminSecurityGate({
  children,
}: {
  children: ReactNode;
}) {
  const { user, role, displayName, signOut } = useAuth();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false); setChecking(true); setFactor(""); setQr(""); setCode(""); setError("");
    Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
      .then(([level, factors]) => {
        if (!active) return;
        setReady(!level.error && !factors.error && level.data?.currentLevel === "aal2");
        setFactor(
          factors.data?.totp.find((f) => f.status === "verified")?.id || "",
        );
        if (level.error || factors.error)
          setError(
            "보안 인증 정보를 확인하지 못했습니다. 다시 로그인해 주세요.",
          );
      })
      .catch(() => {
        if (active) setError("보안 인증 정보를 확인하지 못했습니다.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `SkyGarage Admin ${Date.now()}`,
      });
      if (error || !data) throw error;
      setFactor(data.id);
      setQr(data.totp.qr_code);
    } catch {
      setError("인증 앱 등록을 시작하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (error) throw error;
      const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || data?.currentLevel !== "aal2") throw new Error("assurance_not_confirmed");
      setReady(true);
      setQr("");
      setCode("");
    } catch {
      setReady(false);
      setError("인증번호와 휴대전화의 자동 시간 설정을 확인한 뒤 다시 입력해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  if (ready) return children;
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        bgcolor: "#081521",
        color: "#f8f5f0",
        p: 3,
      }}
    >
      <Box sx={{ maxWidth: 520, width: "100%", "& .MuiButton-contained.Mui-disabled": { bgcolor: "#253746", color: "#b8c4cf" } }}>
        <Typography variant="h5">관리자 2단계 인증</Typography>
        <p>
          {displayName || "관리자"}님 ·{" "}
          {role === "super_admin" ? "총괄 최고관리자" : "관리자"}
        </p>
        <p>운영 관리 화면은 휴대전화 인증 앱의 일회용 번호로 추가 확인합니다.</p>
        <Alert severity="info" sx={{ mb: 2 }}>
          Google Authenticator(구글 OTP) 또는 Microsoft Authenticator 중 하나를 사용하세요. 이 앱이 주기적으로 생성하는 6자리 번호가 필요합니다.
        </Alert>
        <Box component="ol" sx={{ pl: 3, lineHeight: 1.8 }}>
          <li>휴대전화의 공식 앱 스토어에서 인증 앱을 설치합니다.</li>
          <li>처음 등록하면 아래에서 등록을 시작한 뒤, 앱의 계정 추가·QR 스캔으로 연결합니다.</li>
          <li>앱에 표시된 스카이게러지 계정의 6자리 번호를 입력합니다. 이미 등록했다면 기존 계정을 사용합니다.</li>
        </Box>
        <Typography variant="body2" sx={{ color: '#c6d4df', mb: 2 }}>문자 인증번호나 PASS 알림을 기다리는 방식이 아닙니다. 휴대전화 분실 시 다른 최고관리자 또는 계정 운영 담당자에게 본인 확인을 통한 복구를 요청하세요.</Typography>
        {error && <Alert severity="error" action={<Button color="inherit" onClick={() => window.location.reload()}>다시 확인</Button>}>{error}</Alert>}
        {qr && (
          <>
            <p>인증 앱으로 QR 코드를 스캔한 후 6자리 번호를 입력하세요. 이 QR 코드는 계정 등록 정보이므로 공유하지 마세요.</p>
            <img
              src={qr}
              alt="인증 앱 등록 QR 코드"
              width="220"
              height="220"
              style={{ background: "#fff", padding: 10 }}
            />
          </>
        )}
        {factor ? (
          <Box
            component="form"
            onSubmit={verify}
            sx={{ display: "grid", gap: 2, mt: 2 }}
          >
            <TextField
              label="인증 앱 6자리 번호"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoComplete="one-time-code"
              slotProps={{
                htmlInput: { inputMode: "numeric", pattern: "[0-9]{6}" },
                input: { sx: { color: "#fff" } },
                inputLabel: { sx: { color: "#ccc" } },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={busy || code.length !== 6}
            >
              인증하고 관리 화면 열기
            </Button>
          </Box>
        ) : (
          <Button
            variant="contained"
            onClick={enroll}
            disabled={busy || !!error}
          >
            인증 앱 등록하기
          </Button>
        )}
        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button component="a" href="/app">
            공식 앱으로
          </Button>
          <Button onClick={signOut}>로그아웃</Button>
        </Box>
      </Box>
    </Box>
  );
}
