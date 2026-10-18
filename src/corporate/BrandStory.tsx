import { BrandIdentity } from '../sgp/components/DoelvBrand';
import './brand-story.css';

const nameParts = [
  { letters: 'DO', words: 'Domus · Dwelling', meaning: '집과 주거', detail: '집을 뜻하는 라틴어 Domus에서 DO를 가져오고, 주거를 뜻하는 영어 Dwelling의 가치를 담았습니다. 사람의 삶이 시작되는 공간을 생각합니다.' },
  { letters: 'EL', words: 'Elevation · Elevator', meaning: '높아지는 가치, 연결되는 공간', detail: '상승을 뜻하는 Elevation과 승강기를 뜻하는 Elevator의 EL을 연결합니다. 수직 이동 기술과 더 높은 삶의 품격을 함께 지향합니다.' },
  { letters: 'V', words: 'Vehicle · Vision', meaning: '모빌리티와 미래 비전', detail: '차량을 뜻하는 Vehicle과 미래 구상을 뜻하는 Vision의 V를 담았습니다. 건축과 모빌리티가 연결되는 새로운 일상을 그립니다.' },
];
const values = [
  ['공간의 품격', '건축과 생활의 디테일을 통해 오래 머물고 싶은 공간을 추구합니다.'],
  ['이동의 편리함', '도착과 주차, 귀가로 이어지는 일상의 동선을 편안하게 연결합니다.'],
  ['안전과 신뢰', '사람을 중심에 두고 설계와 검증, 책임 있는 운영을 지향합니다.'],
  ['지속 가능한 사업 가치', '공간 활용과 운영 효율을 함께 검토해 건축의 가치를 높입니다.'],
];

export default function BrandStory() {
  return <div className="dc-brand-foundation">
    <div className="dc-brand-intro">
      <div className="dc-brand-emblem"><BrandIdentity stacked /><p>ARCHITECTURE · MOBILITY · LIFE</p></div>
      <div className="dc-brand-manifesto">
        <p className="dc-eyebrow">OUR BRAND PHILOSOPHY</p>
        <h2>공간을 높이고,<br /><em>일상을 연결하다.</em></h2>
        <p className="dc-lead">DOELV, 공간과 모빌리티의 새로운 기준.</p>
        <p>도엘브는 건축과 이동 기술의 연결을 통해 더 편리하고 품격 있는 일상을 추구합니다. 집으로 향하는 길부터 주차하고 머무는 순간까지, 사람의 경험을 중심으로 공간을 생각합니다.</p>
        <p>입주민에게는 편안한 일상과 주거의 품격을, 사업자에게는 공간 활용과 사업 가치의 새로운 가능성을 제안합니다.</p>
      </div>
    </div>
    <div className="dc-brand-naming">
      <p className="dc-eyebrow">THE MEANING OF DOELV</p>
      <h3>하나의 이름에 담은, 세 가지 약속.</h3>
      <p className="dc-name-equation" aria-label="DO 더하기 EL 더하기 V는 DOELV, 도엘브"><span>DO</span><i aria-hidden="true">+</i><span>EL</span><i aria-hidden="true">+</i><span>V</span><i aria-hidden="true">=</i><strong>DOELV</strong></p>
      <p className="dc-name-description">도엘브는 라틴어 Domus와 영문 키워드를 결합한 브랜드 조어입니다. 주거, 삶의 품격과 수직 이동, 모빌리티와 미래 비전을 DO · EL · V에 담았습니다.</p>
      <dl className="dc-name-parts">{nameParts.map(part => <div key={part.letters}>
        <dt><span>{part.letters}</span><strong>{part.words}</strong></dt>
        <dd><h4>{part.meaning}</h4><p>{part.detail}</p></dd>
      </div>)}</dl>
    </div>
    <div className="dc-brand-values" aria-label="도엘브의 핵심 가치">{values.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    <div className="dc-brand-signature"><h3>건축의 형태에,<br />이동의 흐름을 담다.</h3><p>도엘브의 심벌은 D와 V를 건축적 형태와 이동의 흐름으로 연결해 읽을 수 있습니다. 금색의 입체감은 주거의 품격과 정교함을, 깊이 있는 바탕색은 차분함과 신뢰를 표현합니다.</p></div>
  </div>;
}
