import { useState } from 'react';
import { useGovernanceQuery } from '../../admin/hooks/useGovernanceQuery';
import { useMembershipCommand } from '../../hooks/useMembershipCommand';
import { membershipLabel, parseOwnMemberships } from '../../lib/membership';
export default function MemberEnrollment({userId,verified,onMembershipChange}:{userId:string;verified:boolean;onMembershipChange?:()=>void}){
 const [revision,refresh]=useState(0),[code,setCode]=useState(''),[unit,setUnit]=useState(''),[message,setMessage]=useState('');
 const command=useMembershipCommand(()=>{refresh(n=>n+1);onMembershipChange?.();});
 const query=useGovernanceQuery('platform_my_memberships',{},`${userId}:${revision}`,parseOwnMemberships);
 async function apply(){const r=await command.run('apply',{code:code.trim().toLowerCase(),unit_label:unit.trim()});if(r){setCode('');setUnit('');setMessage('신청이 접수됐습니다. 담당자 승인 전에는 소속이 활성화되지 않습니다.');}}
 return <section className="doelv-card" aria-label="내 현장 소속 신청"><p className="doelv-eyebrow">MEMBERSHIP</p><h2>단지·시설 소속 신청</h2>
  <p>현장 담당자가 전달한 64자리 초대코드와 동·호 또는 이용 구분을 입력하세요. 문자 인증을 마친 회원만 신청할 수 있습니다.</p>
  <p className="doelv-muted">신청 후 관리자가 입주·이용 자격을 확인하고 등록 세대 또는 해당 시설의 이용 구분에 연결합니다. 입력한 동·호만으로 승인되지 않습니다. 소속 승인은 실제 출입·주차·장비 운행 허가와 별개입니다.</p>
  {!verified&&<p role="alert">휴대전화 문자 인증 상태를 먼저 확인하세요.</p>}
  <form onSubmit={e=>{e.preventDefault();void apply();}}><label>현장 초대코드<input aria-label="현장 초대코드" value={code} autoComplete="off" spellCheck={false} maxLength={64} disabled={command.busy||!verified} onChange={e=>setCode(e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',margin:'8px 0',padding:12}}/></label>
   <label>동·호 또는 이용 구분<input aria-label="동·호 또는 이용 구분" value={unit} maxLength={80} disabled={command.busy||!verified} onChange={e=>setUnit(e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',margin:'8px 0',padding:12}}/></label>
   <button type="submit" className="doelv-primary" disabled={command.busy||query.loading||!verified||!/^[0-9a-f]{64}$/i.test(code.trim())||!unit.trim()}>현장 소속 신청</button>
  </form>
  {command.error&&<p role="alert">{command.error}</p>}{message&&<p role="status">{message}</p>}
  <button type="button" className="doelv-secondary" disabled={command.busy||query.loading} onClick={()=>{refresh(n=>n+1);onMembershipChange?.();}}>내 소속·신청 새로 조회</button>
  {query.loading&&<p role="status">내 소속과 신청을 조회하고 있습니다.</p>}{query.error&&<p role="alert">{query.error} 이전 목록은 표시하지 않습니다.</p>}
  {query.data&&<><h3>내 소속</h3>{!query.data.memberships.length&&<p>연결된 소속이 없습니다.</p>}{query.data.memberships.map(m=><div key={m.site_id} className="doelv-row"><div><strong>{m.site_name}</strong><small>{m.unit_label} · {membershipLabel(m.status)} · {membershipLabel(m.phase)}</small></div></div>)}
   <h3>최근 신청 30건</h3>{!query.data.applications.length&&<p>신청 내역이 없습니다.</p>}{query.data.applications.map(r=><div key={r.id} style={{margin:'16px 0'}}><strong>{r.site_name} · {r.unit_label}</strong><p>{membershipLabel(r.status)} · {new Date(r.created_at).toLocaleString('ko-KR')}</p>{r.reason&&<p style={{whiteSpace:'pre-wrap'}}>처리 사유: {r.reason}</p>}{r.status==='pending'&&<button type="button" className="doelv-secondary" disabled={command.busy||query.loading} onClick={()=>void command.run('withdraw',{id:r.id,expected_revision:r.revision})}>이 신청 철회</button>}</div>)}
  </>}
 </section>;
}
