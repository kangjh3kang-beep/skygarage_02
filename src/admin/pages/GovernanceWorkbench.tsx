import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { requirements } from '../../lib/implementation-plan';
import { environments, governanceError, parseGovernanceDirectory, parseGovernanceSnapshot, sitePhases, testKinds, type EvidenceKind, type EvidenceEnvironment, type GovernanceSnapshot } from '../../lib/governance';
import { useGovernanceQuery } from '../hooks/useGovernanceQuery';
import { findOnboardingCase, onboardingAcceptance, onboardingProcedureVersion, parseDeploymentRelease, type OnboardingCase } from '../../lib/onboarding';
import GrowthLoopPanel from '../components/GrowthLoopPanel';
import EvidenceDigestInput from '../components/EvidenceDigestInput';

const grid={display:'grid',gridTemplateColumns:{xs:'1fr',md:'1fr 1fr'},gap:2};
const localDate=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
function RequirementSelect({value,onChange,disabled=false}:{value:string;onChange:(v:string)=>void;disabled?:boolean}) {return <TextField disabled={disabled} select fullWidth size="small" label="연결 요구사항" value={value} onChange={e=>onChange(e.target.value)}>{requirements.map(r=><MenuItem key={r.id} value={r.id}>{r.id} · {r.title}</MenuItem>)}</TextField>;}

export default function GovernanceWorkbench(){
 const {user,role}=useAuth();
 return <GovernanceSession key={`${user?.id}:${role}`} />;
}
function GovernanceSession(){
 const {user,role}=useAuth();
 const [searchParams,setSearchParams]=useSearchParams();
 const selectedCase=findOnboardingCase(searchParams.get('case'));
 const [releaseBusy,setReleaseBusy]=useState(false);
 const mounted=useRef(true),requests=useRef(new Set<AbortController>());
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const controller of requests.current)controller.abort();requests.current.clear();};},[]);
 const [reload,setReload]=useState(0),[siteId,setSiteId]=useState('');
 const [release,setRelease]=useState(''),[organizationName,setOrganizationName]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const inFlight=useRef(false),pending=useRef(new Map<string,string>());
 const identity=`${user?.id}:${role}`;
 const directory=useGovernanceQuery('platform_governance_directory',{},`${identity}:${reload}`,parseGovernanceDirectory);
 const site=directory.data?.sites.find(s=>s.id===siteId);
 const scopeId=site?.validation_scope_id;
 const context=useRef('');context.current=`${identity}:${siteId}:${scopeId}:${selectedCase?.id??'general'}`;
 async function fillDeploymentRelease(){
  if(releaseBusy)return;
  const captured=context.current,controller=new AbortController();requests.current.add(controller);
  const timer=setTimeout(()=>controller.abort(),15000);setReleaseBusy(true);setError('');
  try{const response=await fetch('/app-version.json',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('release_fetch_failed');const value=parseDeploymentRelease(await response.json());if(mounted.current&&context.current===captured)setRelease(value);}
  catch{if(mounted.current&&context.current===captured)setError('현재 웹 배포 버전을 확인하지 못했습니다. 배포 기록에서 전체 커밋 SHA를 확인해 입력해 주세요.');}
  finally{clearTimeout(timer);requests.current.delete(controller);if(mounted.current)setReleaseBusy(false);}
 }
 const snapshot=useGovernanceQuery('platform_governance_snapshot',{p_scope_id:scopeId},`${identity}:${siteId}:${scopeId}:${reload}`,parseGovernanceSnapshot,!!scopeId);
 const scopeMatches=!!snapshot.data&&snapshot.data.scope.id===scopeId&&snapshot.data.scope.site_id===siteId;
 async function mutate(rpc:string,args:Record<string,unknown>,success:string,idempotent=false){
  if(inFlight.current||!mounted.current)return false;inFlight.current=true;setBusy(true);setMessage('');setError('');
  const captured=context.current,controller=new AbortController();requests.current.add(controller);const timer=setTimeout(()=>controller.abort(),20000);
  const current=()=>mounted.current&&context.current===captured;
  try{
   const key=JSON.stringify([rpc,args]);let requestId=pending.current.get(key);
   if(idempotent&&!requestId){requestId=crypto.randomUUID();pending.current.set(key,requestId);}
   const {error}=await supabase.rpc(rpc,idempotent?{...args,p_request_id:requestId}:args).abortSignal(controller.signal);
   if(!current())return false;
   if(error)throw error;
   pending.current.delete(key);setMessage(success);setReload(n=>n+1);return true;
  }catch(e){if(current())setError(governanceError(e));return false;}
  finally{clearTimeout(timer);requests.current.delete(controller);inFlight.current=false;if(mounted.current)setBusy(false);}
 }
 const [staffId,setStaffId]=useState(''),[staffRole,setStaffRole]=useState('manager'),[staffActive,setStaffActive]=useState('true'),[staffRevision,setStaffRevision]=useState(0);
 const [staffExpiry,setStaffExpiry]=useState(localDate(new Date(Date.now()+30*86400000)));
 const [phaseReason,setPhaseReason]=useState('');
 return <Box sx={{maxWidth:1440,mx:'auto',width:'100%'}}>
  <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{justifyContent:'space-between',mb:3}}>
   <Box><Typography variant="overline" color="text.secondary">DOELV · DELIVERY & FEEDBACK</Typography><Typography component="h1" variant="h4" sx={{fontWeight:750}}>현장 검증·개선 관리</Typography><Typography color="text.secondary" sx={{mt:1}}>증거를 기록하고, 발견한 문제를 개선한 뒤 다시 검증합니다.</Typography></Box>
   <Stack direction="row" spacing={1}><Button component={Link} to="/admin/implementation">구축계획</Button><Button component={Link} to="/admin/templates" variant="outlined">단지 생성</Button></Stack>
  </Stack>
  <Alert severity="info" sx={{mb:2}}>인수율은 선택한 현장·소스 버전·설정에만 적용됩니다. 시험 증거의 독립 검수와 선행 요구사항을 모두 충족해야 완료로 계산합니다.</Alert>
  <Card variant="outlined" sx={{mb:3}}><CardContent>
   <Typography component="h2" variant="h6">실제 계정 검수 도우미</Typography>
   <Typography sx={{my:1}}>시험 항목을 선택하면 요구사항과 절차 버전이 연결됩니다. 현장·소스 버전을 먼저 지정하고 실제 수행 결과와 원자료를 등록하세요.</Typography>
   <TextField select fullWidth label="G0 검수 항목" helperText="항목을 바꾸면 작성 중인 증거 내용이 초기화됩니다." value={selectedCase?.id??''} disabled={busy} onChange={e=>{const next=new URLSearchParams(searchParams);if(e.target.value)next.set('case',e.target.value);else next.delete('case');setMessage('');setError('');setSearchParams(next);}}>
    <MenuItem value="">일반 증거 등록</MenuItem>{onboardingAcceptance.map(c=><MenuItem key={c.id} value={c.id}>{c.id} · {c.title}</MenuItem>)}
   </TextField>
   {searchParams.has('case')&&!selectedCase&&<Alert severity="warning" sx={{mt:2}}>알 수 없는 검수 항목입니다. 위 목록에서 올바른 항목을 선택해 주세요.</Alert>}
   {selectedCase&&<Box sx={{mt:2}}><Typography sx={{fontWeight:700}}>{selectedCase.requirement} · {onboardingProcedureVersion(selectedCase)}</Typography><Box component="ol" sx={{pl:3}}>{selectedCase.steps.map(s=><li key={s}>{s}</li>)}</Box><Typography>기대 결과: {selectedCase.expected}</Typography><Alert severity="info" sx={{mt:2}}>이 항목은 해당 요구사항의 일부 시험입니다. 통과 증거를 등록해도 G0 전체 인수나 다음 단계 승인이 자동 완료되지는 않습니다. QR·설정 키·인증번호는 원자료에 넣지 마세요.</Alert></Box>}
   <Button component={Link} to="/admin/start" sx={{mt:1}}>전체 설정 순서와 검수 절차</Button>
  </CardContent></Card>
  {message&&<Alert severity="success" sx={{mb:2}}>{message}</Alert>}{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
  {directory.error&&<Alert severity="error" sx={{mb:2}}>{directory.error}</Alert>}
  <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{mb:3}}>
   <TextField select fullWidth label="검증할 현장" value={site?.id??''} disabled={directory.loading||busy} onChange={e=>{setSiteId(e.target.value);setError('');setMessage('');setStaffId('');setStaffRevision(0);setStaffRole('manager');setStaffActive('true');setStaffExpiry(localDate(new Date(Date.now()+30*86400000)));setPhaseReason('');setRelease('');}}>
    <MenuItem value="">현장을 선택해 주세요</MenuItem>{directory.data?.sites.map(s=><MenuItem key={s.id} value={s.id}>{directory.data?.organizations.find(o=>o.id===s.organization_id)?.name} / {s.name} · {sitePhases[s.phase]}</MenuItem>)}
   </TextField><Button onClick={()=>setReload(n=>n+1)} disabled={busy||directory.loading||snapshot.loading}>새로 조회</Button>
  </Stack>
  {directory.loading&&<CircularProgress size={24}/>}
  {directory.data&&!directory.data.sites.length&&<Alert severity="info" sx={{mb:3}}>접근 가능한 현장이 없습니다. 최고관리자는 아래에서 운영 조직을 등록하고 단지 템플릿을 생성할 수 있습니다. 현장 담당자는 최고관리자에게 현장 권한을 요청해 주세요.</Alert>}
  {directory.data?.headquarters&&<Card variant="outlined" sx={{mb:3}}><CardContent>
   <Typography component="h2" variant="h6">운영 조직 등록</Typography><Typography variant="body2" color="text.secondary" sx={{mb:2}}>실제로 관리할 조직명으로 등록합니다. 조직 등록만으로 관리자나 장비 권한이 생기지는 않습니다.</Typography>
   <Box component="form" onSubmit={e=>{e.preventDefault();void mutate('platform_create_organization',{p_name:organizationName.trim()},'운영 조직을 등록했습니다.',true).then(ok=>{if(ok)setOrganizationName('');});}} sx={{display:'flex',gap:2,flexWrap:'wrap'}}>
    <TextField required label="운영 조직명" value={organizationName} onChange={e=>setOrganizationName(e.target.value)} disabled={busy} slotProps={{htmlInput:{minLength:2,maxLength:120}}}/><Button type="submit" variant="outlined" disabled={busy}>조직 등록</Button>
   </Box>
  </CardContent></Card>}
  {site&&<>
   <Box sx={{...grid,mb:3}}>
    <Card variant="outlined"><CardContent><Chip label={sitePhases[site.phase]} color={site.phase==='suspended'?'error':'default'} size="small"/><Typography variant="h6" sx={{my:1}}>{site.name}</Typography><Typography variant="body2" sx={{overflowWrap:'anywhere'}}>현장 ID {site.id}</Typography>
     <Typography variant="body2" color="text.secondary" sx={{mt:1}}>현장 생성 시 기본 모듈 구성을 자동 등록합니다. 주기적 처리기는 실패를 재시도하고 5회 실패 시 별도 대기열로 이동합니다.</Typography>
     {directory.data?.headquarters&&<Button sx={{mt:1}} disabled={busy} onClick={()=>void mutate('platform_process_foundation_queue',{},'구축 대기열 처리 결과를 갱신했습니다.')}>대기열 지금 처리</Button>}
    </CardContent></Card>
    <Card variant="outlined"><CardContent><Typography component="h2" variant="h6">검증할 소스 버전 지정</Typography><Typography variant="body2" color="text.secondary" sx={{my:1}}>저장소 커밋 전체 SHA를 지정합니다. 새 범위에는 이전 승인을 복사하지 않습니다. 커밋 입력 자체는 해당 버전의 배포 확인을 뜻하지 않습니다.</Typography>
     <Box component="form" onSubmit={e=>{e.preventDefault();void mutate('platform_open_validation_scope',{p_site_id:site.id,p_release_sha:release.trim().toLowerCase()},'현장의 검증 범위를 지정했습니다.',true).then(ok=>{if(ok)setRelease('');});}}>
      <TextField required fullWidth size="small" label="소스 커밋 SHA · 40자리" value={release} onChange={e=>setRelease(e.target.value)} disabled={busy||releaseBusy} slotProps={{htmlInput:{pattern:'[a-fA-F0-9]{40}',maxLength:40}}}/><Button type="button" disabled={busy||releaseBusy} onClick={()=>void fillDeploymentRelease()} sx={{mt:1,mr:1}}>{releaseBusy?'배포 버전 확인 중':'현재 웹 버전 채우기'}</Button><Button type="submit" disabled={busy||releaseBusy||(!directory.data?.headquarters&&snapshot.data?.permissions.write===false)} sx={{mt:1}}>검증 범위 생성·선택</Button>
     </Box>
    </CardContent></Card>
   </Box>
   {snapshot.loading&&<Stack direction="row" spacing={1}><CircularProgress size={20}/><Typography>현장 증거 원장 조회 중</Typography></Stack>}
   {snapshot.error&&<Alert severity="error">{snapshot.error}</Alert>}
   {!scopeId&&<Alert severity="info">소스 버전을 지정하면 이 현장의 증거·결함·개선 과제를 등록할 수 있습니다.</Alert>}
   {snapshot.data&&!scopeMatches&&<Alert severity="error">선택한 현장과 증거의 검증 범위가 일치하지 않습니다. 새로 조회한 뒤 계속해 주세요.</Alert>}
   {scopeMatches&&snapshot.data&&<ScopeContent key={`${identity}:${siteId}:${snapshot.data.scope.id}:${selectedCase?.id??'general'}`} selectedCase={selectedCase} data={snapshot.data} userId={user?.id??''} busy={busy} mutate={mutate}/>}
   {directory.data?.headquarters&&<Box sx={{...grid,mt:3}}>
    <Card variant="outlined"><CardContent><Typography component="h2" variant="h6">현장 담당 권한</Typography>{directory.data?.assignments.filter(a=>a.site_id===site.id).map(a=><Typography variant="body2" key={a.user_id} sx={{mt:1}}>{directory.data?.operators.find(o=>o.id===a.user_id)?.name} · {a.role==='manager'?'담당자':a.role==='reviewer'?'검수자':'조회자'} · {a.active?'허용':'회수'} · {new Date(a.valid_until).toLocaleDateString('ko-KR')}까지</Typography>)}<Typography variant="body2" color="text.secondary" sx={{my:1}}>등록된 관리자 계정을 선택하고 담당자·검수자·조회자를 지정합니다. 권한 회수는 다음 조회·변경부터 적용됩니다.</Typography>
     <Box component="form" sx={{display:'grid',gap:2}} onSubmit={e=>{e.preventDefault();void mutate('platform_set_site_staff',{p_site_id:site.id,p_user_id:staffId,p_role:staffRole,p_active:staffActive==='true',p_valid_until:new Date(staffExpiry).toISOString(),p_expected_revision:staffRevision},'담당 권한을 반영했습니다.').then(ok=>{if(ok)setStaffRevision(n=>n+1);});}}>
      <TextField required select label="관리자 계정" value={staffId} onChange={e=>{const id=e.target.value;setStaffId(id);const a=directory.data?.assignments.find(a=>a.site_id===site.id&&a.user_id===id);setStaffRevision(a?.revision??0);setStaffRole(a?.role??'manager');setStaffActive(String(a?.active??true));setStaffExpiry(localDate(new Date(a?.valid_until??Date.now()+30*86400000)));}} disabled={busy}><MenuItem value="">담당자를 선택해 주세요</MenuItem>{directory.data?.operators.map(o=><MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}</TextField>
      <TextField select label="현장 역할" value={staffRole} onChange={e=>setStaffRole(e.target.value)} disabled={busy}><MenuItem value="manager">담당자 · 증거·과제 등록</MenuItem><MenuItem value="reviewer">검수자 · 독립 검수</MenuItem><MenuItem value="viewer">조회자</MenuItem></TextField>
      <Box sx={grid}><TextField select label="접근 상태" value={staffActive} onChange={e=>setStaffActive(e.target.value)} disabled={busy}><MenuItem value="true">허용</MenuItem><MenuItem value="false">회수</MenuItem></TextField></Box>
      <TextField required type="datetime-local" label="권한 만료 · 기기 현지시각" value={staffExpiry} onChange={e=>setStaffExpiry(e.target.value)} disabled={busy} slotProps={{inputLabel:{shrink:true}}}/><Button type="submit" variant="outlined" disabled={busy}>담당 권한 반영</Button>
     </Box>
    </CardContent></Card>
    <Card variant="outlined"><CardContent><Typography component="h2" variant="h6">현장 단계 전환</Typography><Typography variant="body2" color="text.secondary" sx={{my:1}}>현장 인수에는 기반 요구사항의 증거가, 인수 승인에는 36개 전체 증거가 필요합니다. 승인 수가 줄면 주기적 점검이 현장을 중지 상태로 변경합니다. 장비 구동 승인과는 별도입니다.</Typography>
     <TextField fullWidth multiline minRows={2} label="전환 사유" value={phaseReason} onChange={e=>setPhaseReason(e.target.value)} disabled={busy}/>
     <Stack direction="row" spacing={1} useFlexGap sx={{mt:2,flexWrap:'wrap'}}>{(site.phase==='sandbox'?['site_acceptance','suspended']:site.phase==='site_acceptance'?['ready','suspended']:site.phase==='suspended'?['sandbox']:['suspended']).map(next=><Button key={next} disabled={busy||phaseReason.trim().length<5} color={next==='suspended'?'error':'primary'} onClick={()=>void mutate('platform_set_site_phase',{p_site_id:site.id,p_scope_id:site.validation_scope_id,p_expected_phase:site.phase,p_phase:next,p_reason:phaseReason},'현장 단계를 변경했습니다.')}>{sitePhases[next as keyof typeof sitePhases]}</Button>)}</Stack>
    </CardContent></Card>
   </Box>}
  </>}
 </Box>;
}

type Mutate=(rpc:string,args:Record<string,unknown>,success:string,idempotent?:boolean)=>Promise<boolean>;
function ScopeContent({data,userId,busy,mutate,selectedCase}:{data:GovernanceSnapshot;userId:string;busy:boolean;mutate:Mutate;selectedCase:OnboardingCase|null}){
 const [requirement,setRequirement]=useState<string>(selectedCase?.requirement??'F01'),[kind,setKind]=useState<EvidenceKind>('integration'),[environment,setEnvironment]=useState<EvidenceEnvironment>('staging'),[result,setResult]=useState('');
 const [procedure,setProcedure]=useState(selectedCase?onboardingProcedureVersion(selectedCase):''),[uri,setUri]=useState(''),[hash,setHash]=useState(''),[summary,setSummary]=useState('');
 const [measured,setMeasured]=useState(localDate(new Date())),[expires,setExpires]=useState(localDate(new Date(Date.now()+30*86400000)));
 const [itemReq,setItemReq]=useState('F01'),[itemKind,setItemKind]=useState('improvement'),[severity,setSeverity]=useState('normal'),[title,setTitle]=useState(''),[description,setDescription]=useState('');
 const [hashBusy,setHashBusy]=useState(false),[evidenceFormRevision,setEvidenceFormRevision]=useState(0);
 const readiness=data.readiness;
 return <>
  <Box sx={{...grid,my:3}}>
   <Card variant="outlined"><CardContent><Typography variant="subtitle2">선택 현장의 유효한 인수 증거</Typography><Typography variant="h3" sx={{my:1}}>{readiness.approved}<Typography component="span" variant="h6" color="text.secondary"> / 36 · {Math.floor(readiness.approved/36*100)}%</Typography></Typography><Typography>미해결 결함 {readiness.blocking_defects}건 · 선행 조건 전 증거 충족 {readiness.covered}개</Typography><Typography variant="caption" color="text.secondary">조회 시각 {new Date(data.observed_at).toLocaleString('ko-KR')}</Typography></CardContent></Card>
   <Card variant="outlined"><CardContent><Typography variant="subtitle2">검증 범위 고정</Typography><Typography variant="body2" sx={{overflowWrap:'anywhere',mt:1}}>계획 {data.scope.plan_version}<br/>소스 {data.scope.release_sha}<br/>설정 SHA-256 {data.scope.configuration_digest}</Typography><Stack direction="row" spacing={1} sx={{mt:2}}>{data.provisioning.map(q=><Chip key={q.id} size="small" label={`자동 구축 ${q.status==='processed'?'완료':q.status==='dead_letter'?'실패 격리':'대기'} · ${q.attempts}회`} color={q.status==='dead_letter'?'error':'default'}/>)}</Stack><Typography variant="body2" sx={{mt:1}}>설정된 기본 모듈 {data.modules.length}개 · 실장비 연동은 별도 검수</Typography></CardContent></Card>
  </Box>
  <Box sx={{display:'flex',gap:1,flexWrap:'wrap',mb:3}}>{readiness.requirements.map(r=><Chip key={r.id} label={`${r.id} ${r.accepted?'인수':r.evidence_complete?'선행 대기':'증거 필요'}`} color={r.accepted?'success':r.evidence_complete?'info':'default'} title={`${r.title} / 필요: ${r.required_kinds.map(k=>testKinds[k]).join(', ')}`} onClick={()=>{setRequirement(r.id);setItemReq(r.id);}}/>)}</Box>
  <Box sx={grid}>
   <Card variant="outlined"><CardContent><Typography component="h2" variant="h6">검증 증거 등록</Typography><Typography variant="body2" color="text.secondary" sx={{my:1}}>실제 시험 보고서의 링크·해시·절차 버전을 기록합니다. 링크와 해시를 검수자가 대조해야 하며 등록만으로 진위를 확인한 것은 아닙니다. 개인정보·키는 포함하지 마세요.</Typography>
    <Typography variant="body2" sx={{mb:2}}>필요한 증거: {readiness.requirements.find(r=>r.id===requirement)?.required_kinds.map(k=>testKinds[k]).join(' · ')}</Typography>
    <Box component="form" sx={{display:'grid',gap:2}} onSubmit={e=>{e.preventDefault();if(hashBusy||!['pass','fail'].includes(result))return;void mutate('platform_submit_evidence',{p_scope_id:data.scope.id,p_requirement_id:requirement,p_test_kind:kind,p_environment:environment,p_result:result,p_procedure_version:procedure.trim(),p_artifact_uri:uri.trim(),p_artifact_sha256:hash.trim().toLowerCase(),p_summary:selectedCase?`[${selectedCase.id}] ${summary.trim()}`:summary.trim(),p_measured_at:new Date(measured).toISOString(),p_expires_at:new Date(expires).toISOString()},result==='fail'?'실패 증거와 재검증 과제를 등록했습니다.':'증거를 등록했습니다. 다른 검수자의 확인이 필요합니다.',true).then(ok=>{if(ok){setSummary('');setUri('');setHash('');setResult('');setEvidenceFormRevision(n=>n+1);}});}}>
     <RequirementSelect value={requirement} onChange={setRequirement} disabled={busy||!!selectedCase}/>
     <Box sx={grid}><TextField select disabled={busy||!!selectedCase} label="시험 종류" value={kind} onChange={e=>setKind(e.target.value as EvidenceKind)}>{Object.entries(testKinds).map(([id,label])=><MenuItem key={id} value={id}>{label}</MenuItem>)}</TextField><TextField select label="시험 환경" value={environment} onChange={e=>setEnvironment(e.target.value as EvidenceEnvironment)}>{Object.entries(environments).filter(([id])=>!selectedCase||['staging','field'].includes(id)).map(([id,label])=><MenuItem key={id} value={id}>{label}</MenuItem>)}</TextField></Box>
     <Box sx={grid}><TextField required select label="시험 결과" value={result} onChange={e=>setResult(e.target.value)}><MenuItem value="" disabled>실제 수행한 결과를 선택하세요</MenuItem><MenuItem value="pass">통과</MenuItem><MenuItem value="fail">실패 · 개선 과제 자동 생성</MenuItem></TextField><TextField required label="시험 절차·버전" disabled={!!selectedCase} value={procedure} onChange={e=>setProcedure(e.target.value)} slotProps={{htmlInput:{minLength:2,maxLength:100}}}/></Box>
     <TextField required type="url" label="증거 파일 HTTPS 링크 · 로그인·접근제어 가능" value={uri} onChange={e=>setUri(e.target.value)} helperText="서명 토큰·쿼리 문자열이 포함된 임시 URL은 사용하지 않습니다."/>
     <EvidenceDigestInput key={evidenceFormRevision} value={hash} onChange={setHash} disabled={busy||!data.permissions.write} onBusy={setHashBusy}/>
     <Box sx={grid}><TextField required type="datetime-local" label="측정 시각 · 기기 현지시각" value={measured} onChange={e=>setMeasured(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField required type="datetime-local" label="증거 유효기간" value={expires} onChange={e=>setExpires(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/></Box>
     <TextField required multiline minRows={3} label="시험 범위·실측 결과·남은 한계" value={summary} onChange={e=>setSummary(e.target.value)} slotProps={{htmlInput:{minLength:5,maxLength:selectedCase?1980:2000}}}/>
     <Button type="submit" variant="contained" disabled={busy||hashBusy||!result||!data.permissions.write}>검증 증거 등록</Button>
    </Box>
   </CardContent></Card>
   <Card variant="outlined"><CardContent><Typography component="h2" variant="h6">피드백·성장 과제</Typography><Typography variant="body2" color="text.secondary" sx={{my:1}}>결함은 수정·재시험으로, 개선 제안은 구현·평가로 검증합니다. LLM 자동 제안과 모델 학습은 아직 연결 전입니다.</Typography>
    <Box component="form" sx={{display:'grid',gap:2}} onSubmit={e=>{e.preventDefault();void mutate('platform_create_improvement',{p_scope_id:data.scope.id,p_requirement_id:itemReq,p_kind:itemKind,p_severity:severity,p_title:title.trim(),p_description:description.trim()},'개선 과제를 등록했습니다.',true).then(ok=>{if(ok){setTitle('');setDescription('');}});}}>
     <RequirementSelect value={itemReq} onChange={setItemReq}/><Box sx={grid}><TextField select label="분류" value={itemKind} onChange={e=>setItemKind(e.target.value)}><MenuItem value="improvement">성장 · 개선 제안</MenuItem><MenuItem value="defect">피드백 · 결함</MenuItem></TextField><TextField select label="중요도" value={severity} onChange={e=>setSeverity(e.target.value)}><MenuItem value="normal">일반</MenuItem><MenuItem value="high">높음</MenuItem><MenuItem value="critical">치명</MenuItem></TextField></Box>
     <TextField required label="과제 제목" value={title} onChange={e=>setTitle(e.target.value)} slotProps={{htmlInput:{minLength:5,maxLength:200}}}/><TextField required multiline minRows={5} label="관찰·원인 가설·개선안·검증 방법" value={description} onChange={e=>setDescription(e.target.value)} slotProps={{htmlInput:{minLength:5,maxLength:2000}}}/><Button type="submit" variant="contained" disabled={busy||!data.permissions.write}>개선 과제 등록</Button>
    </Box>
    <Alert severity="info" sx={{mt:3}}>접수 → 개선 중 → 새 통과 증거 연결 → 독립 검수 → 완료. 실패 시험으로 생성된 과제는 같은 종류·환경의 재시험이 필요합니다.</Alert>
   </CardContent></Card>
  </Box>
  <GrowthLoopPanel scopeId={data.scope.id} siteId={data.scope.site_id} userId={userId} busy={busy} mutate={mutate}/>

 </>;
}
