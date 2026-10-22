import { useState } from 'react';
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useGovernanceQuery } from '../hooks/useGovernanceQuery';
import { useMembershipCommand } from '../../hooks/useMembershipCommand';
import { parseResidenceDirectory, type ResidenceDirectory as Directory } from '../../lib/residence';

function Pages({cursors,setCursors,data,busy,label,onChange}:{cursors:(string|null)[];setCursors:(x:(string|null)[])=>void;data:Directory|null;busy:boolean;label:string;onChange?:()=>void}){
 return <Stack direction="row" spacing={1}><Button disabled={busy||cursors.length<2} onClick={()=>{onChange?.();setCursors(cursors.slice(0,-1));}}>{label} 이전 50건</Button><Button disabled={busy||!data?.next_cursor} onClick={()=>{onChange?.();setCursors([...cursors,data!.next_cursor]);}}>{label} 다음 50건</Button></Stack>;
}

// Only managers/reviewers can read this directory. Applicants never enumerate units.
export function RegisteredUnitPicker({userId,siteId,value,onChange}:{userId:string;siteId:string;value:string|null;onChange:(id:string|null)=>void}){
 const [building,setBuilding]=useState(''),[bc,setBc]=useState<(string|null)[]>([null]),[uc,setUc]=useState<(string|null)[]>([null]),[rev,refresh]=useState(0);
 const bq=useGovernanceQuery('platform_residence_directory',{p_site_id:siteId,p_after:bc.at(-1)},`${userId}:${siteId}:picker:b:${bc.at(-1)}:${rev}`,parseResidenceDirectory);
 const uq=useGovernanceQuery('platform_residence_directory',{p_site_id:siteId,p_building_id:building,p_after:uc.at(-1)},`${userId}:${siteId}:picker:u:${building}:${uc.at(-1)}:${rev}`,parseResidenceDirectory,!!building);
 function clearBuilding(){setBuilding('');setUc([null]);onChange(null);}
 return <Stack spacing={1} sx={{mt:2}}>
  <Typography variant="body2">실제 자격을 확인한 뒤 등록된 동·세대를 선택하세요. 세대별로 여러 회원을 연결할 수 있으며 소유권 증명은 별도로 확인합니다.</Typography>
  {bq.error&&<Alert severity="error">{bq.error}</Alert>}{uq.error&&<Alert severity="error">{uq.error}</Alert>}
  {bq.loading&&<Typography role="status">등록 건물을 조회하고 있습니다.</Typography>}
  {bq.data&&<><TextField select label="승인할 등록 건물" value={building} onChange={e=>{setBuilding(e.target.value);setUc([null]);onChange(null);}}><MenuItem value="">건물 선택</MenuItem>{bq.data.rows.filter(r=>r.active).map(r=><MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}</TextField><Pages label="선택 건물" cursors={bc} setCursors={setBc} data={bq.data} busy={bq.loading} onChange={clearBuilding}/>{!bq.data.rows.some(r=>r.active)&&<Typography>이 페이지에 사용 중인 건물이 없습니다.</Typography>}</>}
  {uq.loading&&<Typography role="status">등록 세대를 조회하고 있습니다.</Typography>}
  {uq.data&&<><TextField select label="승인할 등록 세대" value={value??''} onChange={e=>onChange(e.target.value||null)}><MenuItem value="">세대 선택</MenuItem>{uq.data.rows.filter(r=>r.active).map(r=><MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}</TextField><Pages label="선택 세대" cursors={uc} setCursors={setUc} data={uq.data} busy={uq.loading} onChange={()=>onChange(null)}/>{!uq.data.rows.some(r=>r.active)&&<Typography>이 페이지에 사용 중인 세대가 없습니다.</Typography>}</>}
  <Button onClick={()=>{clearBuilding();refresh(n=>n+1);}}>등록 건물·세대 새로 조회</Button>
 </Stack>;
}

export default function ResidenceDirectory({userId,siteId,onChanged}:{userId:string;siteId:string;onChanged:()=>void}){
 const [building,setBuilding]=useState(''),[bc,setBc]=useState<(string|null)[]>([null]),[uc,setUc]=useState<(string|null)[]>([null]),[rev,refresh]=useState(0);
 const [buildingLabel,setBuildingLabel]=useState(''),[unitLabel,setUnitLabel]=useState(''),[reason,setReason]=useState(''),[notice,setNotice]=useState('');
 const command=useMembershipCommand(()=>{refresh(n=>n+1);onChanged();});
 const bq=useGovernanceQuery('platform_residence_directory',{p_site_id:siteId,p_after:bc.at(-1)},`${userId}:${siteId}:b:${bc.at(-1)}:${rev}`,parseResidenceDirectory);
 const uq=useGovernanceQuery('platform_residence_directory',{p_site_id:siteId,p_building_id:building,p_after:uc.at(-1)},`${userId}:${siteId}:u:${building}:${uc.at(-1)}:${rev}`,parseResidenceDirectory,!!building);
 const data=bq.data,selected=data?.rows.find(r=>r.id===building),busy=command.busy||bq.loading||!!bq.error;
 async function run(action:string,payload:Record<string,unknown>){setNotice('');const result=await command.run(action,{site_id:siteId,...payload});if(result){setBuildingLabel('');setUnitLabel('');setNotice('원장 변경이 저장됐습니다. 새 목록과 변경 이력을 확인하세요.');}}
 return <Card variant="outlined"><CardContent><Stack spacing={2}>
  <Typography component="h2" variant="h6">건물·세대 원장</Typography>
  <Typography>건물 → 세대 등록 → 회원의 실제 자격 확인 → 승인할 세대 선택 순서입니다. 신청자가 입력한 동·호를 자동으로 신뢰하지 않습니다.</Typography>
  <Typography variant="body2">명칭은 등록 후 고정됩니다. 오기를 고치려면 기존 항목을 사용 중지하고 새로 등록하세요. 사용 중지해도 과거 연결 이력은 보존됩니다. 현재 소속이 연결된 세대는 소속 회수·재연결 후 중지할 수 있습니다.</Typography>
  {command.error&&<Alert severity="error">{command.error}</Alert>}{notice&&<Alert severity="success">{notice}</Alert>}{bq.error&&<Alert severity="error">{bq.error} 이전 원장은 표시하지 않습니다.</Alert>}{bq.loading&&<Typography role="status">건물 원장을 조회하고 있습니다.</Typography>}
  <Button disabled={command.busy||bq.loading} onClick={()=>refresh(n=>n+1)}>건물·세대 원장 새로 조회</Button>
  {data&&<>
   <Typography>승인 방식: {data.policy.mode==='registered_unit'?'등록 세대 필수':'동·호 또는 이용 구분 자유 입력'} · 원장 미연결 활성 소속 {data.unmapped_active_members}명</Typography>
   <Typography variant="body2">등록 세대 필수 방식은 활성 소속의 세대 연결을 먼저 완료해야 합니다. 자유 입력 방식은 독립 주차시설 등에도 사용할 수 있습니다. 방식을 바꿔도 기존 소속이 자동 승인·회수되지는 않습니다.</Typography>
   <TextField label="원장 변경 사유(5~500자)" value={reason} disabled={busy||!data.can_manage} onChange={e=>setReason(e.target.value)} slotProps={{htmlInput:{maxLength:500}}}/>
   <Stack direction="row" spacing={1}><Button disabled={busy||!data.can_manage||reason.trim().length<5||data.policy.mode==='registered_unit'||data.unmapped_active_members>0} onClick={()=>void run('residence_policy',{expected_revision:data.policy.revision,mode:'registered_unit',reason:reason.trim()})}>등록 세대 필수로 변경</Button><Button disabled={busy||!data.can_manage||reason.trim().length<5||data.policy.mode==='free_text'} onClick={()=>void run('residence_policy',{expected_revision:data.policy.revision,mode:'free_text',reason:reason.trim()})}>자유 입력으로 변경</Button></Stack>
   <Stack direction={{xs:'column',sm:'row'}} spacing={1}><TextField label="새 건물명" value={buildingLabel} disabled={busy||!data.can_manage} onChange={e=>setBuildingLabel(e.target.value)} slotProps={{htmlInput:{maxLength:30}}}/><Button disabled={busy||!data.can_manage||!buildingLabel.trim()} onClick={()=>void run('create_building',{label:buildingLabel.trim()})}>건물 등록</Button></Stack>
   {!data.rows.length&&<Typography>등록된 건물이 없습니다.</Typography>}
   {data.rows.map(r=><Stack key={r.id} direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Button variant={building===r.id?'contained':'outlined'} onClick={()=>{setBuilding(r.id);setUc([null]);}}>{r.label} · {r.active?'사용 중':'사용 중지'}</Button><Button disabled={busy||!data.can_manage||reason.trim().length<5} onClick={()=>void run('set_building_active',{id:r.id,expected_revision:r.revision,active:!r.active,reason:reason.trim()})}>{r.label} {r.active?'중지':'재개'}</Button></Stack>)}
   <Pages label="원장 건물" cursors={bc} setCursors={setBc} data={data} busy={busy} onChange={()=>{setBuilding('');setUc([null]);}}/>
   {selected&&<><Typography component="h3" variant="h6">{selected.label} 세대</Typography><Stack direction={{xs:'column',sm:'row'}} spacing={1}><TextField label="새 세대명" value={unitLabel} disabled={busy||!data.can_manage||!selected.active} onChange={e=>setUnitLabel(e.target.value)} slotProps={{htmlInput:{maxLength:30}}}/><Button disabled={busy||uq.loading||!!uq.error||!data.can_manage||!selected.active||!unitLabel.trim()} onClick={()=>void run('create_unit',{building_id:building,label:unitLabel.trim()})}>세대 등록</Button></Stack>
    {uq.loading&&<Typography role="status">세대 원장을 조회하고 있습니다.</Typography>}{uq.error&&<Alert severity="error">{uq.error} 이전 원장은 표시하지 않습니다.</Alert>}
    {uq.data&&<>{!uq.data.rows.length&&<Typography>등록된 세대가 없습니다.</Typography>}{uq.data.rows.map(r=><Stack key={r.id} direction="row" spacing={1}><Typography sx={{alignSelf:'center'}}>{r.label} · {r.active?'사용 중':'사용 중지'} · 활성 소속 {r.active_members}명</Typography><Button disabled={busy||uq.loading||!!uq.error||!data.can_manage||reason.trim().length<5||(!r.active&&!selected.active)||!!(r.active&&r.active_members)} onClick={()=>void run('set_unit_active',{id:r.id,expected_revision:r.revision,active:!r.active,reason:reason.trim()})}>{r.label} {r.active?'중지':'재개'}</Button></Stack>)}<Pages label="원장 세대" cursors={uc} setCursors={setUc} data={uq.data} busy={busy||uq.loading}/></>}
   </>}
   <Typography variant="caption">원장은 현장별로 최대 50건씩 식별자 순서로 조회합니다. 세대 연결은 소유권·주차권·장비 운행·코인 결제 권한을 부여하지 않습니다.</Typography>
  </>}
 </Stack></CardContent></Card>;
}
