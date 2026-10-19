import { useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { parseGovernanceDirectory } from '../../lib/governance';
import { parseReadinessSnapshot } from '../../lib/readiness-snapshot';
import { onboardingAcceptance, onboardingEvidencePath, parseDeploymentRelease } from '../../lib/onboarding';
import { useAuth } from '../contexts/AuthContext';
import { useGovernanceQuery } from '../hooks/useGovernanceQuery';

export default function GettingStarted() {
  const { user, role } = useAuth();
  const [reload, setReload] = useState(0);
  const key = `${user?.id}:${role}:${reload}`;
  const directory = useGovernanceQuery('platform_governance_directory', {}, key, parseGovernanceDirectory);
  const readiness = useGovernanceQuery('platform_readiness_snapshot', {}, key, parseReadinessSnapshot, role === 'super_admin');
  const [authCheck, setAuthCheck] = useState<{ key: string; verified: boolean; error: string } | null>(null);
  const [build, setBuild] = useState<{ key: string; release: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    void Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]).then(([a, f]) => {
      if (!active) return;
      const verified = !a.error && !f.error && a.data?.currentLevel === 'aal2' && f.data?.totp.some(x => x.status === 'verified');
      setAuthCheck({ key, verified: !!verified, error: verified ? '' : '인증 상태를 확인하지 못했습니다. 다시 로그인해 인증 앱으로 확인해 주세요.' });
    }).catch(() => { if (active) setAuthCheck({ key, verified: false, error: '인증 상태를 조회하지 못했습니다.' }); });
    void fetch('/app-version.json', { cache: 'no-store', signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('release_fetch_failed'); return parseDeploymentRelease(await r.json()); })
      .then(release => { if (active) setBuild({ key, release }); }).catch(() => { if (active) setBuild({ key, release: null }); }).finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [key]);
  const auth = authCheck?.key === key ? authCheck : null;
  const release = build?.key === key ? build.release : null;
  function downloadProcedure() {
    const file = { schema_version: 1, kind: 'acceptance_procedure', generated_at: new Date().toISOString(), deployment_release: release, cases: onboardingAcceptance.map(c => ({ ...c, actual_result: null, evidence_url: null, reviewed_by: null })), acceptance_granted: false };
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'doelv-g0-acceptance-procedure.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const cards = [
    { title: '1 계정과 2단계 인증', state: !auth ? '확인 중' : auth.verified ? '현재 계정 인증 확인' : '재확인 필요', text: auth?.error || '현재 계정의 인증만 확인합니다. 다른 검수자도 본인 계정에서 인증 앱 등록과 로그인을 완료해야 합니다.', path: '/help', action: '인증·사용 안내' },
    { title: '2 운영 조직과 현장', state: directory.loading ? '확인 중' : directory.error ? '조회 실패' : directory.data?.sites.length ? '접근 가능한 현장 있음' : '현장 설정 필요', text: directory.error || (directory.data?.headquarters ? '운영 조직 등록 → 검증용 단지 생성 → 현장 선택 순서로 설정하세요.' : '최고관리자에게 본인 계정의 현장 담당 또는 검수 권한을 요청하세요.'), path: '/admin/governance', action: '조직·현장 확인' },
    { title: '3 업무 작성자와 검수자', state: '실제 계정 검수 필요', text: '현장 담당자와 다른 검수자를 지정하세요. 계정 수나 인증 등록 수만으로 독립 검수 완료를 판단하지 않습니다.', path: '/admin/governance', action: '현장 담당 권한 설정' },
    { title: '4 버전과 검증 범위', state: directory.loading ? '확인 중' : directory.error ? '조회 실패' : directory.data?.sites.some(s => s.validation_scope_id) ? '검증 범위 등록됨' : '검증 범위 설정 필요', text: '현장과 실제 시험할 버전을 선택하세요. 아래 배포 버전은 현재 웹 화면의 버전이며, 등록된 모든 현장이 이 버전으로 검수됐다는 뜻은 아닙니다.', path: '/admin/governance', action: '검증 범위 지정' },
    { title: '5 실패 분석과 독립 검수', state: '원자료로 검수', text: '시험 실패를 개선 과제로 등록하고 수정 후 같은 조건으로 재시험하세요. 다른 검수자가 근거와 유효기간을 확인해야 완료됩니다.', path: '/admin/governance', action: '증거·개선 과제 관리' },
    { title: '6 결제와 회계 연결 확인', state: '시험 거래 전용', text: '시험 시설·요금 → 시험 코인·결제 → 수수료·현장금 → ERP 전달 → 다른 검수자의 장부 반영 순서입니다. 실제 고객 결제·은행 지급과 구분하세요.', path: '/admin/settlement', action: '결제·정산 시험 열기' },
  ];
  return <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>
    <Typography variant="overline">DOELV · 관리자 시작</Typography><Typography component="h1" variant="h4" sx={{ mb: 2 }}>운영 설정과 검수 시작하기</Typography>
    <Typography sx={{ mb: 2 }}>순서대로 설정하고 각 화면의 설정·사용 안내를 확인하세요. 처음에는 준비 상태를 확인하고, 실제 시험의 결과와 독립 검수 근거를 남깁니다.</Typography>
    <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}><Button variant="contained" onClick={() => setReload(x => x + 1)} disabled={directory.loading}>준비 상태 새로 조회</Button><Button onClick={downloadProcedure}>검수 절차 내려받기</Button><Button component={Link} to="/help">전체 사용 안내</Button></Stack>
    <Alert severity="info" sx={{ mb: 2 }}>준비 상태 조회는 운영 승인이나 완료율이 아닙니다. G0의 실제 계정·권한 회수·독립 검수가 끝나기 전에는 다음 단계 완료로 표시하지 않습니다.</Alert>
    <Box aria-live="polite" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      {cards.map(c => <Card key={c.title} variant="outlined"><CardContent><Typography component="h2" variant="h6">{c.title}</Typography><Chip label={c.state} size="small" sx={{ my: 1 }} /><Typography>{c.text}</Typography><Button component={Link} to={c.path} sx={{ mt: 1 }}>{c.action}</Button></CardContent></Card>)}
    </Box>
    <Typography component="h2" variant="h6" sx={{ mt: 3 }}>확인한 서버와 배포 상태</Typography>
    <Typography sx={{ my: 1, overflowWrap: 'anywhere' }}>웹 배포 버전: {build?.key !== key ? '조회 중' : release || '확인하지 못함 · 최신 화면과 연결을 확인해 주세요'}</Typography>
    {directory.data && <Typography>현장 목록 확인 시각: {new Date(directory.data.observed_at).toLocaleString('ko-KR')}</Typography>}
    {role === 'super_admin' && (readiness.loading ? <Typography role="status">서버 보호 상태 확인 중</Typography> : readiness.error ? <Alert severity="error">{readiness.error}</Alert> : readiness.data && <Alert severity={readiness.data.security.public_tables_without_rls || readiness.data.security.legacy_browser_grants ? 'warning' : 'info'} sx={{ mt: 1 }}>서버 조회가 확인됐습니다. 공개 데이터의 행 보호 미설정 {readiness.data.security.public_tables_without_rls}건 · 기존 장비·AI 테이블의 브라우저 접근 권한 {readiness.data.security.legacy_browser_grants}건. 전체 보안 인수는 별도 시험이 필요합니다.</Alert>)}
    <Typography component="h2" variant="h6" sx={{ mt: 3, mb: 1 }}>실제 계정으로 수행할 G0 검수</Typography>
    <Typography sx={{ mb: 2 }}>아래 절차를 수행한 원자료를 현장 검증·개선에 등록하세요. 내려받은 파일은 빈 결과 양식이며 통과 증거가 아닙니다.</Typography>
    {onboardingAcceptance.map(c => <Accordion key={c.id} disableGutters><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>{c.id} · {c.title}</Typography></AccordionSummary><AccordionDetails><Typography>연결 요구사항 {c.requirement}</Typography><Box component="ol" sx={{ pl: 3 }}>{c.steps.map(s => <li key={s}>{s}</li>)}</Box><Typography>기대 결과: {c.expected}</Typography><Button component={Link} to={onboardingEvidencePath(c)} sx={{ mt: 2 }} variant="outlined">{c.id} 시험 결과 기록</Button></AccordionDetails></Accordion>)}
  </Box>;
}
