import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { supabase } from '../lib/supabase';

interface MediaItem {
  url: string;
  alt?: string;
  video_url?: string;
}

interface PlaybackSettings {
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  show_controls: boolean;
  play_mode: 'sequential' | 'manual';
  transition_delay: number;
}

const DEFAULT_SETTINGS: PlaybackSettings = {
  autoplay: true,
  muted: true,
  loop: true,
  show_controls: false,
  play_mode: 'sequential',
  transition_delay: 1,
};

interface FocalPoint {
  x: number;
  y: number;
  scale?: number;
}

interface SectionMedia {
  id: string;
  position: string;
  layout: string;
  media_type: string;
  items: MediaItem[];
  sort_order: number;
  playback_settings?: PlaybackSettings;
  focal_points?: FocalPoint[];
}

interface SectionMediaStripProps {
  position: string;
}

export default function SectionMediaStrip({ position }: SectionMediaStripProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [mediaList, setMediaList] = useState<SectionMedia[]>([]);

  const fetchMedia = useCallback(async () => {
    const { data } = await supabase
      .from('section_media')
      .select('*')
      .eq('position', position)
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (data) setMediaList(data as SectionMedia[]);
  }, [position]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  if (mediaList.length === 0) return null;

  return (
    <>
      {mediaList.map((media) => (
        <Box
          key={media.id}
          sx={{
            py: { xs: 1, md: 2 },
          }}
        >
          <Container maxWidth="lg" disableGutters sx={{ px: { xs: 0, md: 2 } }}>
            {media.media_type === 'video' ? (
              <VideoPlaylist
                items={media.items}
                isDark={isDark}
                settings={media.playback_settings || DEFAULT_SETTINGS}
              />
            ) : (
              <ImageGrid items={media.items} layout={media.layout} isDark={isDark} focalPoints={media.focal_points} />
            )}
          </Container>
        </Box>
      ))}
    </>
  );
}

function VideoPlaylist({ items, isDark, settings }: { items: MediaItem[]; isDark: boolean; settings: PlaybackSettings }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(settings.muted);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlayRef = useRef(false);

  const validItems = items.filter((item) => item.url || item.video_url);

  const currentItem = validItems[currentIndex] || null;
  const currentUrl = currentItem ? (currentItem.video_url || currentItem.url) : '';
  const isEmbed = currentUrl.includes('youtube.com') || currentUrl.includes('youtu.be') || currentUrl.includes('vimeo.com');

  // Visibility detection for autoplay
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setIsVisible(entry.isIntersecting); },
      { threshold: 0.4 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Autoplay when visible, pause when hidden
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isEmbed) return;
    if (settings.autoplay && isVisible && !isPlaying) {
      video.play().catch(() => {});
    } else if (!isVisible && isPlaying) {
      video.pause();
    }
  }, [isVisible, settings.autoplay, isEmbed]);

  // Load and play when currentIndex changes (sequential advance)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isEmbed) return;
    video.muted = isMuted;
    video.load();
    if (pendingPlayRef.current || (settings.autoplay && isVisible)) {
      video.play().catch(() => {});
      pendingPlayRef.current = false;
    }
  }, [currentIndex]);

  // Sync muted state to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const handleEnded = () => {
    if (settings.play_mode === 'sequential') {
      const hasNext = currentIndex < validItems.length - 1;
      const shouldLoop = settings.loop;

      if (hasNext || shouldLoop) {
        pendingPlayRef.current = true;
        const nextIndex = hasNext ? currentIndex + 1 : 0;
        const delay = settings.transition_delay > 0 ? settings.transition_delay * 1000 : 0;

        if (delay > 0) {
          transitionTimerRef.current = setTimeout(() => {
            setCurrentIndex(nextIndex);
            setProgress(0);
          }, delay);
        } else {
          setCurrentIndex(nextIndex);
          setProgress(0);
        }
      } else {
        setIsPlaying(false);
        setProgress(100);
      }
    } else {
      if (settings.loop && validItems.length === 1) {
        const video = videoRef.current;
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {});
        }
      } else {
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(prev => !prev);
  };

  const handlePointerEnter = () => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    setShowOverlay(true);
  };

  const handlePointerLeave = () => {
    overlayTimerRef.current = setTimeout(() => setShowOverlay(false), 1500);
  };

  const goNext = () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    pendingPlayRef.current = isPlaying;
    if (currentIndex < validItems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else if (settings.loop) {
      setCurrentIndex(0);
      setProgress(0);
    }
  };

  const goPrev = () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    pendingPlayRef.current = isPlaying;
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    } else if (settings.loop) {
      setCurrentIndex(validItems.length - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, []);

  if (validItems.length === 0) return null;

  if (isEmbed) {
    return <EmbedPlaylist items={validItems} isDark={isDark} settings={settings} />;
  }

  return (
    <Box ref={containerRef}>
      <Box
        onClick={handleVideoClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        sx={{
          position: 'relative',
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'pointer',
          border: isDark
            ? '1px solid rgba(201,168,76,0.1)'
            : '1px solid rgba(159,122,45,0.08)',
        }}
      >
        <Box
          component="video"
          ref={videoRef}
          src={currentUrl}
          muted={isMuted}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
          sx={{
            width: '100%',
            height: { xs: 280, md: 480 },
            objectFit: 'cover',
            display: 'block',
            bgcolor: 'common.black',
          }}
        />

        {/* Overlay controls */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            display: 'flex',
            gap: 0.5,
            opacity: showOverlay || !isPlaying ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        >
          <IconButton
            onClick={handleMuteToggle}
            size="small"
            sx={{
              bgcolor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              width: 32,
              height: 32,
            }}
          >
            {isMuted
              ? <VolumeOffIcon sx={{ fontSize: 16 }} />
              : <VolumeUpIcon sx={{ fontSize: 16 }} />
            }
          </IconButton>
        </Box>

        {/* Play/Pause center indicator (brief flash) */}
        {!isPlaying && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <PlayArrowIcon sx={{ fontSize: 32, color: '#fff' }} />
          </Box>
        )}
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 2,
          bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          '& .MuiLinearProgress-bar': {
            bgcolor: isDark ? 'rgba(201,168,76,0.7)' : 'rgba(159,122,45,0.7)',
          },
        }}
      />

      {/* Thumbnail strip for multiple videos */}
      {validItems.length > 1 && (
        <Box
          sx={{
            mt: 1,
            display: 'flex',
            gap: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <IconButton
            onClick={goPrev}
            size="small"
            disabled={!settings.loop && currentIndex === 0}
            sx={{ color: isDark ? 'rgba(201,168,76,0.6)' : 'rgba(159,122,45,0.6)' }}
          >
            <SkipPreviousIcon sx={{ fontSize: 18 }} />
          </IconButton>

          {validItems.map((item, idx) => (
            <Box
              key={idx}
              onClick={() => {
                if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
                pendingPlayRef.current = isPlaying;
                setCurrentIndex(idx);
                setProgress(0);
              }}
              sx={{
                width: { xs: 60, md: 90 },
                height: { xs: 38, md: 52 },
                borderRadius: 0.5,
                overflow: 'hidden',
                cursor: 'pointer',
                border: idx === currentIndex
                  ? isDark ? '2px solid rgba(201,168,76,0.7)' : '2px solid rgba(159,122,45,0.6)'
                  : '1px solid transparent',
                opacity: idx === currentIndex ? 1 : 0.5,
                transition: 'opacity 0.2s ease, border-color 0.2s ease',
                '&:hover': { opacity: 0.85 },
              }}
            >
              <Box
                component="video"
                src={item.video_url || item.url}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
            </Box>
          ))}

          <IconButton
            onClick={goNext}
            size="small"
            disabled={!settings.loop && currentIndex === validItems.length - 1}
            sx={{ color: isDark ? 'rgba(201,168,76,0.6)' : 'rgba(159,122,45,0.6)' }}
          >
            <SkipNextIcon sx={{ fontSize: 18 }} />
          </IconButton>

          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', ml: 0.5, fontSize: '0.7rem' }}
          >
            {currentIndex + 1}/{validItems.length}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function EmbedPlaylist({ items, isDark, settings }: { items: MediaItem[]; isDark: boolean; settings: PlaybackSettings }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentItem = items[currentIndex];
  const currentUrl = currentItem.video_url || currentItem.url;

  let embedUrl = currentUrl;
  const isYoutube = currentUrl.includes('youtube.com') || currentUrl.includes('youtu.be');
  const isVimeo = currentUrl.includes('vimeo.com');

  if (isYoutube) {
    const match = currentUrl.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    if (match) {
      const params = new URLSearchParams();
      if (settings.autoplay) params.set('autoplay', '1');
      if (settings.muted) params.set('mute', '1');
      if (settings.loop && items.length === 1) params.set('loop', '1');
      params.set('controls', '0');
      embedUrl = `https://www.youtube.com/embed/${match[1]}?${params.toString()}`;
    }
  } else if (isVimeo) {
    const match = currentUrl.match(/vimeo\.com\/(\d+)/);
    if (match) {
      const params = new URLSearchParams();
      if (settings.autoplay) params.set('autoplay', '1');
      if (settings.muted) params.set('muted', '1');
      if (settings.loop && items.length === 1) params.set('loop', '1');
      embedUrl = `https://player.vimeo.com/video/${match[1]}?${params.toString()}`;
    }
  }

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%',
          borderRadius: 1,
          overflow: 'hidden',
          border: isDark
            ? '1px solid rgba(201,168,76,0.1)'
            : '1px solid rgba(159,122,45,0.08)',
        }}
      >
        <Box
          component="iframe"
          key={`${currentIndex}-${embedUrl}`}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </Box>

      {items.length > 1 && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
          <IconButton
            onClick={() => {
              if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
              else if (settings.loop) setCurrentIndex(items.length - 1);
            }}
            size="small"
            disabled={!settings.loop && currentIndex === 0}
            sx={{ color: isDark ? 'rgba(201,168,76,0.6)' : 'rgba(159,122,45,0.6)' }}
          >
            <SkipPreviousIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            {currentIndex + 1}/{items.length}
          </Typography>
          <IconButton
            onClick={() => {
              if (currentIndex < items.length - 1) setCurrentIndex(currentIndex + 1);
              else if (settings.loop) setCurrentIndex(0);
            }}
            size="small"
            disabled={!settings.loop && currentIndex === items.length - 1}
            sx={{ color: isDark ? 'rgba(201,168,76,0.6)' : 'rgba(159,122,45,0.6)' }}
          >
            <SkipNextIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}

function ImageGrid({ items, layout, isDark, focalPoints }: { items: MediaItem[]; layout: string; isDark: boolean; focalPoints?: FocalPoint[] }) {
  const getGridSize = () => {
    switch (layout) {
      case '1col': return { xs: 12 };
      case '2col': return { xs: 12, sm: 6 };
      case '3col': return { xs: 12, sm: 6, md: 4 };
      default: return { xs: 12 };
    }
  };

  const gridSize = getGridSize();
  const visibleItems = items.slice(0, layout === '3col' ? 3 : layout === '2col' ? 2 : 1);

  return (
    <Grid container spacing={2}>
      {visibleItems.map((item, idx) => {
        const fp = focalPoints?.[idx];
        const objectPosition = fp ? `${fp.x}% ${fp.y}%` : '50% 50%';
        const imgScale = fp?.scale && fp.scale > 100 ? fp.scale / 100 : 1;
        const transformOrigin = fp ? `${fp.x}% ${fp.y}%` : '50% 50%';
        return (
          <Grid key={idx} size={gridSize}>
            <Box
              sx={{
                position: 'relative',
                borderRadius: 1,
                overflow: 'hidden',
                transition: 'transform 0.3s ease',
                border: isDark
                  ? '1px solid rgba(201,168,76,0.08)'
                  : '1px solid rgba(159,122,45,0.08)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box
                component="img"
                src={item.url}
                alt={item.alt || ''}
                loading="lazy"
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  objectPosition,
                  display: 'block',
                  transform: imgScale > 1 ? `scale(${imgScale})` : undefined,
                  transformOrigin,
                }}
              />
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}