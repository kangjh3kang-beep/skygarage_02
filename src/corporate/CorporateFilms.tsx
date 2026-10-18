import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MediaBrandSeal from '../components/MediaBrandSeal';
import introductionPoster from './assets/film-introduction.jpg';
import arrivalPoster from './assets/film-arrival.jpg';
import visionPoster from './assets/film-vision.jpg';
import './corporate-films.css';

type Film = { url: string; title: string; description: string; poster?: string; duration?: string; archive: boolean };
const archive: Record<string, Omit<Film, 'url' | 'archive'>> = {
  '1779601569837_66flwrlm8mo.mp4': { title: '주차에서 시작되는 새로운 일상', description: '세대 전용 게러지와 스마트 주차의 비전을 소개합니다.', poster: introductionPoster, duration: '1:23' },
  '1779140483488_lsschk76kn.mp4': { title: '내 공간으로 이어지는 차량의 여정', description: '주거 공간과 프라이빗 게러지가 연결되는 짧은 콘셉트 장면.', poster: arrivalPoster, duration: '0:08' },
  '1779582138626_075931nq0kj6.mp4': { title: '스카이게러지가 제안하는 주거의 미래', description: '건축과 모빌리티를 연결하는 스카이게러지 소개 영상.', poster: visionPoster, duration: '1:22' },
};

// Only direct HTTPS media files are placed in a video element. Never interpret CMS text as HTML.
function filmsFromRows(rows: { items: unknown }[]): Film[] {
  const films: Film[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.items)) continue;
    for (const item of row.items) {
      if (!item || typeof item.url !== 'string') continue;
      try {
        const url = new URL(item.url);
        if (url.protocol !== 'https:' || !/\.(mp4|webm)$/i.test(url.pathname) || url.username || url.password) continue;
        if (films.some(film => film.url === url.href)) continue;
        const saved = archive[url.pathname.split('/').pop() || ''];
        films.push({ url: url.href, title: saved?.title || (typeof item.alt === 'string' && item.alt.trim() ? item.alt.trim() : `도엘브 영상 ${films.length + 1}`), description: saved?.description || '공식 미디어 라이브러리', poster: saved?.poster, duration: saved?.duration, archive: Boolean(saved) });
      } catch { /* An invalid CMS item must not break other published videos. */ }
    }
  }
  return films;
}

function FilmPlayer({ film }: { film: Film }) {
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <>
    <div className="dc-film-stage">
      {!started && <button type="button" className="dc-film-start" onClick={() => setStarted(true)} aria-label={`${film.title} 재생`}>
        {film.poster && <img src={film.poster} alt="" width={960} height={540} loading="lazy" />}
        <span className="dc-film-play" aria-hidden="true">▶</span><span className="dc-film-start-label">영상 재생</span>
      </button>}
      {started && !failed && <video key={attempt} src={film.url} poster={film.poster} controls playsInline autoPlay preload="metadata" aria-label={film.title} aria-describedby="dc-film-description" onError={() => setFailed(true)} />}
      {failed && <div className="dc-film-error" role="alert"><p>영상을 불러오지 못했습니다.</p><button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>영상 다시 불러오기</button><a href={film.url} target="_blank" rel="noopener noreferrer">원본 영상 열기 ↗</a></div>}
      {!started && <MediaBrandSeal />}
    </div>
    <div className="dc-film-caption"><div><p className="dc-eyebrow">{film.archive ? 'SKY GARAGE / ARCHIVE FILM' : 'DOELV / OFFICIAL FILM'}</p><h3>{film.title}</h3><p id="dc-film-description">{film.description}</p></div>{film.duration && <span className="dc-film-duration">{film.duration}</span>}</div>
    {film.archive && <p className="dc-film-archive-note">브랜드 전환 이전에 제작된 기존 소개·콘셉트 영상으로, 영상 속 명칭과 표현은 당시 제작본을 유지합니다. 실제 설치·운영 실적을 의미하지 않습니다.</p>}
  </>;
}

export default function CorporateFilms() {
  const [films, setFilms] = useState<Film[]>([]);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setStatus('loading');
    void (async () => {
      try {
        const { data, error } = await supabase.from('section_media').select('id, items, sort_order').eq('active', true).eq('media_type', 'video').order('sort_order').abortSignal(controller.signal);
        if (error) throw error;
        if (!current) return;
        const published = filmsFromRows(data || []);
        setFilms(published);
        setSelected(value => published.some(film => film.url === value) ? value : published[0]?.url || '');
        setStatus('ready');
      } catch { if (current) setStatus('error'); }
      finally { window.clearTimeout(timeout); }
    })();
    return () => { current = false; controller.abort(); window.clearTimeout(timeout); };
  }, [reload]);
  const selectedFilm = films.find(film => film.url === selected);
  return <section id="films" className="dc-films dc-section" aria-labelledby="dc-films-title">
    <div className="dc-section-heading"><div><p className="dc-eyebrow">DOELV MOTION PICTURES</p><h2 id="dc-films-title">공간의 변화,<br />영상으로 경험하다.</h2></div><p>스카이게러지의 이야기와<br />새로운 이동의 순간을 만나보세요.</p></div>
    {status === 'loading' && <p className="dc-films-status" role="status">영상 목록을 불러오고 있습니다.</p>}
    {status === 'error' && <div className="dc-films-status" role="alert"><p>영상 목록을 불러오지 못했습니다.</p><button type="button" onClick={() => setReload(value => value + 1)}>영상 목록 다시 불러오기</button></div>}
    {status === 'ready' && !selectedFilm && <p className="dc-films-status">공개된 영상이 아직 없습니다.</p>}
    {status === 'ready' && selectedFilm && <div className="dc-film-layout"><div className="dc-film-feature"><FilmPlayer key={selectedFilm.url} film={selectedFilm} /></div><div className="dc-film-playlist" role="group" aria-label="영상 선택">
      {films.map((film, index) => <button key={film.url} type="button" aria-pressed={selected === film.url} onClick={() => setSelected(film.url)} className="dc-film-card">
        <span className="dc-film-thumbnail">{film.poster ? <img src={film.poster} alt="" width={320} height={180} loading="lazy" /> : <span className="dc-film-placeholder" aria-hidden="true">DOELV</span>}<span aria-hidden="true">{film.duration || '▶'}</span></span>
        <span className="dc-film-card-copy"><small>FILM {String(index + 1).padStart(2, '0')}</small><strong>{film.title}</strong><span>{selected === film.url ? '선택한 영상' : '영상 선택'} ↗</span></span>
      </button>)}
    </div></div>}
  </section>;
}
