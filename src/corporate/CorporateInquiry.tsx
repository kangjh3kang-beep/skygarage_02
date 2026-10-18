import { useRef, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { env } from '../lib/env';

// Uses the existing public inquiry INSERT policy, independently of resident sessions.
const inquiryClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'doelv-public-inquiry' },
});

export default function CorporateInquiry({ interest, onInterest }: { interest: string; onInterest: (value: string) => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) || '').trim();
    if (['company', 'name', 'phone', 'email', 'message', 'projectType'].some(name => !field(name))) return;
    busy.current = true;
    setState('sending');
    try {
      const { error } = await inquiryClient.from('inquiries').insert({
        company: field('company'), name: field('name'), phone: field('phone'), email: field('email'),
        project_type: field('projectType'), message: `[DOELV · ${interest}]\n${field('message')}`,
      }).abortSignal(AbortSignal.timeout(20000));
      if (error) throw error;
      setState('success');
      form.reset();
    } catch { setState('error'); }
    finally { busy.current = false; }
  }
  return <section id="contact" className="dc-contact dc-section">
    <div className="dc-contact-intro"><p className="dc-eyebrow">LET’S BUILD WHAT’S NEXT</p>
      <h2>다음 공간의 기준,<br />함께 만들어갑니다.</h2>
      <p>신축 주거단지부터 기존 지하주차장까지.<br />주차대수 확대와 공사비·운영비의 균형을 상담하세요.</p>
      <a className="dc-contact-phone" href="tel:16660916">1666–0916 <span aria-hidden="true">↗</span></a>
      <a href="mailto:k3880@kakao.com">k3880@kakao.com</a>
      <div className="dc-contact-note">시행·시공사 / 단지 관리주체 / 사업 파트너<br />주식회사 제이에이치홀딩스</div>
    </div>
    <div className="dc-inquiry">
      {state === 'success' ? <div className="dc-inquiry-success" role="status"><span className="dc-eyebrow">THANK YOU</span><h3>상담 문의가 접수되었습니다.</h3><p>남겨주신 내용을 확인한 후 담당자가 연락드리겠습니다.</p><button className="dc-button" type="button" onClick={() => setState('idle')}>새 문의 작성 <span aria-hidden="true">↗</span></button></div>
        : <form onSubmit={submit}>
        <div className="dc-form-heading"><h3>주차 효율 · 프로젝트 상담</h3><span>모든 항목 필수</span></div>
        <div className="dc-form-grid">
          <label>회사 / 단지명<input name="company" autoComplete="organization" maxLength={120} required placeholder="회사 또는 단지명" /></label>
          <label>담당자명<input name="name" autoComplete="name" maxLength={80} required placeholder="성함" /></label>
          <label>연락처<input name="phone" type="tel" autoComplete="tel" maxLength={20} pattern="[0-9+\s\-]{7,20}" required placeholder="010-0000-0000" /></label>
          <label>이메일<input name="email" type="email" autoComplete="email" maxLength={160} required placeholder="name@company.com" /></label>
          <label>관심 브랜드<select name="interest" value={interest} onChange={event => onInterest(event.target.value)}>{['도엘브 타워', '도엘브 시티', '도엘브 빌리지', '스카이게러지 도엘브', '모빌리티 기술 / 파트너십'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>프로젝트 유형<select name="projectType" required defaultValue=""><option value="" disabled>선택해 주세요</option><option value="mixed">고급 주상복합</option><option value="apartment">아파트 / 공동주택</option><option value="officetel">오피스텔</option><option value="retrofit">기존 주차장 개선</option><option value="investment">투자 / 파트너십</option><option value="government">공공 / 지자체</option><option value="other">빌리지 / 기타</option></select></label>
          <label className="dc-form-wide">프로젝트 소개<textarea name="message" rows={4} maxLength={5000} required placeholder="사업 위치, 규모, 도입을 검토하는 서비스 등을 알려주세요." /></label>
        </div>
        <label className="dc-consent"><input type="checkbox" name="consent" required /><span>입력한 연락처로 프로젝트 상담 안내를 받는 데 동의합니다.</span></label>
        {state === 'error' && <p role="alert" className="dc-form-error">문의 접수를 확인하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도하거나 1666-0916으로 문의해 주세요.</p>}
        <button className="dc-button" type="submit" disabled={state === 'sending'}>{state === 'sending' ? '접수 중…' : '상담 문의 보내기'}<span aria-hidden="true">↗</span></button>
      </form>}
    </div>
  </section>;
}
