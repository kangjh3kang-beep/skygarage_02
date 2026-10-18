import { useState } from 'react';

const scenes = {
  home: { title: 'PRIVATE SKY GARAGE', alt: '도심 전망의 주거 공간과 유리벽으로 연결된 전용 차량 게러지' },
  call: { title: 'VEHICLE ARRIVAL', alt: '차량용 엘리베이터 안에서 대기하는 세단과 전용 승강장' },
  garage: { title: 'YOUR PRIVATE GARAGE', alt: '차량 보관 공간과 전기차 충전기가 있는 프라이빗 게러지' },
  access: { title: 'RESIDENT ACCESS', alt: '스마트 출입 인증 리더가 설치된 레지던스 현관' },
  profile: { title: 'YOUR MEMBERSHIP', alt: '주거 공간에 놓인 스마트폰과 입주 멤버십 카드 및 차량 키' },
  requests: { title: 'RESIDENT CONCIERGE', alt: '문의와 서비스 요청을 위한 레지던스 컨시어지 데스크' },
  wallet: { title: 'MOBILITY PAYMENTS', alt: '게러지를 배경으로 놓인 비접촉 결제 단말기와 차량 키' },
} as const;

export type BrandScene = keyof typeof scenes;

export function PhotoHero({ photo = 'home', compact = false }: { photo?: BrandScene; compact?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const scene = scenes[photo];
  const source = `/doelv/imagery-v2/${photo}-1672.webp`;
  const failed = failedSource === source;
  return (
    <figure className={`doelv-photo${compact ? ' doelv-photo-compact' : ''}${failed ? ' is-unavailable' : ''}`}>
      {!failed && <img
        className="doelv-photo-image"
        src={source}
        srcSet={`/doelv/imagery-v2/${photo}-800.webp 800w, ${source} 1672w`}
        sizes={compact ? '(max-width: 760px) calc(100vw - 48px), 438px' : '(max-width: 760px) calc(100vw - 34px), (max-width: 1200px) calc(100vw - 320px), 790px'}
        alt={scene.alt}
        width={1672}
        height={941}
        fetchPriority="high"
        decoding="async"
        onError={() => setFailedSource(source)}
      />}
      {failed && <p className="doelv-photo-fallback">이미지를 불러오지 못했습니다.</p>}
      <figcaption className="doelv-photo-caption">{scene.title}</figcaption>
      <small className="doelv-photo-note">AI 콘셉트 이미지</small>
    </figure>
  );
}
