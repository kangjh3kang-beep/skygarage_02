import { useState } from 'react';
import { corporatePhotography, type CorporateScene } from './photography';
import MediaBrandSeal from '../components/MediaBrandSeal';

export default function CorporatePhoto({ scene, alt, priority = false, className = '', sizes = '100vw' }: {
  scene: CorporateScene; alt: string; priority?: boolean; className?: string; sizes?: string;
}) {
  const [failure, setFailure] = useState(0);
  const [retry, setRetry] = useState(0);
  const photo = corporatePhotography[scene];
  return <figure className={`dc-photo ${className}`} data-scene={scene}>
    {failure < 2 ? <img key={`${scene}-${failure}-${retry}`} src={failure ? photo.fallback : photo.full}
      srcSet={failure || priority ? undefined : `${photo.small} 800w, ${photo.full} 1672w`} sizes={sizes}
      width={1672} height={941} alt={alt} loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'} decoding="async"
      onError={() => setFailure(value => value + 1)} />
      : <div className="dc-photo-unavailable"><span>{alt}</span><button type="button" onClick={() => { setFailure(0); setRetry(value => value + 1); }}>이미지 다시 불러오기 ↻</button></div>}
    {failure < 2 && <MediaBrandSeal />}
    <figcaption>DOELV VISION · AI 콘셉트 이미지</figcaption>
  </figure>;
}
