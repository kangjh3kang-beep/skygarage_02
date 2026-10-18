import { useState } from 'react';
import { photography } from '../assets/photography';
import MediaBrandSeal from '../../components/MediaBrandSeal';

const scenes = {
  home: { title: 'PRIVATE SKY GARAGE', label: '집과 이어지는 나만의 게러지', alt: '고층 주거 거실과 유리벽으로 구분된 세대 전용 게러지 안의 차량' },
  call: { title: 'AUTONOMOUS ARRIVAL', label: '이동의 시작을 집 앞에서', alt: '차량용 엘리베이터 안에서 낮은 자율이송 플랫폼에 실린 차량과 분리된 보행 공간' },
  garage: { title: 'YOUR PRIVATE GARAGE', label: '내 차를 위한 전용 공간', alt: '고층 세대 전용 게러지에 주차된 차량과 전기차 충전기' },
  access: { title: 'PRIVATE RESIDENCE ACCESS', label: '나의 공간으로, 안전하게', alt: '세대 전용 게러지와 연결된 주거 출입문과 비접촉 인증 리더' },
  profile: { title: 'YOUR DOELV MEMBERSHIP', label: '나의 일상에 맞춘 모빌리티', alt: '전용 게러지가 보이는 주거 공간의 스마트폰, 입주카드와 차량 키' },
  requests: { title: 'RESIDENT CARE', label: '공간과 이동을 세심하게', alt: '전용 게러지 옆에서 입주민의 차량과 주거 서비스를 관리하는 상담 공간' },
  wallet: { title: 'MOBILITY SERVICES', label: '이동과 이용을 한곳에서', alt: '전용 게러지와 충전기를 배경으로 한 비접촉 단말기와 입주카드' },
} as const;

export type BrandScene = keyof typeof scenes;

export function PhotoHero({ photo = 'home', compact = false }: { photo?: BrandScene; compact?: boolean }) {
  // Reset loading and error state when navigating between scenes.
  return <ScenePhoto key={photo} photo={photo} compact={compact} />;
}

function ScenePhoto({ photo, compact }: { photo: BrandScene; compact: boolean }) {
  const [format, setFormat] = useState<'webp' | 'jpeg'>('webp');
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  const scene = scenes[photo];
  const asset = photography[photo];
  const url = (source: string) => retry ? `${source}?retry=${retry}` : source;
  const source = url(format === 'webp' ? asset.full : asset.fallback);
  const sizes = compact
    ? '(max-width: 760px) calc(100vw - 48px), 438px'
    : '(max-width: 760px) calc(100vw - 34px), (max-width: 1200px) calc(100vw - 313px), 808px';

  function recover() {
    if (format === 'webp') {
      setFormat('jpeg');
      setStatus('loading');
    } else setStatus('failed');
  }

  return (
    <figure className={`doelv-photo${compact ? ' doelv-photo-compact' : ''} is-${status}`} data-scene={photo}>
      <div className="doelv-photo-stage" style={{ aspectRatio: `${asset.width} / ${asset.height}` }} aria-busy={status === 'loading'}>
        {status !== 'failed' && <img
          key={`${format}-${retry}`}
          className="doelv-photo-image"
          src={source}
          srcSet={format === 'webp' ? `${url(asset.small)} 800w, ${source} ${asset.width}w` : undefined}
          sizes={sizes}
          alt={scene.alt}
          width={asset.width}
          height={asset.height}
          fetchPriority="high"
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={recover}
        />}
        {status === 'failed' && <div className="doelv-photo-fallback" role="status">
          <p>사진을 불러오지 못했습니다.</p>
          <button type="button" onClick={() => {
            setRetry(Date.now());
            setFormat('webp');
            setStatus('loading');
          }}>사진 다시 불러오기</button>
        </div>}
        {status !== 'failed' && <MediaBrandSeal />}
        <span className="doelv-photo-scene" aria-hidden="true">{scene.title}</span>
      </div>
      <figcaption className="doelv-photo-caption">
        <span>{scene.label}</span>
        <small>AI 콘셉트 이미지</small>
      </figcaption>
    </figure>
  );
}
