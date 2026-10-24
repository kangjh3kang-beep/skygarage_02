import { useEffect,useRef,useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { useResidentData,type RequestCategory } from '../contexts/ResidentDataContext';
import { requestLabels } from '../request-labels';
import { serviceRequestError } from '../../lib/service-requests';
export default function ServiceRequestForm({category}:{category:RequestCategory}){
 const {user}=useSgpAuth();
 return <RequestDraft key={`${user?.id}:${category}`} category={category}/>;
}
function RequestDraft({category}:{category:RequestCategory}){
 const {user}=useSgpAuth(),{reload,memberships,loading,error:loadError}=useResidentData();
 const [subject,setSubject]=useState(''),[description,setDescription]=useState(''),[siteId,setSiteId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('');
 const active=useRef(true),inFlight=useRef(false),request=useRef<{signature:string;id:string}|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const verified=user?.is_verified===true&&!!user.phone_verified_at;
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!user||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setReceipt('');
  const payload={p_category:category,p_subject:subject.trim(),p_description:description.trim(),p_site_id:siteId||null},signature=JSON.stringify(payload);
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{
   const {data,error}=await supabase.rpc('sgp_submit_service_request',{p_client_request_id:request.current.id,...payload});
   if(error)throw error;if(!active.current)return;if(typeof data!=='string'||!/^[0-9a-f-]{36}$/.test(data))throw Error('invalid_service_request_response');
   request.current=null;setReceipt(data);setSubject('');setDescription('');setSiteId('');reload();
  }catch(e){if(active.current)setError(serviceRequestError(e));}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 return <form className="doelv-form" onSubmit={e=>void submit(e)}><h3>{requestLabels[category]}</h3>
  <p className="doelv-muted">담당자 확인 후 내 요청 내역에서 답변과 운영 목표 기한을 확인하세요. 접수만으로 출입·차량 운행 권한이 부여되지 않습니다.</p>
  <label>요청할 현장<select aria-label="요청할 현장" value={siteId} disabled={busy||loading||loadError} onChange={e=>setSiteId(e.target.value)}><option value="">본사 공통 문의·소속 현장 없음</option>{memberships.filter(m=>m.site&&m.status==='active').map(m=><option key={m.site_id} value={m.site_id}>{m.site!.name}</option>)}</select></label>
  <p className="doelv-muted">활성 소속 현장을 선택하면 해당 현장 담당자에게 내용이 공개됩니다. 다른 시설을 이용하거나 소속이 없으면 본사 공통 문의로 접수하세요.</p>
  {!verified&&<p role="alert">휴대전화 문자 인증 상태를 먼저 확인하세요.</p>}
  <label>제목<input required minLength={2} maxLength={80} value={subject} disabled={busy} onChange={e=>setSubject(e.target.value)} placeholder={category==='residence'?'연결할 단지·건물 이름':'요청 제목'}/></label>
  <label>요청 내용<textarea required minLength={5} maxLength={2000} rows={4} value={description} disabled={busy} onChange={e=>setDescription(e.target.value)} placeholder="확인에 필요한 내용을 적어 주세요. 비밀번호·주민등록번호는 입력하지 마세요."/></label>
  {error&&<p role="alert" className="doelv-error">{error} 최신 내역을 먼저 확인하세요. 같은 내용으로 재시도하면 동일 요청으로 처리됩니다.</p>}
  {receipt&&<p role="status" className="doelv-success">서버에 접수되었습니다. 접수번호 {receipt.slice(0,8)}</p>}
  <button className="doelv-primary" type="submit" disabled={busy||loading||loadError||!verified||subject.trim().length<2||description.trim().length<5}>{busy?'접수 중…':'요청 접수하기'} <span aria-hidden="true">↗</span></button>
 </form>;
}
