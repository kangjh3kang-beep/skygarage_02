import { useState } from 'react';
import { Alert,Box,Button,Card,CardContent,Chip,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,Checkbox,MenuItem,Stack,TextField,Typography } from '@mui/material';
import { Link,useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGovernanceQuery } from '../hooks/useGovernanceQuery';
import { parseGovernanceDirectory,type Directory } from '../../lib/governance';
import { parseRequestSnapshot,parseRequestDetail,requestActionLabels,type RequestSnapshot } from '../../lib/service-requests';
import { requestStatusLabels } from '../../sgp/request-labels';
import { useServiceRequestCommand } from '../../hooks/useServiceRequestCommand';
const localInput=(date:string|null)=>{if(!date)return '';const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const filters:Record<string,string>={open:'처리 중 전체',unassigned:'미배정',overdue:'기한 초과',submitted:'접수됨',reviewing:'검토 중',resolved:'답변 완료',rejected:'반려',all:'전체 이력'};
function RequestEditor({userId,siteId,id,snapshot,sites,onComplete,onClose}:{userId:string;siteId:string|null;id:string;snapshot:RequestSnapshot;sites:Directory['sites'];onComplete:()=>void;onClose:()=>void}){
 const [revision,refresh]=useState(0);const query=useGovernanceQuery('platform_service_request_detail',{p_id:id,p_site_id:siteId},`${userId}:${siteId}:${id}:${revision}`,parseRequestDetail);
 const valid=query.data?.request.id===id&&query.data.request.site_id===siteId;
 return <Dialog open onClose={onClose} fullWidth maxWidth="md"><DialogTitle>요청 상세·배정·답변</DialogTitle><DialogContent>
  {query.loading&&<Typography role="status">요청 상세와 이력을 조회하고 있습니다.</Typography>}
  {query.error&&<Alert severity="error">{query.error} 이전 상세는 표시하지 않습니다.</Alert>}
  {query.data&&!valid&&<Alert severity="error">조회한 요청의 현장이 일치하지 않습니다. 요청함을 다시 조회하세요.</Alert>}
  {valid&&query.data&&<RequestActions key={`${id}:${query.data.request.revision}`} detail={query.data} userId={userId} siteId={siteId} snapshot={snapshot} sites={sites} onComplete={onComplete} onClose={onClose}/>}
 </DialogContent><DialogActions><Button onClick={()=>refresh(n=>n+1)}>요청 상세 새로 조회</Button><Button onClick={onClose}>상세 닫기</Button></DialogActions></Dialog>;
}
function RequestActions({detail,userId,siteId,snapshot,sites,onComplete,onClose}:{detail:ReturnType<typeof parseRequestDetail>;userId:string;siteId:string|null;snapshot:RequestSnapshot;sites:Directory['sites'];onComplete:()=>void;onClose:()=>void}){
 const row=detail.request;const [assignee,setAssignee]=useState(snapshot.assignees.some(a=>a.id===row.assigned_to)?row.assigned_to??'':''),[due,setDue]=useState(localInput(row.due_at)),[reason,setReason]=useState(''),[reply,setReply]=useState(row.response??''),[decision,setDecision]=useState(row.status==='submitted'?'reviewing':'resolved'),[target,setTarget]=useState(''),[confirmed,setConfirmed]=useState(false);
 const command=useServiceRequestCommand(()=>{onComplete();onClose();});
 const closed=['resolved','rejected'].includes(row.status),allowed=snapshot.can_manage&&!closed,blocked=command.busy||!allowed||reason.trim().length<5;
 const base={id:row.id,site_id:siteId,expected_revision:row.revision,reason:reason.trim()};
 function saveAssignment(){void command.run('assign',{...base,assignee_id:assignee||null,due_at:due?new Date(due).toISOString():null});}
 return <Stack spacing={2} sx={{mt:1}}><Typography component="h2" variant="h6">{row.subject}</Typography><Chip label={requestStatusLabels[row.status]} sx={{alignSelf:'flex-start'}}/>
  <Typography sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row.description}</Typography>
  {row.response&&<Alert severity="info">현재 회원에게 표시되는 답변: {row.response}</Alert>}
  {closed&&<Alert severity="info">종료된 요청입니다. 이력은 보존되며 후속 문의는 새로 접수합니다.</Alert>}
  {!snapshot.can_manage&&<Alert severity="info">이 계정은 조회 전용입니다.</Alert>}
  {command.error&&<Alert severity="error">{command.error}</Alert>}
  {allowed&&<>
   <Typography variant="body2">사유·답변에 비밀번호·인증번호·주민등록번호나 불필요한 개인정보를 입력하지 마세요.</Typography>
   <TextField label="변경 사유(5~500자)" multiline minRows={2} value={reason} disabled={command.busy} onChange={e=>setReason(e.target.value)} slotProps={{htmlInput:{maxLength:500}}}/>
   <Typography component="h3" variant="h6">1. 담당자·목표 기한 설정</Typography><Typography variant="body2">현재 처리 권한이 유효한 담당자만 배정할 수 있습니다. 목표 기한은 현재 기기 시간 기준, 현재 이후 30일 이내로 설정합니다. 기한을 비우면 미설정이며 자동 알림이나 계약상 SLA는 제공하지 않습니다.</Typography>
   {row.assigned_to&&!snapshot.assignees.some(a=>a.id===row.assigned_to)&&<Alert severity="warning">기존 담당자의 처리 권한이 만료됐습니다. 유효한 담당자로 재배정하세요.</Alert>}
   <TextField select label="배정할 담당자" value={assignee} disabled={command.busy} onChange={e=>{setAssignee(e.target.value);if(!e.target.value)setDue('');}}><MenuItem value="">미배정</MenuItem>{snapshot.assignees.map(a=><MenuItem key={a.id} value={a.id}>{a.name}{a.id===userId?' (본인)':''}</MenuItem>)}</TextField>
   <TextField label="운영 목표 기한(현재 기기 시간)" type="datetime-local" value={due} disabled={command.busy||!assignee} onChange={e=>setDue(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/>
   <Button variant="outlined" disabled={blocked||!!due&&(!Number.isFinite(Date.parse(due))||Date.parse(due)<=Date.now()||Date.parse(due)>Date.now()+30*86400000)} onClick={saveAssignment}>담당자·목표 기한 저장</Button>
   <Typography component="h3" variant="h6">2. 배정된 담당자의 상태·답변 처리</Typography>
   {row.assigned_to!==userId&&<Alert severity="info">배정된 담당자만 다음 단계를 처리할 수 있습니다. 본인이 처리하려면 먼저 본인에게 배정하고 다시 상세를 여세요.</Alert>}
   <TextField select label="다음 처리 상태" value={decision} disabled={command.busy||row.assigned_to!==userId} onChange={e=>setDecision(e.target.value)}>{(row.status==='submitted'?['reviewing']:['resolved','rejected']).map(s=><MenuItem key={s} value={s}>{requestStatusLabels[s as keyof typeof requestStatusLabels]}</MenuItem>)}</TextField>
   <TextField label="회원에게 표시할 답변(최대 2000자)" multiline minRows={3} value={reply} disabled={command.busy||row.assigned_to!==userId} onChange={e=>setReply(e.target.value)} slotProps={{htmlInput:{maxLength:2000}}}/>
   <Button variant="contained" disabled={blocked||row.assigned_to!==userId||(decision!=='reviewing'&&reply.trim().length<2)} onClick={()=>void command.run('review',{...base,status:decision,response:reply.trim()||null})}>{row.status==='submitted'?'검토 시작 확정':'답변 처리 확정'}</Button>
   {snapshot.headquarters&&siteId===null&&<><Typography component="h3" variant="h6">선택: 확인된 현장으로 연결</Typography><Alert severity="warning">요청자가 이용하려는 현장을 먼저 확인하세요. 해당 현장의 활성 소속이 있는 경우에만 연결되며 요청 내용이 현장 담당자에게 공개됩니다. 연결하면 기존 담당자와 목표 기한을 비우고 현장에서 다시 배정합니다. 연결 후 다른 현장으로 재이동할 수 없습니다.</Alert>
    <TextField select label="연결할 현장" value={target} disabled={command.busy} onChange={e=>setTarget(e.target.value)}><MenuItem value="">현장을 선택하세요</MenuItem>{sites.map(s=><MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>
    <FormControlLabel control={<Checkbox checked={confirmed} disabled={command.busy} onChange={e=>setConfirmed(e.target.checked)}/>} label="요청자의 이용 현장과 내용 공개 범위를 확인했습니다"/>
    <Button disabled={blocked||!target||!confirmed} onClick={()=>void command.run('route',{...base,target_site_id:target,confirmed})}>확인한 현장에 요청 연결</Button></>}
  </>}
  <Typography component="h3" variant="h6">최근 변경 이력 30건</Typography>{!detail.history.length&&<Typography>이전 방식으로 접수된 요청입니다. 기존 접수·감사 기록은 유지됩니다.</Typography>}
  {detail.history.map(h=><Box key={h.id} sx={{borderTop:1,borderColor:'divider',pt:1}}><Typography>{requestActionLabels[h.action]??h.action} · {new Date(h.created_at).toLocaleString('ko-KR')} · 변경 {h.details.revision}</Typography><Typography sx={{whiteSpace:'pre-wrap'}}>{h.reason}</Typography>{h.details.response&&<Typography sx={{whiteSpace:'pre-wrap'}}>당시 답변: {h.details.response}</Typography>}</Box>)}
 </Stack>;
}
function RequestQueue({userId,siteId,sites}:{userId:string;siteId:string|null;sites:Directory['sites']}){
 const [revision,refresh]=useState(0),[status,setStatus]=useState('open'),[cursors,setCursors]=useState<(string|null)[]>([null]),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');const after=cursors.at(-1)??null;
 const query=useGovernanceQuery('platform_service_request_snapshot',{p_site_id:siteId,p_status:status,p_after:after},`${userId}:${siteId}:${status}:${after}:${revision}`,parseRequestSnapshot);
 const data=query.data?.site_id===siteId?query.data:null;
 return <Stack spacing={2}><Stack direction="row" spacing={1}><TextField select label="요청함 필터" value={status} onChange={e=>{setSelected(null);setStatus(e.target.value);setCursors([null]);}} sx={{minWidth:160}}>{Object.entries(filters).map(([k,v])=><MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField><Button onClick={()=>{setSelected(null);setNotice('');refresh(n=>n+1);}}>요청함 새로 조회</Button></Stack>
  {query.loading&&<Typography role="status">선택한 요청함을 조회하고 있습니다.</Typography>}{query.error&&<Alert severity="error">{query.error} 이전 요청 목록은 표시하지 않습니다.</Alert>}{query.data&&!data&&<Alert severity="error">조회 범위가 일치하지 않습니다. 다시 조회하세요.</Alert>}{notice&&<Alert severity="success">{notice}</Alert>}
  {data&&<><Typography>{siteId===null?'본사 공통·무소속 요청':sites.find(s=>s.id===siteId)?.name} · {data.can_manage?'변경 가능':'조회 전용'}</Typography><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Chip label={`처리 중 ${data.counts.open}건`}/><Chip label={`미배정 ${data.counts.unassigned}건`}/><Chip label={`기한 초과 ${data.counts.overdue}건`} color={data.counts.overdue?'warning':'default'}/></Stack>
   {!data.rows.length&&<Typography>선택한 조건의 요청이 없습니다.</Typography>}{data.rows.map(r=><Card key={r.id} variant="outlined"><CardContent><Stack spacing={1}><Typography component="h3" variant="h6">{r.subject}</Typography><Typography>{requestStatusLabels[r.status]} · 요청자 {r.requester} · {r.assigned_to?r.assignee_name:'미배정'}</Typography><Typography>목표 기한 {r.due_at?new Date(r.due_at).toLocaleString('ko-KR'):'미설정'}{r.overdue?' · 기한 초과':''}</Typography><Button onClick={()=>setSelected(r.id)} aria-label={`${r.subject} 상세·배정·답변`}>상세·배정·답변</Button></Stack></CardContent></Card>)}
   <Stack direction="row" spacing={1}><Button disabled={cursors.length<2||query.loading} onClick={()=>{setSelected(null);setCursors(c=>c.slice(0,-1));}}>이전 50건</Button><Button disabled={!data.next_cursor||query.loading} onClick={()=>{setSelected(null);setCursors(c=>[...c,data.next_cursor]);}}>다음 50건</Button></Stack><Typography variant="caption">조회 시각 {new Date(data.observed_at).toLocaleString('ko-KR')} · 목록은 식별자 순서, 각 페이지 최대 50건입니다. 기한 초과 필터로 지연 요청을 확인하세요.</Typography>
  </>}
  {selected&&data&&<RequestEditor key={`${userId}:${siteId}:${selected}`} userId={userId} siteId={siteId} id={selected} snapshot={data} sites={sites} onClose={()=>setSelected(null)} onComplete={()=>{setNotice('처리했습니다. 최신 상태와 변경 이력을 다시 확인하세요.');refresh(n=>n+1);}}/>}
 </Stack>;
}
export default function SupportTickets({embedded=false}:{embedded?:boolean}){
 const {user,role}=useAuth();const [params,setParams]=useSearchParams();const [revision,refresh]=useState(0);
 const directory=useGovernanceQuery('platform_governance_directory',{},`${user?.id}:${role}:${revision}`,parseGovernanceDirectory,!!user);
 const selected=params.get('site')??(directory.data?.headquarters?'headquarters':'');
 const site=directory.data?.sites.find(s=>s.id===selected);const headquarters=selected==='headquarters'&&directory.data?.headquarters;
 return <Box sx={{maxWidth:1200,mx:'auto',pb:4}}><Typography component={embedded?'h2':'h1'} variant={embedded?'h5':'h4'} sx={{mb:2}}>요청 배정·처리</Typography>
  <Alert severity="info" sx={{mb:2}}>요청함 선택 → 상세 확인 → 담당자·목표 기한 저장 → 배정된 담당자의 검토 시작 → 답변 완료·반려 순서입니다. 요청 처리만으로 회원 승인·차량 등록·출입·결제가 실행되지는 않습니다.</Alert>
  <Stack direction="row" spacing={1} useFlexGap sx={{mb:2,flexWrap:'wrap'}}><Button component={Link} to="/admin/governance">현장 담당 권한 설정</Button><Button component={Link} to="/admin/residents">회원 소속 확인</Button><Button disabled={directory.loading} onClick={()=>refresh(n=>n+1)}>요청함 목록 새로 조회</Button></Stack>
  {directory.loading&&<Typography role="status">접근 가능한 요청함을 확인하고 있습니다.</Typography>}{directory.error&&<Alert severity="error">{directory.error}</Alert>}
  {directory.data&&<TextField select fullWidth label="관리할 요청함" value={site?selected:headquarters?'headquarters':''} onChange={e=>setParams(e.target.value&&e.target.value!=='headquarters'?{site:e.target.value}:{})} sx={{mb:2}}><MenuItem value="">요청함을 선택하세요</MenuItem>{directory.data.headquarters&&<MenuItem value="headquarters">본사 공통·무소속 요청</MenuItem>}{directory.data.sites.map(s=><MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>}
  {!directory.loading&&directory.data&&!site&&!headquarters&&<Typography>담당 현장을 선택하세요. 담당 권한이 없다면 최고관리자에게 현장 배정을 요청하세요.</Typography>}
  {directory.data&&user&&(site||headquarters)&&<RequestQueue key={`${user.id}:${selected}:${revision}`} userId={user.id} siteId={headquarters?null:site!.id} sites={directory.data.sites}/>}
 </Box>;
}
