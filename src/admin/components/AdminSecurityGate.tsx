import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  MenuItem,
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
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [choices, setChoices] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [reload, setReload] = useState(0);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0), inFlight = useRef(false), actor = useRef(user?.id);
  actor.current = user?.id;
  useEffect(() => {
    let active = true;
    const userId = user?.id;
    const current = () => active && actor.current === userId;
    ++generation.current; inFlight.current = false; setBusy(false);
    setReady(false); setChecking(true); setFactor(""); setQr(""); setSecret(""); setShowSecret(false); setChoices([]); setPendingCount(0); setCode(""); setError("");
    Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
      .then(([level, factors]) => {
        if (!current()) return;
        const all = factors.data?.all ?? factors.data?.totp ?? [];
        const verified = (factors.data?.totp ?? []).filter(f => f.status === 'verified');
        setReady(!level.error && !factors.error && level.data?.currentLevel === "aal2" && verified.length > 0);
        setChoices(verified);
        setPendingCount(all.filter(f => f.status === 'unverified' && (!('factor_type' in f) || f.factor_type === 'totp')).length);
        setFactor(verified[0]?.id || "");
        if (level.error || factors.error)
          setError(
            "보안 인증 정보를 확인하지 못했습니다. 다시 로그인해 주세요.",
          );
      })
      .catch(() => {
        if (current()) setError("보안 인증 정보를 확인하지 못했습니다.");
      })
      .finally(() => {
        if (current()) setChecking(false);
      });
    return () => {
      active = false;
      ++generation.current;
    };
  }, [user?.id, reload]);
  async function enroll() {
    if (inFlight.current || !user || factor) return;
    const version = generation.current, userId = user.id;
    const current = () => generation.current === version && actor.current === userId;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: 'DOELV SkyGarage',
        friendlyName: `SkyGarage Admin ${Date.now()}`,
      });
      if (!current()) return;
      if (error || !data) throw error;
      setFactor(data.id);
      const rawQr = data.totp.qr_code;
      setQr(rawQr.trim().startsWith('<svg') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawQr)}` : rawQr);
      setSecret(data.totp.secret || '');
    } catch {
      if (current()) setError("인증 앱 등록을 시작하지 못했습니다. 미완료 등록이 있다면 정리한 뒤 다시 시도해 주세요.");
    } finally {
      if (current()) { inFlight.current = false; setBusy(false); }
    }
  }
  async function clearPending() {
    if (inFlight.current || !user || factor) return;
    const version = generation.current, userId = user.id;
    const current = () => generation.current === version && actor.current === userId;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await supabase.auth.mfa.listFactors();
      if (!current()) return;
      if (result.error) throw result.error;
      // Re-read status immediately before cleanup. Verified factors are never removed.
      for (const f of result.data.all ?? result.data.totp) {
        if (f.status !== 'unverified' || f.factor_type !== 'totp') continue;
        if (!current()) return;
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) throw error;
      }
      if (current()) setReload(x => x + 1);
    } catch {
      if (current()) setError('미완료 등록을 정리하지 못했습니다. 다시 조회하거나 계정 운영 담당자에게 문의하세요.');
    } finally {
      if (current()) { inFlight.current = false; setBusy(false); }
    }
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !user || !factor || !/^\d{6}$/.test(code)) return;
    const version = generation.current, userId = user.id;
    const current = () => generation.current === version && actor.current === userId;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (!current()) return;
      if (error) throw error;
      const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!current()) return;
      if (assuranceError || data?.currentLevel !== "aal2") throw new Error("assurance_not_confirmed");
      setReady(true);
      setQr("");
      setSecret(""); setShowSecret(false);
      setCode("");
    } catch {
      if (current()) {
        setReady(false);
        setError("인증번호와 휴대전화의 자동 시간 설정을 확인한 뒤 다시 입력해 주세요. 새 번호가 표시되면 다시 입력하세요.");
      }
    } finally {
      if (current()) { inFlight.current = false; setBusy(false); }
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
        {error && <Alert severity="error" action={<Button color="inherit" disabled={busy} onClick={() => setReload(x => x + 1)}>다시 확인</Button>}>{error}</Alert>}
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
            {secret && <Box component="details" sx={{ mt: 2, p: 2, bgcolor: '#142838', borderRadius: 2 }}>
              <Box component="summary" sx={{ cursor: 'pointer' }}>같은 휴대전화에서 설정하거나 QR을 스캔할 수 없나요?</Box>
              <p>인증 앱에서 계정 추가 → 설정 키 직접 입력을 선택하세요. 계정 이름은 DOELV, 키 유형은 시간 기반으로 설정하고 아래 키를 입력합니다. 앱마다 메뉴 이름은 다를 수 있습니다.</p>
              <TextField fullWidth label="인증 앱 수동 설정 키" type={showSecret ? 'text' : 'password'} value={secret} autoComplete="off" slotProps={{ input: { readOnly: true, sx: { color: '#fff' } }, inputLabel: { sx: { color: '#ccc' } } }} />
              <Button onClick={() => setShowSecret(v => !v)}>{showSecret ? '설정 키 숨기기' : '설정 키 표시'}</Button>
              <Typography variant="body2">설정 키와 QR은 계정 인증 정보입니다. 채팅·메일·화면 캡처로 공유하지 마세요. 인증 완료 또는 화면을 나가면 이 화면에서 지워집니다.</Typography>
            </Box>}
          </>
        )}
        {factor ? (
          <Box
            component="form"
            onSubmit={verify}
            sx={{ display: "grid", gap: 2, mt: 2 }}
          >
            {choices.length > 1 && <TextField select slotProps={{ input: { sx: { color: "#fff" } }, inputLabel: { sx: { color: "#ccc" } } }} label="사용할 인증 앱" value={factor} onChange={e => { setFactor(e.target.value); setCode(''); }} disabled={busy}>{choices.map((f, i) => <MenuItem key={f.id} value={f.id}>{f.friendly_name || `등록 인증 앱 ${i + 1}`}</MenuItem>)}</TextField>}
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
          <><Button
            variant="contained"
            onClick={enroll}
            disabled={busy || !!error}
          >
            인증 앱 등록하기
          </Button>{pendingCount > 0 && <Box sx={{ mt: 2 }}><Typography>인증을 끝내지 않은 등록 {pendingCount}개가 있습니다. 이전 QR을 잃어버렸다면 정리 후 새로 등록할 수 있습니다.</Typography><Button onClick={clearPending} disabled={busy}>미완료 등록 정리</Button></Box>}</>
        )}
        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button component="a" href="/app">
            공식 앱으로
          </Button>
          <Button onClick={signOut}>로그아웃</Button>
          <Button component="a" href="/help">전체 사용 안내</Button>
        </Box>
      </Box>
    </Box>
  );
}
