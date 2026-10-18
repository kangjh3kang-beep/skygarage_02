import { useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AUDIT_DATE, PLAN_VERSION, operationalAcceptance, phases, requirements, stateLabels } from '../../lib/implementation-plan';
import { contractReasonLabels, labScenarios, runContractScenario } from '../../lib/mission-contract';
import { parseReadinessSnapshot, type ReadinessSnapshot } from '../../lib/readiness-snapshot';

const counters: {key:keyof ReadinessSnapshot['counts'];label:string}[] = [
  {key:'sites',label:'등록 현장'}, {key:'blueprints',label:'생성된 구성'}, {key:'devices',label:'등록 장비'},
  {key:'telemetry',label:'장비 수신 기록'}, {key:'domain_events',label:'통합 이벤트'}, {key:'hil_records',label:'장비 시험 기록'},
];
const layers = [
  ['본사 통합관리','조직·정책·템플릿·승인·사업 지표'],
  ['단지·현장 운영','회원·차량·요청·자원·미션'],
  ['엣지 게이트웨이','장비 신원·명령 중복 방지·상태 대사'],
  ['하드웨어·안전','제조사 어댑터·PLC·비상정지'],
  ['데이터·LLM 개선','근거 검색·장애 분석·평가·승인'],
];
export default function ImplementationWorkbench() {
  const { role, user } = useAuth();
  const [response,setResponse] = useState<{key:string;snapshot:ReadinessSnapshot|null;error:string}|null>(null);
  const [reload,setReload] = useState(0);
  const [phase,setPhase] = useState('all');
  const [query,setQuery] = useState('');
  const [scenario,setScenario] = useState('normal');
  const requestKey = `${user?.id}:${role}:${reload}`;
  const current = response?.key === requestKey ? response : null;
  const snapshot = current?.snapshot ?? null;
  const loading = !current;
  const error = current?.error ?? '';
  useEffect(() => {
    if (role !== 'super_admin') return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),15_000);
    Promise.resolve(supabase.rpc('platform_readiness_snapshot').abortSignal(controller.signal))
      .then(({data,error}) => {
        if (!active) return;
        if (error) throw error;
        setResponse({key:requestKey,snapshot:parseReadinessSnapshot(data),error:''});
      })
      .catch(() => { if(active) setResponse({key:requestKey,snapshot:null,error:'현황을 확인하지 못했습니다. 관리자 2단계 인증과 연결 상태를 확인한 뒤 다시 조회해 주세요.'}); })
      .finally(() => { clearTimeout(timeout); });
    return () => {active=false; clearTimeout(timeout); controller.abort();};
  },[requestKey,role]);
  if (role !== 'super_admin') return <Alert severity="warning">구축·검증 현황은 총괄 최고관리자에게 제공됩니다.</Alert>;
  const filtered = requirements.filter(r => (phase==='all'||r.phase===phase) && `${r.id} ${r.title} ${r.owner} ${r.acceptance}`.toLowerCase().includes(query.toLowerCase()));
  const result = runContractScenario(scenario);
  function download() {
    const file = {plan_version:PLAN_VERSION,audited_on:AUDIT_DATE,exported_at:new Date().toISOString(),operational_acceptance:operationalAcceptance,snapshot,phases,requirements};
    const url = URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download=`DOELV-implementation-${PLAN_VERSION}.json`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <Box sx={{p:{xs:1,md:3},maxWidth:1440,mx:'auto',width:'100%'}}>
    <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{mb:3,justifyContent:"space-between"}}>
      <Box><Typography variant="overline" color="text.secondary">DOELV · IMPLEMENTATION</Typography><Typography component="h1" variant="h4" sx={{fontWeight:750}}>통합시스템 구축·검증</Typography><Typography color="text.secondary" sx={{mt:1}}>본사에서 현장 장비까지, 요구사항과 검증 근거를 함께 관리합니다.</Typography></Box>
      <Stack direction="row" spacing={1} sx={{alignItems:"center",flexWrap:"wrap"}} useFlexGap><Button component={Link} to="/admin/templates" variant="outlined">단지 템플릿 생성</Button><Button onClick={download}>구축 기준 내려받기</Button></Stack>
    </Stack>
    <Alert severity="info" sx={{mb:3}}>현재 릴리스는 검수 준비 단계입니다. 소프트웨어 시험 통과, DB 기록 수, 현장 운영 승인은 각각 구분합니다. 이 화면은 장비 명령이나 운영 승인 권한을 부여하지 않습니다.</Alert>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'1fr 1fr'},gap:2,mb:3}}>
      <Card variant="outlined"><CardContent><Typography variant="subtitle2" color="text.secondary">통합 운영 인수</Typography><Typography variant="h3" sx={{fontWeight:750,my:1}}>{operationalAcceptance.approved}<Typography component="span" variant="h6" color="text.secondary"> / {operationalAcceptance.total} 요구사항</Typography></Typography><Typography>{operationalAcceptance.status}</Typography><Typography variant="body2" color="text.secondary" sx={{mt:1}}>계획 {PLAN_VERSION} · 코드·DB 조사 {AUDIT_DATE}. 증거 원장과 독립 승인 기능을 구축하기 전에는 승인 수를 자동 갱신하지 않습니다.</Typography></CardContent></Card>
      <Card variant="outlined"><CardContent><Typography variant="subtitle2" color="text.secondary">다음 구축 목표</Typography><Typography variant="h6" sx={{my:1}}>현장별 권한과 데이터 연결</Typography><Typography>조직·단지 기준 ID → 현장 역할 → 회원·차량 승인 → 요청 배정</Typography><Typography variant="body2" color="text.secondary" sx={{mt:1}}>제조사 연동은 API 계약서·장비·시험 환경을 확보한 뒤 진행합니다. 일정은 인력과 현장 조건 확정 후 조정합니다.</Typography></CardContent></Card>
    </Box>
    <Stack direction="row" sx={{mb:1,justifyContent:"space-between",alignItems:"center"}}><Typography component="h2" variant="h6">실제 DB 현황</Typography><Button disabled={loading} onClick={()=>setReload(n=>n+1)}>다시 조회</Button></Stack>
    <Box aria-live="polite" aria-busy={loading}>
      {loading && <Stack direction="row" spacing={1} sx={{py:2,alignItems:"center"}}><CircularProgress size={20}/><Typography>서버 현황 확인 중</Typography></Stack>}
      {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
      {!loading && snapshot && <>
        <Typography variant="body2" color="text.secondary" sx={{mb:2}}>집계 시각 {new Date(snapshot.observed_at).toLocaleString('ko-KR')} · 전체 조직 합계 · 자동 갱신 아님</Typography>
        <Box sx={{display:'grid',gridTemplateColumns:{xs:'repeat(2,minmax(0,1fr))',lg:'repeat(6,minmax(0,1fr))'},gap:1.5}}>{counters.map(c=><Card variant="outlined" key={c.key}><CardContent><Typography variant="body2" color="text.secondary">{c.label}</Typography><Typography variant="h4" sx={{mt:1}}>{snapshot.counts[c.key].toLocaleString('ko-KR')}</Typography></CardContent></Card>)}</Box>
        <Alert severity={snapshot.security.public_tables_without_rls||snapshot.security.legacy_browser_grants?'error':'info'} sx={{mt:2}}>행 접근 보호가 꺼진 공개 테이블 {snapshot.security.public_tables_without_rls}개 · 기존 장비·AI 테이블의 브라우저 접근 권한 {snapshot.security.legacy_browser_grants}개. 이는 일부 DB 점검 결과이며 전체 보안 검수 결과는 아닙니다.</Alert>
        <Typography variant="caption" color="text.secondary">등록 수와 기록 수는 실제 연결·운행 성공·시험 통과를 의미하지 않습니다.</Typography>
      </>}
    </Box>
    <Typography component="h2" variant="h6" sx={{mt:4,mb:2}}>목표 연결 구조</Typography>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(5,minmax(0,1fr))'},gap:1.5}}>{layers.map(([title,body],i)=><Box key={title} sx={{border:'1px solid',borderColor:'divider',borderRadius:2,p:2}}><Typography variant="overline" color="text.secondary">0{i+1}</Typography><Typography sx={{fontWeight:700}}>{title}</Typography><Typography variant="body2" sx={{mt:1}}>{body}</Typography></Box>)}</Box>
    <Typography variant="body2" color="text.secondary" sx={{mt:2}}>요청과 결과는 공통 현장 ID·미션 ID·이벤트 ID로 연결합니다. 데이터·명령·안전 제어의 권한 경계를 유지하며 상태를 상호 대사합니다.</Typography>
    <Typography component="h2" variant="h6" sx={{mt:4,mb:2}}>단계별 구축 계획</Typography>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(3,minmax(0,1fr))'},gap:2}}>{phases.map(p=><Card key={p.id} variant="outlined"><CardContent><Chip label={p.id} size="small"/><Typography variant="h6" sx={{my:1}}>{p.title}</Typography><Typography variant="body2">{p.exit}</Typography><Typography variant="caption" color="text.secondary" sx={{display:"block",mt:2}}>선행 {p.depends} · 작업기간 가정 {p.duration}</Typography><Button size="small" sx={{mt:1}} onClick={()=>{setPhase(p.id);document.getElementById('implementation-requirements')?.scrollIntoView({behavior:'smooth',block:'start'});}}>요구사항 보기</Button></CardContent></Card>)}</Box>
    <Box id="implementation-requirements" sx={{scrollMarginTop:80,mt:4}}>
      <Typography component="h2" variant="h6" sx={{mb:2}}>요구사항과 완료 조건</Typography>
      <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{mb:2}}><TextField select size="small" label="구축 단계" value={phase} onChange={e=>setPhase(e.target.value)} sx={{minWidth:190}}><MenuItem value="all">전체 36개</MenuItem>{phases.map(p=><MenuItem key={p.id} value={p.id}>{p.id} {p.title}</MenuItem>)}</TextField><TextField size="small" label="요구사항·담당 검색" value={query} onChange={e=>setQuery(e.target.value)} fullWidth/></Stack>
      <Typography variant="body2" color="text.secondary" sx={{mb:1}}>조회 {filtered.length}개 · 소프트웨어 검증은 해당 코드 범위의 시험 결과입니다. 운영 인수에는 현장별 추가 증거가 필요합니다.</Typography>
      {!filtered.length&&<Typography sx={{py:2}}>검색 결과가 없습니다.</Typography>}
      {filtered.map(r=><Accordion key={r.id} disableGutters><AccordionSummary expandIcon={<ExpandMoreIcon/>}><Stack direction={{xs:'column',sm:'row'}} spacing={1.5} sx={{alignItems:{xs:'flex-start',sm:'center'}}}><Typography component="span" sx={{fontWeight:700}}>{r.id} · {r.title}</Typography><Chip size="small" label={stateLabels[r.state]} color={r.state==='code_verified'?'info':r.state==='external'?'warning':'default'}/></Stack></AccordionSummary><AccordionDetails><Typography><strong>완료 조건</strong> · {r.acceptance}</Typography><Typography sx={{mt:1}}><strong>다음 작업</strong> · {r.next}</Typography><Typography variant="body2" sx={{mt:1}}>담당 역할 {r.owner} · 선행 {r.dependsOn.join(', ')||'없음'}</Typography><Typography variant="body2" color="text.secondary" sx={{mt:1,overflowWrap:'anywhere'}}>현재 코드·시험 근거: {r.evidence.join(' · ')||'확보 전'}</Typography></AccordionDetails></Accordion>)}
    </Box>
    <Card variant="outlined" sx={{mt:4}}><CardContent><Typography component="h2" variant="h6">연동 계약 시험실</Typography><Typography sx={{my:1}}>고정된 가상 입력으로 중복·권한·기한·연결 단절 처리를 확인합니다. DB에 기록하거나 장비로 전송하지 않습니다.</Typography><TextField select size="small" label="시험 상황" value={scenario} onChange={e=>setScenario(e.target.value)} sx={{my:2,minWidth:240}}>{labScenarios.map(s=><MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}</TextField><Alert severity={result.testEligible?'info':'warning'}>{contractReasonLabels[result.reason]}</Alert><Typography variant="body2" color="text.secondary" sx={{mt:2}}>ACK 유실은 UNKNOWN으로 관리하고 장비 상태를 대사합니다. 자동 재구동으로 처리하지 않습니다. 이 모형의 임계값은 실장비 안전 제어의 인증 수치가 아닙니다.</Typography></CardContent></Card>
  </Box>;
}
