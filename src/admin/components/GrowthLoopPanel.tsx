import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useGovernanceQuery } from '../hooks/useGovernanceQuery';
import { environments, improvementStates, safeEvidenceUrl, testKinds, type Improvement } from '../../lib/governance';
import { loopCountLabels, parseGrowthLoopSnapshot, parseRetestCandidates } from '../../lib/growth-loop';
import { requirements } from '../../lib/implementation-plan';

type Mutate=(rpc:string,args:Record<string,unknown>,success:string,idempotent?:boolean)=>Promise<boolean>;
type Props={scopeId:string;siteId:string;userId:string;busy:boolean;mutate:Mutate};
export default function GrowthLoopPanel(props:Props){return <LoopSession key={`${props.userId}:${props.scopeId}`} {...props}/>;}
function LoopSession({scopeId,siteId,userId,busy,mutate}:Props){
 const [requirement,setRequirement]=useState(''),[status,setStatus]=useState('active'),[evidenceState,setEvidenceState]=useState('all');
 const [draft,setDraft]=useState(''),[query,setQuery]=useState(''),[refresh,setRefresh]=useState(0);
 const [itemHistory,setItemHistory]=useState<string[]>([]),[evidenceHistory,setEvidenceHistory]=useState<string[]>([]);
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const args={p_scope_id:scopeId,p_requirement_id:requirement||null,p_status:status,p_evidence_state:evidenceState,p_query:query,p_improvement_before:itemHistory.at(-1)??null,p_evidence_before:evidenceHistory.at(-1)??null};
 const key=JSON.stringify([userId,args,refresh]);
 const result=useGovernanceQuery('platform_growth_loop_snapshot',args,key,parseGrowthLoopSnapshot);
 const data=result.data?.scope.id===scopeId&&result.data.scope.site_id===siteId?result.data:null;
 function resetPages(){setItemHistory([]);setEvidenceHistory([]);setReviewNotes({});}
 return <Box component="section" aria-label="성장·피드백 실행 현황" sx={{mt:4}}>
  <Typography component="h2" variant="h5">성장·피드백 실행 현황</Typography>
  <Typography color="text.secondary" sx={{my:1}}>현장·버전 전체 기록에서 미해결 문제와 다음 검증을 확인합니다. 한 번에 25건씩 조회하며 과거 기록도 계속 찾아볼 수 있습니다.</Typography>
  <Box component="form" sx={{display:'flex',gap:1,flexWrap:'wrap',my:2}} onSubmit={e=>{e.preventDefault();resetPages();setQuery(draft.trim());}}>
   <TextField select size="small" label="조회 요구사항" value={requirement} disabled={busy} sx={{minWidth:160}} onChange={e=>{resetPages();setRequirement(e.target.value);}}><MenuItem value="">전체 요구사항</MenuItem>{requirements.map(r=><MenuItem key={r.id} value={r.id}>{r.id} · {r.title}</MenuItem>)}</TextField>
   <TextField select size="small" label="과제 상태" value={status} disabled={busy} onChange={e=>{resetPages();setStatus(e.target.value);}}><MenuItem value="active">진행 중 전체</MenuItem><MenuItem value="all">완료 포함 전체</MenuItem>{Object.entries(improvementStates).map(([id,label])=><MenuItem key={id} value={id}>{label}</MenuItem>)}</TextField>
   <TextField select size="small" label="증거 상태" value={evidenceState} disabled={busy} onChange={e=>{resetPages();setEvidenceState(e.target.value);}}>{[['all','전체 증거'],['pending','검수 대기'],['expiring','7일 내 만료 근거'],['expired','만료됨'],['fail','실패 결과']].map(([id,label])=><MenuItem key={id} value={id}>{label}</MenuItem>)}</TextField>
   <TextField size="small" label="제목·내용·절차 검색" value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} slotProps={{htmlInput:{maxLength:100}}}/><Button type="submit" disabled={busy}>검색</Button><Button type="button" disabled={busy||result.loading} onClick={()=>{resetPages();setRefresh(v=>v+1);}}>루프 새로 조회</Button>
  </Box>
  {result.loading&&<Stack direction="row" spacing={1}><CircularProgress size={20}/><Typography>전체 과제와 증거 확인 중</Typography></Stack>}
  {result.error&&<Alert severity="error">{result.error}</Alert>}
  {result.data&&!data&&<Alert severity="error">선택 현장과 조회 결과가 다릅니다. 새로 조회해 주세요.</Alert>}
  {data&&<>
   <Typography variant="caption">서버 조회 시각 {new Date(data.observed_at).toLocaleString('ko-KR')} · 아래 집계는 검색 조건과 관계없이 선택 범위 전체 기준입니다.</Typography>
   <Box sx={{display:'grid',gridTemplateColumns:{xs:'repeat(2,1fr)',md:'repeat(4,1fr)'},gap:1,my:2}}>{Object.entries(loopCountLabels).map(([id,label])=><Card key={id} variant="outlined"><CardContent><Typography variant="body2">{label}</Typography><Typography variant="h5">{data.counts[id as keyof typeof loopCountLabels]}</Typography></CardContent></Card>)}</Box>
   {!!data.counts.critical&&<Alert severity="error" sx={{mb:2}}>치명 과제가 {data.counts.critical}건 있습니다. 영향 범위를 확인하고 수정·재검증·독립 검수를 먼저 진행하세요.</Alert>}
   <Box component="details" sx={{my:2}}><Typography component="summary" sx={{cursor:'pointer',fontWeight:700}}>다음 검증과 선행조건 · 미인수 {36-data.readiness.approved}개</Typography>
    <Box component="ul" sx={{pl:3}}>{data.readiness.requirements.filter(r=>!r.accepted).map(r=>{const b=data.blockers.find(b=>b.id===r.id)!;const deps=r.dependencies.filter(id=>!data.readiness.requirements.find(x=>x.id===id)?.accepted);return <Box component="li" key={r.id} sx={{my:1}}><Typography>{r.id} · {r.title}</Typography><Typography variant="body2" color="text.secondary">{b.open_defects?`미해결 결함 ${b.open_defects}건 · `:''}{b.missing_kinds.length?`필요한 유효 검수 근거: ${b.missing_kinds.map(k=>testKinds[k]).join(', ')}`:'시험 종류별 근거 충족'}{deps.length?` · 선행 인수: ${deps.join(', ')}`:''}</Typography><Button size="small" disabled={busy} onClick={()=>{resetPages();setRequirement(r.id);setStatus('active');setEvidenceState('all');setDraft('');setQuery('');}}>이 요구사항 조회</Button></Box>;})}</Box>
   </Box>
  <Typography component="h2" variant="h6" sx={{mt:4,mb:2}}>개선 진행 · 표시 {data.improvements.length} / 검색 {data.improvements_total}건</Typography>
  {!data.improvements.length&&<Typography color="text.secondary">등록된 과제가 없습니다.</Typography>}
  {data.improvements.map(i=><Card key={i.id} variant="outlined" sx={{mb:2}}><CardContent><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Chip size="small" label={improvementStates[i.status]}/><Chip size="small" label={`${i.requirement_id} · ${i.kind==='defect'?'결함':'개선'}`} color={i.kind==='defect'?'warning':'info'}/><Typography sx={{fontWeight:700}}>{i.title}</Typography></Stack><Typography sx={{my:2,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{i.description}</Typography>
   <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
    {i.status==='open'&&<Button disabled={busy||!data.permissions.write} onClick={()=>void mutate('platform_transition_improvement_v2',{p_id:i.id,p_expected_revision:i.revision,p_status:'in_progress'},'개선을 시작했습니다.',true)}>개선 시작</Button>}
    {i.status==='in_progress'&&<RetestControl item={i} scopeId={data.scope.id} disabled={busy||!data.permissions.write} mutate={mutate}/>}
    {i.status==='verification'&&<><Button disabled={busy||!data.permissions.write} onClick={()=>void mutate('platform_transition_improvement_v2',{p_id:i.id,p_expected_revision:i.revision,p_status:'in_progress'},'추가 개선 단계로 되돌렸습니다.',true)}>보완 진행</Button><Button disabled={busy||!data.permissions.review||[i.created_by,i.assigned_to].includes(userId)} onClick={()=>void mutate('platform_transition_improvement_v2',{p_id:i.id,p_expected_revision:i.revision,p_status:'closed'},'재검증·독립 검수를 완료했습니다.',true)}>독립 검수 후 완료</Button></>}
   </Stack>
  </CardContent></Card>)}
  <Stack direction="row" spacing={1}><Button disabled={busy||!itemHistory.length} onClick={()=>setItemHistory(v=>v.slice(0,-1))}>이전 과제</Button><Button disabled={busy||!data.next_improvement} onClick={()=>setItemHistory(v=>[...v,data.next_improvement!])}>다음 과제</Button></Stack>
  <Typography component="h2" variant="h6" sx={{mt:4,mb:2}}>검증 증거 · 최근 {data.evidence.length} / 검색 {data.evidence_total}건</Typography>
  {!data.evidence.length&&<Typography color="text.secondary">등록된 증거가 없습니다.</Typography>}
  {data.evidence.map(e=><Card key={e.id} variant="outlined" sx={{mb:2}}><CardContent><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Chip size="small" label={`${e.requirement_id} · ${testKinds[e.test_kind]}`}/><Chip size="small" label={e.result==='pass'?'시험 통과':'시험 실패'} color={e.result==='pass'?'info':'error'}/><Chip size="small" label={e.review?(e.review.decision==='approved'?'검수 승인':'검수 반려'):'검수 대기'}/><Chip size="small" label={environments[e.environment]}/></Stack><Typography sx={{my:2,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{e.summary}</Typography><Typography variant="body2" color="text.secondary">절차 {e.procedure_version} · 측정 {new Date(e.measured_at).toLocaleString('ko-KR')} · 만료 {new Date(e.expires_at).toLocaleString('ko-KR')}</Typography><Button component="a" href={safeEvidenceUrl(e.artifact_uri)??undefined} target="_blank" rel="noopener noreferrer">증거 열기</Button><Typography variant="caption" sx={{display:"block",overflowWrap:'anywhere'}}>SHA-256 {e.artifact_sha256}</Typography>
   {e.review?<Typography variant="body2" sx={{mt:2}}>검수 의견: {e.review.note}</Typography>:<Box sx={{mt:2}}><TextField fullWidth size="small" label="독립 검수 의견 · 링크·해시·전체 조건 대조" value={reviewNotes[e.id]??''} onChange={event=>setReviewNotes(v=>({...v,[e.id]:event.target.value}))} disabled={busy||!data.permissions.review||e.submitted_by===userId}/><Stack direction="row" spacing={1} sx={{mt:1}}>{['approved','rejected'].map(decision=><Button key={decision} disabled={busy||!data.permissions.review||e.submitted_by===userId||(reviewNotes[e.id]??'').trim().length<5||(decision==='approved'&&(e.result!=='pass'||Date.parse(e.expires_at)<=Date.parse(data.observed_at)))} onClick={()=>void mutate('platform_review_evidence',{p_evidence_id:e.id,p_decision:decision,p_note:reviewNotes[e.id]},'독립 검수를 기록했습니다.')}>{decision==='approved'?'검수 승인':'반려'}</Button>)}</Stack>{e.submitted_by===userId&&<Typography variant="caption">본인이 제출한 증거는 다른 검수자가 확인합니다.</Typography>}</Box>}
  </CardContent></Card>)}
  <Stack direction="row" spacing={1}><Button disabled={busy||!evidenceHistory.length} onClick={()=>setEvidenceHistory(v=>v.slice(0,-1))}>이전 증거</Button><Button disabled={busy||!data.next_evidence} onClick={()=>setEvidenceHistory(v=>[...v,data.next_evidence!])}>다음 증거</Button></Stack>
  </>}
 </Box>;
}
function RetestControl({item,scopeId,disabled,mutate}:{item:Improvement;scopeId:string;disabled:boolean;mutate:Mutate}){
 const [opened,setOpened]=useState(false),[before,setBefore]=useState<string|null>(null),[selected,setSelected]=useState('');
 const args={p_id:item.id,p_before:before};
 const query=useGovernanceQuery('platform_retest_candidates',args,JSON.stringify([scopeId,item.id,item.revision,before]),parseRetestCandidates,opened);
 const data=query.data?.scope_id===scopeId&&query.data.item_id===item.id?query.data:null;
 return <Box sx={{width:'100%'}}>
  {!opened?<Button disabled={disabled} onClick={()=>setOpened(true)}>재검증 증거 찾기</Button>:<>
   {query.loading&&<Typography>이 과제와 일치하는 재시험 조회 중</Typography>}{query.error&&<Alert severity="error">{query.error}</Alert>}
   {query.data&&!data&&<Alert severity="error">재시험의 검증 범위가 다릅니다.</Alert>}
   {data&&<Stack direction={{xs:'column',sm:'row'}} spacing={1}><TextField select fullWidth size="small" label="이 과제의 유효한 재시험" value={data.evidence.some(e=>e.id===selected)?selected:''} disabled={disabled} onChange={e=>setSelected(e.target.value)}><MenuItem value="">통과 증거 선택</MenuItem>{data.evidence.map(e=><MenuItem key={e.id} value={e.id}>{testKinds[e.test_kind]} · {e.summary.slice(0,60)}</MenuItem>)}</TextField><Button disabled={disabled||!data.evidence.some(e=>e.id===selected)} onClick={()=>void mutate('platform_transition_improvement_v2',{p_id:item.id,p_expected_revision:item.revision,p_status:'verification',p_evidence_id:selected},'재검증 증거를 연결했습니다. 독립 검수를 진행해 주세요.',true)}>검수 요청</Button><Button disabled={disabled||!before} onClick={()=>{setBefore(null);setSelected('');}}>최신 재시험</Button><Button disabled={disabled||!data.next} onClick={()=>{setBefore(data.next);setSelected('');}}>이전 재시험 더 보기</Button></Stack>}
   {data&&!data.evidence.length&&<Typography variant="body2">과제 등록 후 측정·등록한 같은 요구사항의 통과 증거가 필요합니다. 실패에서 시작한 과제는 시험 종류와 환경도 같아야 합니다.</Typography>}
  </>}
 </Box>;
}
