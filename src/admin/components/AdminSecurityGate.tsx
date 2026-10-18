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
  const { role, displayName, signOut } = useAuth();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
      .then(([level, factors]) => {
        if (!active) return;
        setReady(level.data?.currentLevel === "aal2");
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
  }, []);
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
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setReady(data?.currentLevel === "aal2");
      setQr("");
      setCode("");
    } catch {
      setError("인증번호를 확인한 뒤 다시 입력해 주세요.");
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
      <Box sx={{ maxWidth: 420, width: "100%" }}>
        <Typography variant="h5">관리자 2단계 인증</Typography>
        <p>
          {displayName || "관리자"}님 ·{" "}
          {role === "super_admin" ? "총괄 최고관리자" : "관리자"}
        </p>
        <p>운영 관리 화면은 인증 앱의 일회용 번호로 추가 확인합니다.</p>
        {error && <Alert severity="error">{error}</Alert>}
        {qr && (
          <>
            <p>인증 앱으로 QR 코드를 스캔한 후 6자리 번호를 입력하세요.</p>
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
