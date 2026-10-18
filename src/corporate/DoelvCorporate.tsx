import { useEffect, useRef, useState } from 'react';
import { BrandIdentity } from '../sgp/components/DoelvBrand';
import { appUrl } from '../lib/domain-routing';
import CorporatePhoto from './CorporatePhoto';
import CorporateInquiry from './CorporateInquiry';
import CorporateValue from './CorporateValue';
import CorporateFilms from './CorporateFilms';
import './corporate.css';

const officialApp = appUrl(import.meta.env.VITE_OFFICIAL_APP_ORIGIN);
const navigation = [['brand', '도엘브'], ['collection', '컬렉션'], ['experience', '라이프스타일'], ['value', '사업 가치'], ['films', '브랜드 영상'], ['technology', '모빌리티'], ['contact', '프로젝트 문의']];

export function CorporateHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  return <header className="dc-header">
    <a className="dc-skip" href="#main">본문 바로가기</a>
    <a className="dc-logo" href="/" aria-label="도엘브 공식 홈페이지"><BrandIdentity /></a>
    <button className="dc-menu-toggle" ref={toggle} type="button" aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={open} aria-controls="corporate-navigation" onClick={() => setOpen(value => !value)}>{open ? '닫기 ×' : '메뉴 ☰'}</button>
    <nav id="corporate-navigation" className={open ? 'is-open' : ''} aria-label="메인 메뉴">
      {navigation.map(([id, label]) => <a key={id} href={`/#${id}`} onClick={() => setOpen(false)}>{label}</a>)}
      <a className="dc-app-link" href={officialApp}>공식 앱 <span aria-hidden="true">↗</span></a>
    </nav>
  </header>;
}

export function CorporateFooter() {
  return <footer className="dc-footer">
    <div className="dc-footer-top"><a className="dc-logo" href="/" aria-label="도엘브 공식 홈페이지"><BrandIdentity /></a><p>Architecture. Mobility. Life.</p><a className="dc-top" href="#top" aria-label="맨 위로">↑</a></div>
    <div className="dc-footer-links"><span>주식회사 제이에이치홀딩스</span><a href="/#contact">사업 제휴</a><a href="/brand-guide">브랜드 가이드</a><a href={officialApp}>공식 앱</a><a href="/admin">플랫폼 관리</a></div>
    <div className="dc-footer-bottom"><p>© {new Date().getFullYear()} JH HOLDINGS. DOELV. All rights reserved.</p><p>본 사이트의 건축·제품 이미지는 브랜드 비전을 표현한 AI 콘셉트 이미지입니다.<br />실제 적용 범위와 사양은 프로젝트 설계·인허가·현장 검증에 따라 확정됩니다.</p></div>
  </footer>;
}

const collections = [
  { scene: 'tower', english: 'DOELV TOWER', korean: '도엘브 타워', label: 'VERTICAL PRIVATE LIVING', description: '도시의 스카이라인 위로, 주거와 모빌리티가 하나가 되는 고급 주상복합의 비전.' },
  { scene: 'city', english: 'DOELV CITY', korean: '도엘브 시티', label: 'A CONNECTED MOBILITY DISTRICT', description: '집과 일상, 녹지와 이동이 연결되는 차세대 모빌리티 복합단지.' },
  { scene: 'village', english: 'DOELV VILLAGE', korean: '도엘브 빌리지', label: 'QUIETLY EXCEPTIONAL', description: '자연 속 독립된 공간과 프라이빗 게러지가 완성하는 여유로운 주거.' },
] as const;
const journey = [
  { title: '도착과 인계', text: '지정된 인수 공간에 차량을 맡기고, 거주자는 편안하게 일상으로 이동합니다.' },
  { title: '인증과 안전 확인', text: '이용 권한과 설비 안전 상태를 함께 확인한 후 이송 절차를 시작하는 구조를 지향합니다.' },
  { title: '수평·수직 이송', text: 'ATR 자율이송로봇과 차량용 엘리베이터가 연결되어 목적 구역까지 차량을 이동합니다.' },
  { title: '도킹과 인수', text: '세대 전용 게러지 또는 공용 주차 구역에 도킹하고, 출차 시 지정 공간에서 차량을 인수합니다.' },
];

export default function DoelvCorporate() {
  const [interest, setInterest] = useState('스카이게러지 도엘브');
  const [step, setStep] = useState(0);
  useEffect(() => {
    document.title = 'DOELV 도엘브 | 공간과 모빌리티의 새로운 기준';
    const target = window.location.hash.slice(1);
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView());
  }, []);
  return <div className="dc-shell" id="top">
    <CorporateHeader />
    <main id="main">
      <section className="dc-hero" aria-labelledby="dc-title">
        <CorporatePhoto scene="tower" priority alt="석재 포디움과 브론즈 외관을 갖춘 도엘브 고급 주상복합 타워의 야경 콘셉트" />
        <div className="dc-hero-shade" />
        <div className="dc-hero-content"><p className="dc-eyebrow">THE NEXT STANDARD OF LIVING</p>
          <p className="dc-hero-wordmark" aria-hidden="true">DOELV</p>
          <h1 id="dc-title">일상의 모든 이동이,<br />품격이 되다.</h1>
          <p className="dc-hero-description">주차 효율로 사업성을,<br />발렛 경험으로 주거의 품격을.</p>
          <a className="dc-button dc-button-light" href="#collection">도엘브 컬렉션 <span aria-hidden="true">↗</span></a>
        </div>
        <div className="dc-hero-bottom"><a href="#brand">DISCOVER DOELV <span aria-hidden="true">↓</span></a><span>ARCHITECTURE · MOBILITY · LIFE</span></div>
      </section>
      <section id="brand" className="dc-brand dc-section">
        <div><p className="dc-eyebrow">THE DOELV PHILOSOPHY</p><h2>좋은 공간을 넘어,<br /><em>좋은 일상으로.</em></h2></div>
        <div className="dc-brand-story"><p className="dc-lead">집으로 향하는 마지막 순간까지.<br />도엘브는 이동의 경험을 주거의 품격으로 연결합니다.</p><p>도엘브 타워, 시티, 빌리지. 서로 다른 공간의 개성 위에 스카이게러지와 자율 모빌리티의 가능성을 더합니다. 사람의 동선은 편안하게, 기술은 공간 속에 자연스럽게.</p><a className="dc-text-link" href="/brand-guide">브랜드 이야기 <span aria-hidden="true">↗</span></a></div>
      </section>
      <section id="collection" className="dc-collection dc-section">
        <div className="dc-section-heading"><div><p className="dc-eyebrow">THE COLLECTION</p><h2>당신의 삶에 맞는 도엘브.</h2></div><p>세 가지 공간, 하나의 철학.<br />건축과 이동의 새로운 조화를 제안합니다.</p></div>
        <div className="dc-collection-grid">{collections.map((item, index) => <article key={item.scene}>
          <a href="#contact" onClick={() => setInterest(item.korean)} className="dc-collection-image" aria-label={`${item.korean} 프로젝트 상담`}><CorporatePhoto scene={item.scene} alt={`${item.korean}: ${item.description}`} sizes="(max-width: 720px) 100vw, 34vw" /><span className="dc-image-arrow" aria-hidden="true">↗</span></a>
          <div className="dc-collection-label"><span>0{index + 1}</span><span>{item.label}</span></div><h3>{item.english}</h3><p className="dc-collection-korean">{item.korean}</p><p>{item.description}</p>
        </article>)}</div>
      </section>
      <CorporateValue onConsult={() => setInterest('스카이게러지 도엘브')} />
      <section id="experience" className="dc-experience">
        <div className="dc-section-heading dc-section"><div><p className="dc-eyebrow">SKY GARAGE DOELV</p><h2>도착의 경험까지,<br />당신의 공간답게.</h2></div><p>세대 직입의 프라이버시와<br />지하 로봇 발렛의 여유를 하나의 브랜드로.</p></div>
        <div className="dc-feature dc-feature-residence"><CorporatePhoto scene="residence" alt="유리로 분리된 세대 전용 게러지와 도심 전망의 도엘브 레지던스" sizes="(max-width: 900px) 100vw, 65vw" />
          <div className="dc-feature-copy"><p className="dc-eyebrow">01 / PRIVATE SKY GARAGE</p><h3>집 앞에서 만나는<br />나만의 게러지.</h3><p>차량의 여정을 세대 전용 주차 공간까지. 거주 공간과 분리된 프라이빗 게러지, 차량용 엘리베이터, 정밀 이송의 연결로 새로운 귀가 경험을 제안합니다.</p><a className="dc-text-link" href="#journey">세대 직입 여정 보기 <span aria-hidden="true">↗</span></a></div>
        </div>
        <div id="valet" className="dc-feature dc-feature-valet"><div className="dc-feature-copy"><p className="dc-eyebrow">02 / UNDERGROUND ROBOT VALET</p><h3>주차를 맡기는 순간,<br />여유가 시작됩니다.</h3><p>차량 인수 공간에서 주차 구역까지 이어지는 로봇 발렛. 기존 단지와 건축물에도 적용 가능한 동선을 검토하고, 같은 면적에서 주차대수 확대와 편리한 차량 인수를 함께 추구합니다.</p><a className="dc-text-link" href="#contact" onClick={() => setInterest('스카이게러지 도엘브')}>우리 단지 도입 상담 <span aria-hidden="true">↗</span></a></div><CorporatePhoto scene="valet" alt="저상형 자율주행 주차로봇이 차량을 운반하는 고급 지하 발렛 주차장" sizes="(max-width: 900px) 100vw, 65vw" /></div>
      </section>
      <CorporateFilms />
      <section id="technology" className="dc-technology dc-section">
        <div className="dc-section-heading"><div><p className="dc-eyebrow">ENGINEERED FOR A BETTER EVERYDAY</p><h2>보이지 않는 곳까지,<br />정교하게 연결하다.</h2></div><p>주차, 승강, 이송.<br />도엘브 모빌리티를 구성하는 세 가지 기술 비전.</p></div>
        <article className="dc-tech-main"><CorporatePhoto scene="elevator" alt="차량과 자율반송기가 탑승한 도엘브 차량용 엘리베이터 콘셉트" sizes="(max-width: 900px) 100vw, 60vw" /><div><p className="dc-eyebrow">01 / VERTICAL MOBILITY</p><h3>도엘브 엘리베이터</h3><p className="dc-tech-subtitle">차량과 자율반송기를 연결하는 수직 동선</p><p>건축의 높이를 이동의 가능성으로. 차량용 엘리베이터와 ATR의 연동을 통해 지하 인수 공간에서 각 층의 목적 구역까지 이어지는 흐름을 구상합니다.</p><ul><li>차량·반송기 탑승과 층간 이송</li><li>승강장 정렬 및 도어 연동</li><li>접근 인증과 설비 안전 상태 확인</li></ul></div></article>
        <div className="dc-tech-grid">
          <article><CorporatePhoto scene="robot" alt="차량 하부 이송을 위한 저상형 도엘브 ATR 자율이송로봇 제품 콘셉트" sizes="(max-width: 720px) 100vw, 50vw" /><p className="dc-eyebrow">02 / AUTONOMOUS TRANSFER ROBOT</p><h3>도엘브 자율이송로봇</h3><p>저상형 차체와 차량 지지 구조, 제자리 방향 정렬과 정밀 도킹을 지향하는 ATR. 협소한 이동 공간에서도 목적지에 맞는 이송 경로를 설계합니다.</p></article>
          <article><CorporatePhoto scene="carrier" alt="주거단지 물류 공간에서 수하물과 화물을 이송하는 도엘브 자율반송기 콘셉트" sizes="(max-width: 720px) 100vw, 50vw" /><p className="dc-eyebrow">03 / AUTONOMOUS CARRIER</p><h3>도엘브 자율반송기</h3><p>차량을 넘어 수하물과 물류까지. 단지 내 서비스 동선과 승강 설비를 연결하는 자율 반송의 확장 가능성을 제안합니다.</p></article>
        </div>
        <p className="dc-technology-note">기술 이미지와 설명은 개발·적용 방향을 소개합니다. 실제 장비 사양과 운용 가능 범위는 대상 건축물 및 연동 장비의 검증 후 확정됩니다.</p>
      </section>
      <section id="journey" className="dc-journey dc-section"><div><p className="dc-eyebrow">ONE SEAMLESS JOURNEY</p><h2>도착에서 귀가까지,<br />하나의 흐름.</h2><p>스카이게러지 도엘브의 서비스 여정</p></div>
        <div className="dc-journey-interaction"><div className="dc-journey-steps" role="tablist" aria-label="차량 이동 단계">{journey.map((item, index) => <button key={item.title} type="button" role="tab" id={`journey-tab-${index}`} aria-selected={step === index} aria-controls="journey-panel" tabIndex={step === index ? 0 : -1}
          onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null; if (next !== null) { event.preventDefault(); setStep(next); document.getElementById(`journey-tab-${next}`)?.focus(); } }} onClick={() => setStep(index)}><span>0{index + 1}</span>{item.title}</button>)}</div>
          <div id="journey-panel" role="tabpanel" tabIndex={0} aria-labelledby={`journey-tab-${step}`}><h3>{journey[step].title}</h3><p>{journey[step].text}</p></div>
        </div>
      </section>
      <section className="dc-connected dc-section"><div><p className="dc-eyebrow">THE CONNECTED DOELV</p><h2>공간의 경험을,<br />손안의 일상으로.</h2><p>입주민의 공식 앱과 단지를 위한 관리 플랫폼.<br />도엘브의 서비스 접점을 한곳에서 만나세요.</p></div><div className="dc-platform-links"><a href={officialApp}><span><small>FOR RESIDENTS</small><strong>스카이게러지 공식 앱</strong><span>차량·주차·단지 서비스</span></span><b aria-hidden="true">↗</b></a><a href="/admin"><span><small>FOR OPERATORS</small><strong>플랫폼 관리</strong><span>관리자 로그인 · 단지 운영</span></span><b aria-hidden="true">↗</b></a></div></section>
      <CorporateInquiry interest={interest} onInterest={setInterest} />
    </main><CorporateFooter />
  </div>;
}

export function DoelvBrandGuide() {
  useEffect(() => { document.title = 'DOELV 도엘브 | 브랜드 가이드'; }, []);
  return <div className="dc-shell" id="top"><CorporateHeader /><main id="main" className="dc-brand-guide dc-section"><p className="dc-eyebrow">DOELV BRAND IDENTITY</p><h1>공간과 모빌리티의<br />새로운 기준, 도엘브.</h1><div className="dc-brand-display"><BrandIdentity /></div><p className="dc-lead">도엘브는 건축과 이동의 연결을 통해 일상의 품격을 제안합니다.</p><div className="dc-guide-grid">{collections.map(item => <article key={item.scene}><h2>{item.english}</h2><p>{item.description}</p></article>)}<article><h2>SKY GARAGE DOELV</h2><p>세대 직입, 지하 로봇 발렛, 차량용 엘리베이터와 자율이송로봇을 연결하는 모빌리티 시스템.</p></article></div><h2>차분한 깊이, 절제된 빛.</h2><div className="dc-swatches">{[['#152522', 'Deep Forest'], ['#c4a477', 'Champagne Bronze'], ['#f3f0e9', 'Warm Ivory']].map(([color, name]) => <div key={color}><span style={{ background: color }} /><strong>{name}</strong><small>{color}</small></div>)}</div><a className="dc-button" href="/#collection">컬렉션 둘러보기 <span aria-hidden="true">↗</span></a></main><CorporateFooter /></div>;
}
