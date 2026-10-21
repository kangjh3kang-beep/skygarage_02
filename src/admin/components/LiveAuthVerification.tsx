import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { liveAuthCheckLabel, parseLiveAuthReport } from '../../lib/live-auth-report';
import { useGovernanceQuery } from '../hooks/useGovernanceQuery';

export default function LiveAuthVerification({ userId, release, verified }: { userId: string; release: string | null; verified: boolean }) {
  const [revision, refresh] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requestId = useRef<string | null>(null), active = useRef(true), generation = useRef(0), controller = useRef<AbortController | null>(null), inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; ++generation.current; controller.current?.abort(); }; }, []);
  const query = useGovernanceQuery('platform_live_auth_report', { p_run_id: null }, `${userId}:${revision}`, parseLiveAuthReport, verified);
  useEffect(() => { if (query.data && query.data.id === requestId.current && query.data.status !== 'running') requestId.current = null; }, [query.data]);
  async function run() {
    if (inFlight.current || !release || !verified || query.data?.status === 'running') return;
    inFlight.current = true; setBusy(true); setError('');
    const current = ++generation.current;
    const id = requestId.current ?? crypto.randomUUID(); requestId.current = id;
    controller.current = new AbortController();
    try {
      const { data, error } = await supabase.functions.invoke('live-auth-verification', { body: { request_id: id, release_sha: release }, timeout: 120000, signal: controller.current.signal });
      if (!active.current || generation.current !== current) return;
      if (error) throw error;
      const report = parseLiveAuthReport(data);
      if (!report) throw new Error('missing_report');
      if (report.status !== 'running') requestId.current = null;
    } catch {
      if (active.current && generation.current === current) setError('실행 결과를 확인하지 못했습니다. 먼저 결과 새로 조회로 서버 기록을 확인하세요. 같은 요청을 재시도해도 중복 시험을 시작하지 않습니다.');
    } finally {
      inFlight.current = false;
      if (active.current && generation.current === current) { setBusy(false); refresh(n => n + 1); }
    }
  }
  const report = query.data;
  return <Card variant="outlined" sx={{ mt: 3 }}><CardContent>
    <Typography component="h2" variant="h6">시험 계정으로 실제 인증·권한 검수</Typography>
    <Typography sx={{ my: 1 }}>시험 현장 두 곳과 담당자·검수자·일반회원 계정을 생성합니다. 실제 인증 서버의 로그인·TOTP·권한 회수·증거 승인·재시험을 확인한 뒤 계정을 차단하고 시험 권한을 회수합니다. 보통 1분 이내이며 인증번호 주기가 바뀔 때까지 기다릴 수 있습니다.</Typography>
    <Typography variant="body2">이전 시험에 인증 정보가 남아 있으면 해당 시험 계정을 먼저 정리한 뒤 새 시험을 시작합니다.</Typography>
    <Alert severity="info" sx={{ my: 2 }}>이 실행은 별도 계정을 사용하는 자동 통합시험입니다. 실제 회원가입·문자인증, 담당자의 휴대전화 사용성, 사람이 수행하는 독립 검수, PG·실장비 인수는 별도로 확인합니다. 증거 원장의 시험 자료는 가상 자료이며 운영 인수를 승인하지 않습니다.</Alert>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <Button variant="outlined" disabled={busy || query.loading || !release || !verified || report?.status === 'running'} onClick={() => void run()}>{busy ? '실제 인증 시험 실행 중' : '시험 계정 생성·실제 인증 검수 실행'}</Button>
      <Button disabled={busy || query.loading || !verified} onClick={() => { setError(''); refresh(n => n + 1); }}>시험 결과 새로 조회</Button>
    </Stack>
    {!release && <Typography sx={{ mt: 1 }}>웹 배포 버전 확인 후 실행할 수 있습니다.</Typography>}
    {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
    {query.error && <Alert severity="error" sx={{ mt: 2 }}>{query.error}</Alert>}
    {!busy && !query.loading && !query.error && !report && <Typography sx={{ mt: 2 }}>아직 실제 인증 시험 기록이 없습니다.</Typography>}
    {report && <Box sx={{ mt: 2 }}>
      <Chip label={{ running: '서버에서 실행 중', passed: '자동 통합시험 통과', failed: '보완 후 재시험 필요', expired: '실행 시간 초과 · 정리 상태 확인 필요' }[report.status]} color={report.status === 'passed' ? 'success' : report.status === 'running' ? 'info' : 'warning'} />
      <Typography sx={{ mt: 1 }}>시험 계정 {report.test_accounts}개 · 통과 {report.checks.filter(c => c.passed).length}/{report.checks.length}개</Typography>
      <Typography>DB 권한 회수: {report.database_cleanup ? '확인' : '미확인'} · 시험 계정 차단·세션 정리: {report.auth_cleanup ? '확인' : '미확인'}</Typography>
      {report.error_code === 'auth_cleanup_failed' && <Alert severity="warning" sx={{ my: 1 }}>이 실행은 계정·세션 정리 문제로 실패한 기록입니다. 정리 상태가 확인으로 바뀌어도 당시 실패 판정은 보존됩니다. 새 실행으로 재검수하세요.</Alert>}
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere', my: 1 }}>검수한 배포 버전: {report.release_sha}<br />시험 식별자: {report.id}</Typography>
      {report.release_sha !== release && <Alert severity="warning">이 결과는 현재 웹 화면과 다른 배포 버전을 검수한 기록입니다. 해당 버전의 결과로 확인하세요.</Alert>}
      {report.status === 'running' && <Typography>새 시험을 시작하지 말고 잠시 후 시험 결과를 다시 조회하세요.</Typography>}
      <Box component="ul" sx={{ pl: 3 }}>{report.checks.map(c => <li key={c.id}>{c.passed ? '통과' : '확인 필요'} · {liveAuthCheckLabel(c.id)}</li>)}</Box>
    </Box>}
  </CardContent></Card>;
}
