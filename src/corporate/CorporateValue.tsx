import { useState } from 'react';

export default function CorporateValue({ onConsult }: { onConsult: () => void }) {
  const [parkingCount, setParkingCount] = useState('100');
  const count = Number(parkingCount);
  const valid = parkingCount !== '' && Number.isInteger(count) && count > 0 && count <= 10000;
  return <section id="value" className="dc-value dc-section">
    <div className="dc-section-heading"><div><p className="dc-eyebrow">THE GOLDEN BALANCE OF PARKING</p><h2>주차의 황금비율,<br />건축의 사업성이 되다.</h2></div><p>주차대수 · 지하공사비 · 출차 편의<br />단지마다 다른 최적의 균형을 찾습니다.</p></div>
    <div className="dc-value-intro"><p>도엘브는 미래 모빌리티 건축의 핵심 시스템을 지향합니다. 자율주행 주차로봇으로 같은 공간의 활용도를 높이고, 발렛 서비스로 생활의 여유를 더합니다. 신축의 분양 경쟁력과 기존 단지의 주차 환경 개선을 함께 바라봅니다.</p></div>
    <div className="dc-business-grid"><article><span className="dc-eyebrow">01 / NEW DEVELOPMENT</span><h3>시행사의 사업성에,<br />분양의 차별화를 더하다.</h3><p>설계 초기부터 로봇 주차 구역과 일반 주차 구역의 비율을 검토합니다. 필요한 주차대수와 지하 면적의 균형을 찾아 굴착·구조 공사비 절감 가능성을 분석하고, 프리미엄 발렛 경험으로 단지의 상품성을 높이는 방향을 제안합니다.</p><ul><li>동일 면적에서 주차대수 확대 검토</li><li>목표 주차대수 기준 지하 면적·굴착 범위 최적화</li><li>주거 고급화와 분양 경쟁력 강화</li></ul></article>
    <article><span className="dc-eyebrow">02 / EXISTING BUILDINGS</span><h3>이미 있는 주차장에도,<br />새로운 가능성을.</h3><p>기존 단지와 건축물의 기둥, 차로, 층고와 피크 시간대 출차 수요를 분석합니다. 활용도가 낮은 공간과 동선을 재검토해 같은 주차 공간에서 수용 대수를 늘리고, 로봇 발렛으로 주차 편의를 높일 수 있는 도입안을 찾습니다.</p><ul><li>기존 주차 면적의 활용도 개선</li><li>단지 여건에 맞춘 단계별 도입 검토</li><li>주차 탐색·직접 운전 부담을 줄이는 발렛 경험</li></ul></article></div>
    <div className="dc-efficiency"><div><p className="dc-eyebrow">PLANNING SCENARIO · 설계 검토 목표</p><h3>주차대수 확대<br /><strong>20–45<span>%</span></strong></h3><p>같은 면적에서 더 많은 주차 가능성을 검토합니다.<br />기둥·차로·인수 공간·운용 속도를 함께 고려한 현장별 최적화.</p></div>
      <div className="dc-capacity"><label htmlFor="capacity-count">현재 주차대수 <span>가정 비교</span></label><div className="dc-capacity-input"><input id="capacity-count" type="number" min={1} max={10000} step={1} inputMode="numeric" value={parkingCount} onChange={event => setParkingCount(event.target.value)} /><span>대</span></div>
        <div className="dc-capacity-output" aria-live="polite">{valid ? <><span>동일 면적 · 확대율 가정 20~45%</span><strong>{Math.floor(count * 1.2).toLocaleString()}–{Math.floor(count * 1.45).toLocaleString()}<small>대</small></strong><p>추가 {Math.floor(count * 1.2) - count}–{Math.floor(count * 1.45) - count}대의 산술 비교</p></> : <p>1~10,000 사이의 정수 대수를 입력해 주세요.</p>}</div>
      </div>
      <p className="dc-efficiency-note">20~45%는 도엘브 사업기획의 설계 검토 목표 범위이며, 검증된 현장 실적이나 성능 보증 수치가 아닙니다. 위 계산은 입력 대수에 확대율을 적용한 가정 비교로 실제 배치·견적·인허가 결과를 대신하지 않습니다. 주차대수 증가율과 공사비 절감률은 서로 다르며, 실제 효과는 설비 비용·운영비·현장 조건을 함께 검토해 산정합니다.</p>
    </div>
    <div className="dc-value-process"><p className="dc-eyebrow">FIND YOUR GOLDEN BALANCE</p><h3>공간 진단 → 배치 비교 → 비용·운영 검토 → 도입안 제안</h3><p>최대 주차대수만이 아닌, 출차 대기·안전 동선·장비 대수·투자비의 균형까지. 도엘브와 우리 단지의 최적 도입 조건을 검토하세요.</p><a href="#contact" className="dc-text-link" onClick={onConsult}>우리 단지의 주차 효율 상담 <span aria-hidden="true">↗</span></a></div>
    <details className="dc-regulation"><summary>제도 변화와 프로젝트별 도입 조건 <span>2026.07 개정 반영</span></summary><div><p>2026년 7월 27일 「주차장법 시행규칙」은 자동이송주차장치의 설비·안전 기준을 정비했고, 7월 29일 「주택건설기준 등에 관한 규칙」은 사업계획승인권자가 주거환경에 지장이 없다고 인정하는 경우 공동주택에 해당 장치를 설치할 수 있는 근거를 마련했습니다.</p><p>신축 사업은 사업계획승인 신청 시점과 개정 규칙의 적용례를 확인합니다. 기존 공동주택·건축물은 설치·변경 인허가, 구조·소방·피난, 관리주체 협의와 장비 안전 기준을 현장별로 검토합니다. 제도 개정이 모든 주거시설의 무조건적 설치 허용을 의미하지는 않습니다.</p><div className="dc-regulation-links"><a href="https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288421" target="_blank" rel="noreferrer">주차장법 시행규칙 ↗</a><a href="https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288501" target="_blank" rel="noreferrer">주택건설기준 등에 관한 규칙 ↗</a></div></div></details>
  </section>;
}
