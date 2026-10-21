import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGovernanceQuery } from '../hooks/useGovernanceQuery';
import { parseGovernanceDirectory } from '../../lib/governance';
import { membershipLabel, parseMembershipSnapshot, type MembershipKind, type MembershipRow, type SiteProfile } from '../../lib/membership';
import { useMembershipCommand } from '../../hooks/useMembershipCommand';

function ProfileEditor({profile,save,busy,allowed}:{profile:SiteProfile;save:(p:SiteProfile)=>void;busy:boolean;allowed:boolean}){
 const [draft,setDraft]=useState(profile);
 return <Card variant="outlined"><CardContent><Typography component="h2" variant="h6">현장 운영 안내정보</Typography>
  <Typography variant="body2" sx={{mb:2}}>운영 주소·관리사무소 연락처·안내 시간을 저장합니다. 자동 장비 제어 시간표와 별개입니다.</Typography>
  <Stack spacing={2}><TextField label="현장 주소" value={draft.address} disabled={!allowed||busy} onChange={e=>setDraft({...draft,address:e.target.value})} slotProps={{htmlInput:{maxLength:300}}}/>
   <TextField label="관리사무소 연락처" value={draft.office_phone} disabled={!allowed||busy} onChange={e=>setDraft({...draft,office_phone:e.target.value})} slotProps={{htmlInput:{maxLength:30}}}/>
   <TextField label="운영 안내 시간" value={draft.service_hours} disabled={!allowed||busy} onChange={e=>setDraft({...draft,service_hours:e.target.value})} slotProps={{htmlInput:{maxLength:120}}}/>
   <Button variant="outlined" disabled={!allowed||busy} onClick={()=>save(draft)}>운영 안내정보 저장</Button></Stack>
 </CardContent></Card>;
}
const actionLabels:Record<string,string>={profile:'운영 안내정보 변경',issue_invite:'초대코드 발급',revoke_invite:'초대코드 폐기',apply:'소속 신청',withdraw:'신청 철회',review:'신청 검토',revoke_member:'소속 회수'};
function SiteWorkspace({userId,siteId,overview}:{userId:string;siteId:string;overview:boolean}){
 const [revision,refresh]=useState(0),[kind,setKind]=useState<MembershipKind>(overview?'history':'requests'),[status,setStatus]=useState(overview?'all':'pending'),[cursors,setCursors]=useState<(string|null)[]>([null]);
 const [dialog,setDialog]=useState<{row:MembershipRow;action:'approved'|'rejected'|'revoke'}|null>(null),[reason,setReason]=useState('');
 const [days,setDays]=useState(1),[uses,setUses]=useState(10),[code,setCode]=useState<string|null>(null),[notice,setNotice]=useState('');
 const command=useMembershipCommand(()=>{refresh(n=>n+1);});
 const after=cursors.at(-1)??null;
 const query=useGovernanceQuery('platform_membership_snapshot',{p_site_id:siteId,p_kind:kind,p_status:status,p_after:after},`${userId}:${siteId}:${kind}:${status}:${after}:${revision}`,parseMembershipSnapshot);
 const data=query.data,blocked=command.busy||query.loading||!!query.error;
 function tab(value:MembershipKind){setKind(value);setStatus(value==='requests'?'pending':'all');setCursors([null]);setDialog(null);command.clearError();}
 async function issue(){setNotice('');setCode(null);const result=await command.run('issue_invite',{site_id:siteId,days,max_uses:uses});if(!result)return;
  if(typeof result.code==='string'&&/^[0-9a-f]{64}$/.test(result.code))setCode(result.code);
  else setNotice('발급 기록은 확인됐지만 코드는 다시 표시할 수 없습니다. 처음 응답을 받지 못했다면 목록에서 해당 코드를 폐기하고 새로 발급하세요.');
 }
 async function decide(){if(!dialog)return;const {row,action}=dialog;
  const result=await command.run(action==='revoke'?'revoke_member':'review',action==='revoke'?{site_id:siteId,user_id:row.user_id,expected_revision:row.revision,reason:reason.trim()}:{site_id:siteId,id:row.id,expected_revision:row.revision,decision:action,reason:reason.trim()});
  if(result){setDialog(null);setReason('');setNotice('처리됐습니다. 새로 조회된 상태와 변경 이력을 확인하세요.');}
 }
 const choices=kind==='requests'?['all','pending','approved','rejected','withdrawn']:['all','pending','active','revoked'];
 return <Stack spacing={2}>
  {command.error&&<Alert severity="error">{command.error}</Alert>}{notice&&<Alert severity="info">{notice}</Alert>}
  {query.loading&&<Typography role="status">선택한 현장 정보를 조회하고 있습니다.</Typography>}
  {query.error&&<Alert severity="error">{query.error} 이전 목록은 표시하지 않습니다.</Alert>}
  <Button disabled={command.busy||query.loading} onClick={()=>{setDialog(null);refresh(n=>n+1);}}>현장 정보 새로 조회</Button>
  {data&&<>
   <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Typography component="h2" variant="h6">{data.site.name}</Typography><Chip size="small" label={membershipLabel(data.site.phase)}/><Chip size="small" label={data.can_manage?'변경 가능':'조회 전용'}/></Stack>
   <Typography>승인 대기 {data.counts.pending}명 · 승인된 소속 {data.counts.active}명 · 회수 {data.counts.revoked}명</Typography>
   {data.site.phase==='sandbox'&&<Alert severity="info">시험용 현장입니다. 회원 승인은 플랫폼 소속만 연결하며 실제 출입·주차·장비 운행을 허가하지 않습니다.</Alert>}
   {overview&&<ProfileEditor key={data.profile.revision} profile={data.profile} allowed={data.can_manage} busy={blocked} save={p=>void command.run('profile',{site_id:siteId,expected_revision:p.revision,address:p.address,office_phone:p.office_phone,service_hours:p.service_hours})}/>}
   <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}>{([['requests','회원 신청'],['members','회원 목록'],['invites','초대코드'],['history','변경 이력']] as const).map(([value,label])=><Button key={value} variant={kind===value?'contained':'outlined'} disabled={command.busy} onClick={()=>tab(value)}>{label}</Button>)}</Stack>
   {(kind==='requests'||kind==='members')&&<TextField select label="처리 상태" value={status} onChange={e=>{setStatus(e.target.value);setCursors([null]);}} sx={{maxWidth:260}}>{choices.map(v=><MenuItem key={v} value={v}>{v==='all'?'전체':membershipLabel(v)}</MenuItem>)}</TextField>}
   {kind==='invites'&&<Card variant="outlined"><CardContent><Typography component="h3" variant="h6">회원 신청용 초대코드 발급</Typography><Typography sx={{my:1}}>코드는 발급 직후 한 번만 표시됩니다. 현장 이용 대상자에게 직접 전달하세요. 코드만으로 소속이 승인되지는 않습니다.</Typography>
    <Stack direction={{xs:'column',sm:'row'}} spacing={1}><TextField type="number" label="유효기간(일)" value={days} disabled={blocked||!data.can_manage} onChange={e=>setDays(Number(e.target.value))} slotProps={{htmlInput:{min:1,max:7}}}/><TextField type="number" label="최대 신청 횟수" value={uses} disabled={blocked||!data.can_manage} onChange={e=>setUses(Number(e.target.value))} slotProps={{htmlInput:{min:1,max:100}}}/><Button disabled={blocked||!data.can_manage||!Number.isInteger(days)||days<1||days>7||!Number.isInteger(uses)||uses<1||uses>100} onClick={()=>void issue()}>초대코드 발급</Button></Stack>
   </CardContent></Card>}
   {code&&<Alert severity="success"><Typography>지금 표시된 코드를 복사해 보관하세요. 화면을 벗어나면 다시 볼 수 없습니다.</Typography><Typography sx={{fontFamily:'monospace',overflowWrap:'anywhere',userSelect:'all'}}>{code}</Typography><Button onClick={()=>setCode(null)}>코드 숨기기</Button></Alert>}
   {!data.rows.length&&<Typography>선택한 조건의 기록이 없습니다.</Typography>}
   {data.rows.map(row=><Card key={row.id} variant="outlined"><CardContent>
    {kind==='history'?<><Typography>{actionLabels[row.action??'']??row.action}</Typography><Typography variant="body2">{new Date(row.created_at!).toLocaleString('ko-KR')} · 처리 계정 {row.actor_id?.slice(-8)}</Typography><Typography sx={{whiteSpace:'pre-wrap'}}>{row.reason}</Typography></>:kind==='invites'?<><Typography>코드 식별자 {row.id.slice(-8)} · 신청 {row.uses}/{row.max_uses}회</Typography><Typography>만료 {new Date(row.expires_at!).toLocaleString('ko-KR')} · {row.revoked?'폐기됨':Date.parse(row.expires_at!)<=Date.now()?'만료됨':'발급됨'}</Typography><Button disabled={blocked||!data.can_manage||row.revoked} onClick={()=>void command.run('revoke_invite',{site_id:siteId,id:row.id,expected_revision:row.revision})}>초대코드 폐기</Button></>:<>
     <Typography component="h3" variant="h6">{row.display_name} · {row.unit_label}</Typography><Typography variant="body2">회원 식별자 {row.user_id?.slice(-8)} · 문자 인증 {row.phone_verified?'확인':'미확인'}</Typography><Chip label={membershipLabel(row.status!)} size="small" sx={{my:1}}/>{row.reason&&<Typography sx={{whiteSpace:'pre-wrap'}}>{row.reason}</Typography>}
     {kind==='requests'&&row.status==='pending'&&<Stack direction="row" spacing={1}><Button disabled={blocked||!data.can_manage||!row.phone_verified||row.user_id===userId} onClick={()=>{setDialog({row,action:'approved'});setReason('');}}>소속 승인</Button><Button disabled={blocked||!data.can_manage} onClick={()=>{setDialog({row,action:'rejected'});setReason('');}}>신청 반려</Button></Stack>}
     {kind==='members'&&row.status==='active'&&<Button color="warning" disabled={blocked||!data.can_manage} onClick={()=>{setDialog({row,action:'revoke'});setReason('');}}>소속 회수</Button>}
    </>}
   </CardContent></Card>)}
   <Stack direction="row" spacing={1}><Button disabled={blocked||cursors.length<2} onClick={()=>setCursors(c=>c.slice(0,-1))}>이전 50건</Button><Button disabled={blocked||!data.next_cursor} onClick={()=>setCursors(c=>[...c,data.next_cursor])}>다음 50건</Button></Stack>
   <Typography variant="caption">조회 시각 {new Date(data.observed_at).toLocaleString('ko-KR')} · 목록은 식별자 순서이며 페이지마다 최대 50건입니다.</Typography>
  </>}
  <Dialog open={!!dialog} onClose={()=>{if(!command.busy)setDialog(null);}} fullWidth maxWidth="sm"><DialogTitle>{dialog?.action==='approved'?'회원 소속 승인':dialog?.action==='rejected'?'회원 신청 반려':'회원 소속 회수'}</DialogTitle><DialogContent><Typography sx={{my:1}}>{dialog?.row.display_name} · {dialog?.row.unit_label}</Typography><Typography sx={{mb:2}}>{dialog?.action==='revoke'?'회수 즉시 이 현장의 소속과 등록 차량의 확인 상태가 해제됩니다. 다른 현장 소속은 유지됩니다.':'실제 입주·이용 자격을 별도로 확인하고 처리 근거를 남기세요. 문자 인증만으로 입주 자격을 판단하지 마세요.'}</Typography><TextField fullWidth multiline minRows={3} label="처리 사유(5~500자)" value={reason} disabled={command.busy} onChange={e=>setReason(e.target.value)} slotProps={{htmlInput:{maxLength:500}}}/></DialogContent><DialogActions><Button disabled={command.busy} onClick={()=>setDialog(null)}>취소</Button><Button variant="contained" disabled={blocked||reason.trim().length<5} onClick={()=>void decide()}>처리 확정</Button></DialogActions></Dialog>
 </Stack>;
}
export function SiteOperations(){return <SiteMembershipWorkbench overview/>;}
export default function SiteMembershipWorkbench({overview=false}:{overview?:boolean}){
 const {user,role}=useAuth();const [params,setParams]=useSearchParams();const selected=params.get('site')??'';
 const [revision,refresh]=useState(0);
 const directory=useGovernanceQuery('platform_governance_directory',{},`${user?.id}:${role}:${revision}`,parseGovernanceDirectory,!!user);
 const site=directory.data?.sites.find(s=>s.id===selected);
 return <Box sx={{maxWidth:1200,mx:'auto',pb:6}}><Typography component="h1" variant="h4" sx={{mb:2}}>{overview?'단지·현장 운영 관리':'회원 신청·소속 관리'}</Typography>
  <Alert severity="info" sx={{mb:2}}>현장 초대코드 → 회원의 설정 화면에서 신청 → 담당자의 자격 확인과 승인 순서입니다. 신청 중에는 소속 권한이 생기지 않습니다. 주소·세대 정보에 민감한 증빙 원문을 입력하지 마세요.</Alert>
  <Stack direction="row" spacing={1} useFlexGap sx={{mb:2,flexWrap:'wrap'}}><Button component={Link} to="/admin/templates">새 현장 생성</Button><Button component={Link} to="/admin/governance">조직·담당 권한 설정</Button><Button component={Link} to={overview?`/admin/residents${selected?'?site='+selected:''}`:`/admin/complexes${selected?'?site='+selected:''}`}>{overview?'회원 관리 열기':'현장 안내정보 열기'}</Button><Button disabled={directory.loading} onClick={()=>refresh(n=>n+1)}>현장 목록 새로 조회</Button></Stack>
  {directory.loading&&<Typography role="status">접근 가능한 현장을 조회하고 있습니다.</Typography>}{directory.error&&<Alert severity="error">{directory.error}</Alert>}
  {directory.data&&<TextField select fullWidth label="관리할 현장" value={site?selected:''} onChange={e=>setParams(e.target.value?{site:e.target.value}:{})} sx={{mb:2}}><MenuItem value="">현장을 선택하세요</MenuItem>{directory.data.sites.map(s=><MenuItem key={s.id} value={s.id}>{s.name} · {membershipLabel(s.phase)}</MenuItem>)}</TextField>}
  {directory.data&&!directory.data.sites.length&&<Typography>접근 가능한 현장이 없습니다. 최고관리자는 조직과 현장을 생성하고, 현장 담당자는 담당 권한을 부여받으세요.</Typography>}
  {site&&user&&<SiteWorkspace key={`${user.id}:${site.id}:${revision}`} userId={user.id} siteId={site.id} overview={overview}/>}
 </Box>;
}
