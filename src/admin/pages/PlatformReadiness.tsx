import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { ServiceRequest } from "../../sgp/contexts/ResidentDataContext";
import { requestStatusLabels } from "../../sgp/request-labels";
export default function PlatformReadiness() {
  const { displayName, user } = useAuth();
  const [response, setResponse] = useState<{key:string;requests:ServiceRequest[];sites:number;error:string}|null>(null);
  const [actionError, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const requestKey = `${user?.id}:${reload}`;
  const current = response?.key === requestKey ? response : null;
  const loading = !current;
  const requests = current?.requests ?? [];
  const sites = current?.sites ?? 0;
  const error = actionError || current?.error || "";
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    Promise.all([
      supabase
        .from("sgp_service_requests")
        .select("id,category,subject,description,status,response,created_at")
        .order("created_at", { ascending: false })
        .limit(100).abortSignal(controller.signal),
      supabase
        .from("platform_sites")
        .select("id", { count: "exact", head: true }).abortSignal(controller.signal),
    ])
      .then(([r, s]) => {
        if (!active) return;
        if (r.error || s.error || !Array.isArray(r.data) || !Number.isSafeInteger(s.count) || (s.count ?? -1) < 0)
          setResponse({key:requestKey,requests:[],sites:0,error:"운영 정보를 불러오지 못했습니다. 관리자 인증을 다시 확인해 주세요."});
        else {
          setResponse({key:requestKey,requests:r.data as ServiceRequest[],sites:s.count as number,error:""});
        }
      })
      .catch(() => {
        if (active) setResponse({key:requestKey,requests:[],sites:0,error:"서버 연결을 확인해 주세요."});
      }).finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [requestKey]);
  async function review(
    id: string,
    status: "reviewing" | "resolved" | "rejected",
  ) {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("sgp_service_requests")
        .update({ status, response: reply[id]?.trim() || null })
        .eq("id", id)
        .in("status", ["submitted", "reviewing"])
        .select("id");
      if (error || !data?.length) throw error;
      setReload((n) => n + 1);
    } catch {
      setError(
        "처리하지 못했습니다. 완료·반려에는 답변이 필요하며, 이미 종료된 요청은 수정할 수 없습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        플랫폼 운영 준비
      </Typography>
      <Typography sx={{ my: 2 }}>{displayName} · 총괄 최고관리자</Typography>
      <Button component={Link} to="/admin/implementation" variant="outlined" sx={{mb:2}}>통합시스템 구축·검증 현황</Button>
      <Alert severity="info" sx={{ mb: 3 }}>
        앱 계정과 요청 접수는 운영 중입니다. 현장 운행·출입·결제는 별도 검수
        전까지 차단되어 있습니다.
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button onClick={() => {setError("");setReload((n) => n + 1);}}>다시 조회</Button>
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <Chip label={loading ? '현장 확인 중' : error ? '현장 수 확인 불가' : `등록 현장 ${sites}곳`} />
        <Chip label={loading ? '요청 확인 중' : error ? '요청 수 확인 불가' : `조회 요청 ${requests.length}건`} />
        <Chip label="실장비 운행 미승인" color="warning" />
      </Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        입주민 요청
      </Typography>
      {loading && <p role="status">운영 정보를 확인하고 있습니다.</p>}
      {!loading && !error && !requests.length && <p>접수된 요청이 없습니다.</p>}
      {!loading && !error && requests.map((r) => (
        <Card key={r.id} sx={{ mb: 2 }}>
          <CardContent>
            <Chip label={requestStatusLabels[r.status]} size="small" />
            <Typography variant="h6" sx={{ mt: 1 }}>
              {r.subject}
            </Typography>
            <Typography
              sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", my: 1 }}
            >
              {r.description}
            </Typography>
            <Typography variant="caption">
              {new Date(r.created_at).toLocaleString("ko-KR")} ·{" "}
              {r.id.slice(0, 8)}
            </Typography>
            {r.response && (
              <Alert severity="info" sx={{ my: 2 }}>
                {r.response}
              </Alert>
            )}
            {["submitted", "reviewing"].includes(r.status) && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="담당자 답변"
                  value={reply[r.id] || ""}
                  onChange={(e) =>
                    setReply({ ...reply, [r.id]: e.target.value })
                  }
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                />
                <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                  <Button
                    onClick={() => review(r.id, "reviewing")}
                    disabled={busy}
                  >
                    검토 중으로
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => review(r.id, "resolved")}
                    disabled={busy || !reply[r.id]?.trim()}
                  >
                    답변 완료
                  </Button>
                  <Button
                    color="error"
                    onClick={() => review(r.id, "rejected")}
                    disabled={busy || !reply[r.id]?.trim()}
                  >
                    반려
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
      <Typography variant="body2" color="text.secondary">
        가맹점 운영 개시는 권한 격리·회원 확인·설비 계약 시험·현장 안전
        검수·복구 훈련을 통과한 뒤 승인합니다.
      </Typography>
    </Box>
  );
}
