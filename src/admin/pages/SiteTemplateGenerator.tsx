import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import {
  previewSiteTemplate,
  validateSiteTemplate,
  TEMPLATE_VERSION,
  type SiteKind,
  type SiteTemplateInput,
} from "../../lib/site-template";
type Blueprint = {
  id: string;
  site_id: string;
  template_version: string;
  definition: ReturnType<typeof previewSiteTemplate>;
  created_at: string;
};
export default function SiteTemplateGenerator() {
  const [input, setInput] = useState<SiteTemplateInput>({
    name: "",
    kind: "apartment",
    households: 100,
    parkingSpaces: 120,
  });
  const [preview, setPreview] = useState<ReturnType<
    typeof previewSiteTemplate
  > | null>(null);
  const [items, setItems] = useState<Blueprint[]>([]);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    Promise.resolve(
      supabase
        .from("platform_site_blueprints")
        .select("id,site_id,template_version,definition,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setError(
            "생성 이력을 조회하지 못했습니다. 관리자 인증과 연결을 확인해 주세요.",
          );
        else setItems((data || []) as Blueprint[]);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("연결 상태를 확인해 주세요.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);
  function change<K extends keyof SiteTemplateInput>(
    key: K,
    value: SiteTemplateInput[K],
  ) {
    setInput((p) => ({ ...p, [key]: value }));
    setPreview(null);
    setSuccess("");
    requestId.current = crypto.randomUUID();
  }
  function validate() {
    setError("");
    setSuccess("");
    const errors = validateSiteTemplate(input);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setPreview(previewSiteTemplate(input));
  }
  async function generate() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data, error } = await supabase.rpc("platform_generate_site", {
        p_request_id: requestId.current,
        p_name: input.name.trim(),
        p_kind: input.kind,
        p_households: input.households,
        p_parking_spaces: input.parkingSpaces,
      });
      if (error || !data) throw error;
      setSuccess(`검증용 단지 생성 완료 · ${data}`);
      setPreview(null);
      requestId.current = crypto.randomUUID();
      setLoading(true);
      setReload((n) => n + 1);
    } catch {
      setError(
        "생성하지 못했습니다. 최고관리자 2단계 인증, 입력값, 연결 상태를 확인해 주세요. 재시도는 같은 요청으로 처리됩니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        단지 템플릿 생성기
      </Typography>
      <Typography sx={{ my: 2 }}>
        표준 구성을 검토하고 독립된 검증용 단지를 만듭니다.
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        생성된 단지는 운영 준비 상태입니다. 회원·차량·관리자 권한·인증키는
        복사되지 않으며, 장비 운행·출입 허가·결제는 활성화되지 않습니다.
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Chip label={TEMPLATE_VERSION} size="small" />
          <Typography variant="h6" sx={{ my: 2 }}>
            1. 단지 구성
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label="단지명"
              value={input.name}
              disabled={busy}
              onChange={(e) => change("name", e.target.value)}
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <TextField
              select
              label="단지 유형"
              value={input.kind}
              disabled={busy}
              onChange={(e) => change("kind", e.target.value as SiteKind)}
            >
              <MenuItem value="apartment">아파트</MenuItem>
              <MenuItem value="officetel">오피스텔</MenuItem>
              <MenuItem value="mixed">복합 단지</MenuItem>
            </TextField>
            <TextField
              label="세대 수"
              type="number"
              value={input.households}
              disabled={busy}
              onChange={(e) => change("households", Number(e.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 10000, step: 1 } }}
            />
            <TextField
              label="주차면 수"
              type="number"
              value={input.parkingSpaces}
              disabled={busy}
              onChange={(e) => change("parkingSpaces", Number(e.target.value))}
              slotProps={{ htmlInput: { min: 0, max: 20000, step: 1 } }}
            />
          </Box>
          <Button
            sx={{ mt: 2 }}
            variant="outlined"
            onClick={validate}
            disabled={busy}
          >
            구성 검증 및 미리보기
          </Button>
          {preview && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6">2. 생성 내용 확인</Typography>
              <Typography sx={{ my: 2 }}>
                {preview.name} · {preview.capacity.households}세대 ·{" "}
                {preview.capacity.parking_spaces}면<br />
                DOELV 디자인 · 수동 입주 승인 · 요청 접수 모듈
                <br />새 단지 ID 발급 · 구성 버전 고정 · 생성 이력 기록
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                독립된 단지 레코드와 구성만 생성합니다. 실제 현장 개통은 단지
                권한·설비 연결·안전 검수·복구 훈련의 승인이 필요합니다.
              </Alert>
              <Button variant="contained" onClick={generate} disabled={busy}>
                {busy ? "생성 중…" : "검증용 단지 생성"}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
        생성된 단지 · 최근 100건
      </Typography>
      {loading ? (
        <p>이력을 불러오는 중입니다.</p>
      ) : !items.length && !error ? (
        <p>아직 생성된 단지가 없습니다.</p>
      ) : null}
      {items.map((item) => (
        <Card key={item.id} sx={{ mb: 2 }}>
          <CardContent>
            <Chip size="small" label="검증용 · 운행 미승인" color="warning" />
            <Typography variant="h6" sx={{ mt: 1 }}>
              {item.definition.name}
            </Typography>
            <Typography>
              {item.definition.capacity.households}세대 ·{" "}
              {item.definition.capacity.parking_spaces}면 ·{" "}
              {item.template_version}
            </Typography>
            <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
              단지 ID {item.site_id} ·{" "}
              {new Date(item.created_at).toLocaleString("ko-KR")}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              회원·차량·설비: 생성 시 미등록 / 운영 승인: 별도 검수 필요
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
