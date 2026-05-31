import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BadgeImageZone from './BadgeImageZone';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const scrollBounce = keyframes`
  0%, 100% { transform: translateY(0); opacity: 1; }
  50% { transform: translateY(8px); opacity: 0.5; }
`;

const slowZoom = keyframes`
  0% { transform: scale(1); }
  100% { transform: scale(1.06); }
`;

import { HERO_BG } from '../constants/images';
import { useSiteImages } from '../hooks/useSiteImages';
import ImageEditOverlay from './ImageEditOverlay';

export default function HeroSection() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const { getImageUrl, getObjectPosition, getImageScale, refetch } = useSiteImages();
  const HERO_IMAGE = getImageUrl('hero-background', HERO_BG);

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;

    const dots: { x: number; y: number; vx: number; vy: number; r: number }[] = Array.from({ length: 50 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.2 + 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      dots.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
      });
      dots.forEach((a, i) => {
        dots.slice(i + 1).forEach((b) => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(255,255,255,${0.06 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const stats = [
    { id: 'sla', value: '≤8분', label: '세대 도착 SLA' },
    { id: 'modes', value: '3 모드', label: '자유 선택 통합' },
    { id: 'ai', value: '24/7', label: '무인 AI 운영' },
    { id: 'patent', value: '특허', label: '세계 최초 출원' },
  ];

  return (
    <Box
      id="hero"
      component="section"
      sx={{
        position: 'relative',
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Cinematic background photo */}
      <ImageEditOverlay
        slot="hero-background"
        label="히어로 배경"
        currentUrl={getImageUrl('hero-background', '')}
        onImageChange={refetch}
        fillParent
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: getImageScale('hero-background') > 100 ? `${getImageScale('hero-background')}%` : 'cover',
            backgroundPosition: getObjectPosition('hero-background'),
            animation: `${slowZoom} 20s ease-in-out infinite alternate`,
            transformOrigin: 'center center',
          }}
        />
      </ImageEditOverlay>

      {/* Dark cinematic overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: isDark
            ? `linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,5,20,0.65) 40%, rgba(0,0,0,0.75) 100%)`
            : `linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,5,20,0.5) 40%, rgba(0,0,0,0.65) 100%)`,
        }}
      />

      {/* Gold accent overlay at bottom */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 100% 50% at 50% 100%, rgba(201,168,76,0.12) 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, pt: { xs: 12, md: 0 } }}>
        <Box sx={{ maxWidth: 900, mx: 'auto', textAlign: 'center' }}>
          {/* Main title phrase */}
          <Typography
            sx={{
              fontSize: { xs: '0.85rem', sm: '1rem', md: '1.15rem' },
              fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              letterSpacing: '0.06em',
              mb: { xs: 1.5, md: 2 },
              animation: `${fadeInUp} 0.8s 0.1s ease both`,
              textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.5)',
              lineHeight: 1.8,
            }}
          >
            하늘의 궁전! 나만의 주차공간!
            <br />
            주차스트레스에서의 해방일지!
          </Typography>

          {/* Main headline */}
          <Box
            sx={{
              mb: 2,
              animation: `${fadeInUp} 0.8s 0.2s ease both`,
            }}
          >
            {/* Gold title with refined backdrop */}
            <Box
              sx={{
                display: 'inline-block',
                position: 'relative',
                mb: { xs: 0.5, md: 0.5 },
                px: { xs: 1.5, md: 2.5 },
                py: { xs: 0.25, md: 0.5 },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '-2px',
                  borderRadius: '8px',
                  background: `linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(10,8,4,0.7) 100%)`,
                  backdropFilter: 'blur(16px)',
                  border: `1px solid rgba(201,168,76,0.2)`,
                  boxShadow: `inset 0 1px 0 rgba(201,168,76,0.08), 0 8px 32px rgba(0,0,0,0.5)`,
                },
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  position: 'relative',
                  fontSize: { xs: '2.2rem', sm: '3rem', md: '4.2rem', lg: '5rem' },
                  fontWeight: 900,
                  lineHeight: 1.15,
                  background: `linear-gradient(90deg, #ffd54f 0%, #fff8e1 30%, ${COLORS.GOLD_LIGHT} 50%, #fff8e1 70%, #ffd54f 100%)`,
                  backgroundSize: '200% auto',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: `${shimmer} 6s ease-in-out infinite`,
                  filter: `drop-shadow(0 1px 3px rgba(201,168,76,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))`,
                }}
              >
                주차의 모든 방식을
              </Typography>
            </Box>
            <Typography
              variant="h1"
              component="div"
              sx={{
                fontSize: { xs: '2.2rem', sm: '3rem', md: '4.2rem', lg: '5rem' },
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.15,
                mt: { xs: 0.5, md: 0.75 },
                textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.5)',
              }}
            >
              하나로 통합하다
            </Typography>
          </Box>

          {/* Subheadline */}
          <Typography
            variant="h5"
            sx={{
              color: 'rgba(255,255,255,0.92)',
              mb: 4,
              fontWeight: 400,
              fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.2rem' },
              lineHeight: 1.7,
              animation: `${fadeInUp} 0.8s 0.35s ease both`,
              textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 24px rgba(0,0,0,0.4)',
              '& strong': {
                color: goldLight,
                fontWeight: 700,
                textShadow: `0 0 12px ${COLORS.GOLD}60`,
              },
            }}
          >
            AI차세대 주거혁명, <strong>팔라트리아 스카이게러지</strong>가 만듭니다.
            <br />
            <strong>세대직입</strong> · <strong>공용주차장 발렛</strong> · <strong>자가주차</strong> — 통합 스마트 주차 플랫폼
          </Typography>

          {/* CTA Buttons */}
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 1.5, sm: 2 },
              justifyContent: 'center',
              flexWrap: 'wrap',
              mb: 6,
              animation: `${fadeInUp} 0.8s 0.5s ease both`,
            }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => document.getElementById('solution')?.scrollIntoView({ behavior: 'smooth' })}
              sx={{ px: { xs: 3, sm: 4 }, py: 1.75, fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              시스템 알아보기
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              sx={{
                px: { xs: 3, sm: 4 }, py: 1.75, fontSize: { xs: '0.9rem', sm: '1rem' },
                borderColor: 'rgba(255,255,255,0.5)',
                color: '#ffffff',
                backdropFilter: 'blur(8px)',
                background: 'rgba(255,255,255,0.08)',
                '&:hover': {
                  borderColor: goldColor,
                  color: goldColor,
                  background: 'rgba(201,168,76,0.1)',
                },
              }}
            >
              도입 문의하기
            </Button>
          </Box>

          {/* Company label */}
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
              animation: `${fadeInUp} 0.8s 0.6s ease both`,
              display: 'block',
              mb: 6,
            }}
          >
            주식회사 제이에이치홀딩스
          </Typography>

          {/* Stats row — premium badge cards with top/bottom image zones */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: { xs: 1.5, sm: 2 },
              animation: `${fadeInUp} 0.8s 0.7s ease both`,
              mb: 4,
            }}
          >
            {stats.map((stat) => {
              const topImgUrl = getImageUrl(`hero-stat-${stat.id}-top`, '');
              const bottomImgUrl = getImageUrl(`hero-stat-${stat.id}-bottom`, '');

              return (
                <Box
                  key={stat.id}
                  sx={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: `linear-gradient(160deg, rgba(15,15,25,0.88) 0%, rgba(25,20,10,0.92) 100%)`,
                    backdropFilter: 'blur(20px)',
                    border: `1px solid rgba(201,168,76,0.25)`,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                    transition: (t) => t.transitions.create(['transform', 'box-shadow', 'border-color'], { duration: 300 }),
                    '&:hover': {
                      transform: 'translateY(-6px) scale(1.02)',
                      border: `1px solid rgba(201,168,76,0.6)`,
                      boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 20px rgba(201,168,76,0.15)`,
                    },
                  }}
                >
                  {/* Top image zone */}
                  <BadgeImageZone
                    slot={`hero-stat-${stat.id}`}
                    position="top"
                    imageUrl={topImgUrl}
                    onImageChange={refetch}
                    height={{ xs: 48, sm: 56, md: 64 }}
                  />

                  {/* Gold accent line */}
                  <Box
                    sx={{
                      height: 2,
                      background: `linear-gradient(90deg, transparent 0%, ${COLORS.GOLD}60 50%, transparent 100%)`,
                    }}
                  />

                  {/* Main content area */}
                  <Box sx={{ py: { xs: 2, sm: 2.5 }, px: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontFamily: '"Montserrat", sans-serif',
                        fontWeight: 900,
                        color: COLORS.GOLD_LIGHT,
                        fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2.1rem' },
                        lineHeight: 1,
                        mb: 0.75,
                        textShadow: `0 0 20px ${COLORS.GOLD}80, 0 2px 6px rgba(0,0,0,0.8)`,
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.95)',
                        fontSize: { xs: '0.68rem', sm: '0.74rem' },
                        letterSpacing: '0.06em',
                        fontWeight: 600,
                        textTransform: 'none',
                      }}
                    >
                      {stat.label}
                    </Typography>
                  </Box>

                  {/* Bottom image zone */}
                  <BadgeImageZone
                    slot={`hero-stat-${stat.id}`}
                    position="bottom"
                    imageUrl={bottomImgUrl}
                    onImageChange={refetch}
                    height={{ xs: 40, sm: 48, md: 56 }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Container>

      {/* Scroll indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          animation: `${fadeInUp} 0.8s 1s ease both`,
        }}
        onClick={() => document.getElementById('painpoint')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: '0.15em' }}>
          SCROLL
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            color: goldColor,
            opacity: 0.8,
            animation: `${scrollBounce} 2s ease-in-out infinite`,
          }}
        />
      </Box>

      {/* Bottom gradient fade */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: isDark
            ? 'linear-gradient(to bottom, transparent, rgba(10,10,15,0.95))'
            : 'linear-gradient(to bottom, transparent, rgba(248,246,240,0.95))',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}
