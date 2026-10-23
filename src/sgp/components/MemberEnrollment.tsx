import { useState } from 'react';
import { useGovernanceQuery } from '../../admin/hooks/useGovernanceQuery';
import { useMembershipCommand } from '../../hooks/useMembershipCommand';
import { membershipLabel, parseOwnMemberships, type OwnMemberships } from '../../lib/membership';
export default function MemberEnrollment({userId,verified,onMembershipChange}:{userId:string;verified:boolean;onMembershipChange?:()=>void}){
 const [revision,refresh]=useState(0),[code,setCode]=useState(''),[unit,setUnit]=useState(''),[message,setMessage]=useState('');
 const [exit,setExit]=useState<OwnMemberships['memberships'][number]|null>(null),[reason,setReason]=useState('이사·입주 종료'),[confirmation,setConfirmation]=useState('');
 function cancelExit(){setExit(null);setConfirmation('');setReason('이사·입주 종료');}
 const command=useMembershipCommand(()=>{cancelExit();refresh(n=>n+1);onMembershipChange?.();});
 const query=useGovernanceQuery('platform_my_memberships',{},`${userId}:${revision}`,parseOwnMemberships);
 async function apply(){const r=await command.run('apply',{code:code.trim().toLowerCase(),unit_label:unit.trim()});if(r){setCode('');setUnit('');setMessage('신청이 접수됐습니다. 담당자 승인 전에는 소속이 활성화되지 않습니다.');}}
 async function leave(){if(!exit?.revision)return;const r=await command.run('leave',{site_id:exit.site_id,expected_revision:exit.revision,reason,confirmation});if(r)setMessage('선택한 현장의 소속과 등록 차량 권한을 해지했습니다. 다른 현장 소속과 계정은 유지됩니다.');}
 return <section className="doelv-card" aria-label="내 현장 소속 신청"><p className="doelv-eyebrow">MEMBERSHIP</p><h2>단지·시설 소속 신청</h2>
  <p>현장 담당자가 전달한 64자리 초대코드와 동·호 또는 이용 구분을 입력하세요. 문자 인증을 마친 회원만 신청할 수 있습니다.</p>
  <p className="doelv-muted">신청 후 관리자가 입주·이용 자격을 확인하고 등록 세대 또는 해당 시설의 이용 구분에 연결합니다. 입력한 동·호만으로 승인되지 않습니다. 소속 승인은 실제 출입·주차·장비 운행 허가와 별개입니다.</p>
  {!verified&&<p role="alert">휴대전화 문자 인증 상태를 먼저 확인하세요.</p>}
  <form onSubmit={e=>{e.preventDefault();void apply();}}><label>현장 초대코드<input aria-label="현장 초대코드" value={code} autoComplete="off" spellCheck={false} maxLength={64} disabled={command.busy||!verified} onChange={e=>setCode(e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',margin:'8px 0',padding:12}}/></label>
   <label>동·호 또는 이용 구분<input aria-label="동·호 또는 이용 구분" value={unit} maxLength={80} disabled={command.busy||!verified} onChange={e=>setUnit(e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',margin:'8px 0',padding:12}}/></label>
   <button type="submit" className="doelv-primary" disabled={command.busy||query.loading||!verified||!/^[0-9a-f]{64}$/i.test(code.trim())||!unit.trim()}>현장 소속 신청</button>
  </form>
  {command.error&&<p role="alert">{command.error}</p>}{message&&<p role="status">{message}</p>}
  <button type="button" className="doelv-secondary" disabled={command.busy||query.loading} onClick={()=>{cancelExit();command.clearError();setMessage('');refresh(n=>n+1);onMembershipChange?.();}}>내 소속·신청 새로 조회</button>
  {query.loading&&<p role="status">내 소속과 신청을 조회하고 있습니다.</p>}{query.error&&<p role="alert">{query.error} 이전 목록은 표시하지 않습니다.</p>}
  {query.data&&<><h3>내 소속</h3>{!query.data.memberships.length&&<p>연결된 소속이 없습니다.</p>}{query.data.memberships.map(m=><div key={m.site_id} className="doelv-row doelv-membership-row"><div><strong>{m.site_name}</strong><small>{m.unit_label} · {membershipLabel(m.status)} · {membershipLabel(m.phase)}</small></div>{m.status==='active'&&(m.revision?<button type="button" className="doelv-secondary" aria-label={`${m.site_name} 소속 해지`} disabled={command.busy||query.loading} onClick={()=>{cancelExit();command.clearError();setMessage('');setExit(m);}}>이 현장 소속 해지</button>:<small>소속 해지를 위해 최신 정보를 다시 조회하세요.</small>)}</div>)}
   {exit&&<section aria-label="현장 소속 해지 확인" className="doelv-card doelv-membership-exit"><h3>{exit.site_name} 소속 해지 확인</h3>
    <p>이 현장의 승인된 소속과 등록 차량 권한이 회수됩니다. 다시 이용하려면 새로 신청하고 승인을 받아야 합니다.</p>
    <p>계정과 다른 현장의 소속은 유지됩니다. 기존 신청·결제·정산·감사 이력은 이 작업으로 삭제되지 않습니다. 전체 회원 탈퇴와 개인정보 삭제 요청은 별도 절차입니다.</p>
    <form onSubmit={e=>{e.preventDefault();void leave();}}><label>소속 해지 사유<select aria-label="소속 해지 사유" value={reason} disabled={command.busy} onChange={e=>setReason(e.target.value)}>{['이사·입주 종료','시설 이용 종료','잘못된 소속 연결','기타 이용 종료'].map(r=><option key={r}>{r}</option>)}</select></label>
     <label>확인 문구: 소속 해지<input aria-label="소속 해지 확인 문구" value={confirmation} autoComplete="off" maxLength={20} disabled={command.busy} onChange={e=>setConfirmation(e.target.value)}/></label>
     <button type="submit" className="doelv-secondary" disabled={command.busy||query.loading||!!query.error||confirmation!=='소속 해지'||reason.length<5}>소속 해지 확정</button>
     <button type="button" className="doelv-secondary" disabled={command.busy} onClick={cancelExit}>해지 취소</button>
    </form></section>}
   <h3>최근 신청 30건</h3>{!query.data.applications.length&&<p>신청 내역이 없습니다.</p>}{query.data.applications.map(r=><div key={r.id} style={{margin:'16px 0'}}><strong>{r.site_name} · {r.unit_label}</strong><p>{membershipLabel(r.status)} · {new Date(r.created_at).toLocaleString('ko-KR')}</p>{r.reason&&<p style={{whiteSpace:'pre-wrap'}}>처리 사유: {r.reason}</p>}{r.status==='pending'&&<button type="button" className="doelv-secondary" disabled={command.busy||query.loading} onClick={()=>void command.run('withdraw',{id:r.id,expected_revision:r.revision})}>이 신청 철회</button>}</div>)}
  </>}
 </section>;
}
