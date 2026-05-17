import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import TimerIcon from '@mui/icons-material/Timer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ElevatorIcon from '@mui/icons-material/Elevator';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import StarIcon from '@mui/icons-material/Star';
import VerifiedIcon from '@mui/icons-material/Verified';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import HomeIcon from '@mui/icons-material/Home';
import ScheduleIcon from '@mui/icons-material/Schedule';

// Animations
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(201,168,76,0.4); }
  50% { transform: scale(1.02); box-shadow: 0 0 30px rgba(201,168,76,0.2); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

// TypeScript interfaces
interface FeatureCard {
  icon: React.ReactNode;
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  badge?: string;
  color: string;
}

interface ProcessStep {
  step: number;
  titleKo: string;
  descriptionKo: string;
  icon: React.ReactNode;
  duration: string;
}

interface BenefitStat {
  value: string;
  labelKo: string;
  labelEn: string;
}

// Data
const features: FeatureCard[] = [
  {
    icon: <HomeIcon sx={{ fontSize: 36 }} />,
    titleKo: '세대 스카이게러지 직배송',
    titleEn: 'Door-to-Sky-Garage Delivery',
    descriptionKo: '건물 입구가 아닌, 각 세대의 전용 스카이게러지 룸까지 차량을 직접 배송합니다. 현관 앞에서 바로 승하차하는 완전한 편의를 제공합니다.',
    badge: "World's First",
    color: COLORS.GOLD,
  },
  {
    icon: <ElevatorIcon sx={{ fontSize: 36 }} />,
    titleKo: '탑승/별도이동 선택',
    titleEn: 'Ride-Along Option',
    descriptionKo: '차량과 함께 이동하거나, 별도 엘리베이터를 이용하거나 — 입주민이 자유롭게 선택할 수 있습니다. 상황에 따른 유연한 동선을 제공합니다.',
    color: COLORS.TECH_BLUE,
  },
  {
    icon: <LocalParkingIcon sx={{ fontSize: 36 }} />,
    titleKo: '제로 주차 스트레스',
    titleEn: 'Zero Parking Stress',
    descriptionKo: '발렛 디스패치 플랫폼에 차를 세우기만 하면 AI 시스템이 자동으로 빈 공간(스카이게러지 유닛 또는 지하주차장)을 찾아 주차합니다.',
    color: '#10b981',
  },
  {
    icon: <PhoneIphoneIcon sx={{ fontSize: 36 }} />,
    titleKo: '앱 기반 스마트 호출',
    titleEn: 'App-Based Retrieval',
    descriptionKo: '외출 후 귀가 시, 앱에서 차량 출차를 예약하면 자율이송로봇이 정확한 시간에 발렛 플랫폼으로 차량을 배송합니다.',
    badge: 'AI Powered',
    color: COLORS.TECH_BLUE,
  },
  {
    icon: <TimerIcon sx={{ fontSize: 36 }} />,
    titleKo: '시간 효율 극대화',
    titleEn: 'Time Efficiency',
    descriptionKo: '주차 공간 탐색, 이동, 대기 — 모든 불필요한 시간 낭비를 제거합니다. 주차에 쏟던 시간을 삶의 질로 돌려드립니다.',
    color: '#f59e0b',
  },
  {
    icon: <EmojiEventsIcon sx={{ fontSize: 36 }} />,
    titleKo: '세계 최초 특허 기술',
    titleEn: 'Patent Innovation',
    descriptionKo: '전 세계 어디에도 없는, 세계 최초로 특허 출원된 AI 자율이송 발렛 주차 시스템입니다. 주거 혁신의 새로운 기준을 제시합니다.',
    badge: 'Patent Pending',
    color: COLORS.GOLD,
  },
];

const processSteps: ProcessStep[] = [
  {
    step: 1,
    titleKo: '발렛 플랫폼에 주차',
    descriptionKo: '지정된 발렛 디스패치 플랫폼에 차량을 세우고 하차합니다. 주차 위치를 찾을 필요가 없습니다.',
    icon: <DirectionsCarIcon sx={{ fontSize: 32 }} />,
    duration: '즉시',
  },
  {
    step: 2,
    titleKo: 'AI가 빈 공간 탐색',
    descriptionKo: 'AI 시스템이 실시간으로 스카이게러지 유닛 또는 지하 주차 공간 중 최적의 빈 공간을 자동으로 탐색합니다.',
    icon: <SmartToyIcon sx={{ fontSize: 32 }} />,
    duration: '~10초',
  },
  {
    step: 3,
    titleKo: '자율이송로봇 운반',
    descriptionKo: 'ATR 자율이송로봇이 차량을 리프팅하여 전용 경로를 통해 배정된 스카이게러지 또는 주차공간으로 안전하게 이송합니다.',
    icon: <RocketLaunchIcon sx={{ fontSize: 32 }} />,
    duration: '4~8분',
  },
  {
    step: 4,
    titleKo: '앱 예약 출차',
    descriptionKo: '귀가 전 앱에서 출차를 예약하면, 도착 시간에 맞춰 자율이송로봇이 차량을 발렛 플랫폼에 정확히 배치합니다.',
    icon: <ScheduleIcon sx={{ fontSize: 32 }} />,
    duration: '예약 시간 정확 도착',
  },
];

const benefits: BenefitStat[] = [
  { value: '0분', labelKo: '주차 탐색 시간', labelEn: 'Search Time' },
  { value: '100%', labelKo: '자율 운행', labelEn: 'Autonomous' },
  { value: '24/7', labelKo: '무인 운영', labelEn: 'Unmanned' },
  { value: '세계 최초', labelKo: '특허 출원', labelEn: 'Patent Filed' },
];

export default function SkyGarageValet() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;

    const dots: { x: number; y: number; vx: number; vy: number; r: number }[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.5 + 0.5,
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
        ctx.fillStyle = 'rgba(201,168,76,0.15)';
        ctx.fill();
      });
      dots.forEach((a, i) => {
        dots.slice(i + 1).forEach((b) => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(201,168,76,${0.04 * (1 - dist / 120)})`;
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

  return (
    <Box sx={{ background: isDark ? COLORS.BG_PRIMARY : COLORS.LIGHT_BG_PRIMARY, minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* ===== HERO SECTION ===== */}
      <Box
        sx={{
          position: 'relative',
          minHeight: 'calc(var(--vh, 1vh) * 100)',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: `linear-gradient(135deg, #0A1628 0%, #1B2B4B 40%, #0f1d35 100%)`,
        }}
      >
        {/* Particle canvas */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />

        {/* Radial glow */}
        <Box
          sx={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            height: '60%',
            background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 12, md: 0 } }}>
          <Box sx={{ maxWidth: 900, mx: 'auto', textAlign: 'center' }}>
            {/* Patent badge */}
            <Box sx={{ animation: `${fadeInUp} 0.8s ease both`, mb: 3 }}>
              <Chip
                icon={<VerifiedIcon sx={{ color: `${COLORS.GOLD} !important`, fontSize: '1rem' }} />}
                label="WORLD'S FIRST PATENT-FILED TECHNOLOGY"
                sx={{
                  bgcolor: 'rgba(201,168,76,0.12)',
                  border: `1px solid rgba(201,168,76,0.4)`,
                  color: COLORS.GOLD_LIGHT,
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.1em',
                  py: 0.5,
                  animation: `${pulse} 3s ease-in-out infinite`,
                }}
              />
            </Box>

            {/* Main headline */}
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2rem', sm: '2.8rem', md: '3.8rem', lg: '4.5rem' },
                fontWeight: 900,
                mb: 3,
                animation: `${fadeInUp} 0.8s 0.15s ease both`,
                color: '#ffffff',
                textShadow: '0 2px 40px rgba(0,0,0,0.5)',
                lineHeight: 1.15,
              }}
            >
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${COLORS.GOLD_DARK} 0%, ${COLORS.GOLD} 30%, ${COLORS.GOLD_LIGHT} 60%, ${COLORS.GOLD} 100%)`,
                  backgroundSize: '300% auto',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: `${shimmer} 4s linear infinite`,
                }}
              >
                스카이게러지
              </Box>
              <br />
              AI 자율이송 발렛 시스템
            </Typography>

            {/* Subheadline */}
            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255,255,255,0.75)',
                mb: 4,
                fontWeight: 400,
                fontSize: { xs: '0.9rem', sm: '1rem', md: '1.15rem' },
                lineHeight: 1.8,
                animation: `${fadeInUp} 0.8s 0.3s ease both`,
                maxWidth: 680,
                mx: 'auto',
              }}
            >
              건물 입구가 아닌, <Box component="span" sx={{ color: COLORS.GOLD_LIGHT, fontWeight: 700 }}>각 세대 전용 스카이게러지까지</Box> 차량을 자동 배송하는
              <br />세계 최초 특허 출원 AI 자율이송 발렛 주차 시스템
            </Typography>

            {/* English subtitle */}
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.4)',
                mb: 5,
                fontSize: '0.8rem',
                letterSpacing: '0.05em',
                animation: `${fadeInUp} 0.8s 0.4s ease both`,
              }}
            >
              The World's First Patent-Filed AI Autonomous Valet System for Residential Sky Garages
            </Typography>

            {/* CTA Buttons */}
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                flexWrap: 'wrap',
                animation: `${fadeInUp} 0.8s 0.5s ease both`,
              }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<SmartToyIcon />}
                onClick={() => document.getElementById('valet-features')?.scrollIntoView({ behavior: 'smooth' })}
                sx={{ px: 4, py: 1.75 }}
              >
                시스템 알아보기
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<StarIcon />}
                onClick={() => document.getElementById('valet-process')?.scrollIntoView({ behavior: 'smooth' })}
                sx={{
                  px: 4,
                  py: 1.75,
                  borderColor: 'rgba(255,255,255,0.4)',
                  color: '#ffffff',
                  backdropFilter: 'blur(8px)',
                  background: 'rgba(255,255,255,0.06)',
                  '&:hover': {
                    borderColor: COLORS.GOLD,
                    color: COLORS.GOLD,
                    background: 'rgba(201,168,76,0.08)',
                  },
                }}
              >
                작동 원리 보기
              </Button>
            </Box>
          </Box>
        </Container>

        {/* Bottom gradient */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 200,
            background: isDark
              ? `linear-gradient(to bottom, transparent, ${COLORS.BG_PRIMARY})`
              : `linear-gradient(to bottom, transparent, ${COLORS.LIGHT_BG_PRIMARY})`,
            pointerEvents: 'none',
          }}
        />
      </Box>

      {/* ===== FEATURE CARDS SECTION ===== */}
      <Box
        id="valet-features"
        component="section"
        sx={{
          py: { xs: 8, md: 14 },
          position: 'relative',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
            <Typography
              variant="overline"
              sx={{ color: goldColor, letterSpacing: '0.2em', fontSize: '0.7rem', mb: 2, display: 'block' }}
            >
              KEY FEATURES
            </Typography>
            <Typography variant="h2" sx={{ fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' }, mb: 2 }}>
              6가지{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                핵심 기능
              </Box>
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 560, mx: 'auto' }}>
              기존 발렛 주차의 한계를 넘어, AI가 만드는 완전히 새로운 주차 경험
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {features.map((feature, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.titleEn}>
                <Card
                  sx={{
                    height: '100%',
                    position: 'relative',
                    overflow: 'visible',
                    background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                    border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    animation: `${fadeInUp} 0.6s ${0.1 + i * 0.08}s ease both`,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      border: `1px solid ${feature.color}60`,
                      boxShadow: `0 0 40px rgba(${feature.color === COLORS.GOLD ? '201,168,76' : feature.color === COLORS.TECH_BLUE ? '59,130,246' : feature.color === '#10b981' ? '16,185,129' : '245,158,11'},0.15), 0 20px 60px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`,
                    },
                  }}
                >
                  {feature.badge && (
                    <Chip
                      label={feature.badge}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: -12,
                        right: 16,
                        bgcolor: feature.color,
                        color: '#0a0a0f',
                        fontWeight: 800,
                        fontSize: '0.6rem',
                        letterSpacing: '0.05em',
                        height: 24,
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: `${feature.color}12`,
                        border: `1px solid ${feature.color}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: feature.color,
                        mb: 2.5,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.95rem' }}>
                      {feature.titleKo}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: feature.color, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.03em', mb: 1.5, display: 'block' }}
                    >
                      {feature.titleEn}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, fontSize: '0.83rem' }}>
                      {feature.descriptionKo}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ===== HOW IT WORKS SECTION ===== */}
      <Box
        id="valet-process"
        component="section"
        sx={{
          py: { xs: 8, md: 14 },
          background: isDark
            ? `linear-gradient(180deg, ${COLORS.BG_SECONDARY} 0%, ${COLORS.BG_PRIMARY} 100%)`
            : `linear-gradient(180deg, #ede8da 0%, #f8f6f0 100%)`,
          position: 'relative',
        }}
      >
        {/* Grid pattern */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: isDark
              ? `linear-gradient(rgba(201,168,76,0.015) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(201,168,76,0.015) 1px, transparent 1px)`
              : `linear-gradient(rgba(158,127,48,0.03) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(158,127,48,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
            <Typography
              variant="overline"
              sx={{ color: goldColor, letterSpacing: '0.2em', fontSize: '0.7rem', mb: 2, display: 'block' }}
            >
              HOW IT WORKS
            </Typography>
            <Typography variant="h2" sx={{ fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' }, mb: 2 }}>
              4단계{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                스마트 발렛 프로세스
              </Box>
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto' }}>
              주차에 대한 걱정 없이, 차를 세우는 순간부터 모든 것이 자동으로 처리됩니다
            </Typography>
          </Box>

          {/* Desktop horizontal timeline */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            {/* Connector line */}
            <Box sx={{ position: 'relative', mb: 6 }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 40,
                  left: '12%',
                  right: '12%',
                  height: 2,
                  background: `linear-gradient(90deg, ${goldColor}, ${COLORS.TECH_BLUE}, ${goldColor})`,
                  opacity: 0.3,
                }}
              />
              <Grid container spacing={3}>
                {processSteps.map((step, i) => (
                  <Grid size={{ md: 3 }} key={step.step}>
                    <Box
                      sx={{
                        textAlign: 'center',
                        animation: `${fadeInUp} 0.6s ${0.2 + i * 0.15}s ease both`,
                      }}
                    >
                      {/* Step circle */}
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${COLORS.GOLD_DARK}, ${COLORS.GOLD})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0a0a0f',
                          mx: 'auto',
                          mb: 3,
                          boxShadow: `0 8px 32px rgba(201,168,76,0.3)`,
                          animation: `${float} ${3 + i * 0.5}s ease-in-out infinite`,
                          animationDelay: `${i * 0.3}s`,
                        }}
                      >
                        {step.icon}
                      </Box>

                      {/* Step number */}
                      <Typography
                        sx={{
                          fontFamily: '"Montserrat", sans-serif',
                          fontWeight: 900,
                          fontSize: '0.65rem',
                          color: goldColor,
                          opacity: 0.6,
                          letterSpacing: '0.1em',
                          mb: 1,
                        }}
                      >
                        STEP {String(step.step).padStart(2, '0')}
                      </Typography>

                      {/* Title */}
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, fontSize: '1rem' }}>
                        {step.titleKo}
                      </Typography>

                      {/* Description */}
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.7, mb: 1.5 }}>
                        {step.descriptionKo}
                      </Typography>

                      {/* Duration */}
                      <Chip
                        label={step.duration}
                        size="small"
                        sx={{
                          bgcolor: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.12)',
                          color: goldColor,
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          border: `1px solid ${goldColor}30`,
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>

          {/* Mobile vertical timeline */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 0 }}>
            {processSteps.map((step, i) => (
              <Box key={step.step} sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${COLORS.GOLD_DARK}, ${COLORS.GOLD})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0a0a0f',
                      flexShrink: 0,
                    }}
                  >
                    {step.icon}
                  </Box>
                  {i < processSteps.length - 1 && (
                    <Box sx={{ width: 2, flex: 1, minHeight: 40, background: 'rgba(201,168,76,0.2)', my: 0.5 }} />
                  )}
                </Box>
                <Box sx={{ pb: i < processSteps.length - 1 ? 3 : 0, flex: 1 }}>
                  <Typography
                    sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 900, fontSize: '0.6rem', color: goldColor, opacity: 0.6 }}
                  >
                    STEP {String(step.step).padStart(2, '0')} · {step.duration}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.95rem' }}>
                    {step.titleKo}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.65 }}>
                    {step.descriptionKo}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ===== BENEFITS BANNER ===== */}
      <Box
        component="section"
        sx={{
          py: { xs: 6, md: 8 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&q=75)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <Box sx={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.88)' }} />

        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Grid container spacing={0}>
            {benefits.map((stat, i) => (
              <Grid size={{ xs: 6, md: 3 }} key={stat.labelEn}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: { xs: 3, md: 4 },
                    px: 2,
                    borderRight: { md: i < 3 ? '1px solid rgba(201,168,76,0.15)' : 'none' },
                    borderBottom: { xs: i < 2 ? '1px solid rgba(201,168,76,0.15)' : 'none', md: 'none' },
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Montserrat", sans-serif',
                      fontWeight: 900,
                      fontSize: { xs: '1.6rem', md: '2.4rem' },
                      color: COLORS.GOLD_LIGHT,
                      lineHeight: 1,
                      mb: 0.5,
                      textShadow: `0 0 30px rgba(201,168,76,0.5)`,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: '0.85rem', mb: 0.25 }}>
                    {stat.labelKo}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    {stat.labelEn}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ===== TECHNOLOGY HIGHLIGHT SECTION ===== */}
      <Box
        component="section"
        sx={{
          py: { xs: 8, md: 14 },
          position: 'relative',
        }}
      >
        <Container maxWidth="md">
          <Box
            sx={{
              textAlign: 'center',
              p: { xs: 4, md: 6 },
              background: isDark
                ? `linear-gradient(135deg, rgba(201,168,76,0.04) 0%, ${COLORS.BG_ELEVATED} 100%)`
                : `linear-gradient(135deg, rgba(201,168,76,0.06) 0%, #ffffff 100%)`,
              border: isDark ? `1px solid rgba(201,168,76,0.2)` : `1px solid rgba(158,127,48,0.2)`,
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Corner accents */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 60,
                height: 60,
                borderTop: `2px solid ${goldColor}`,
                borderLeft: `2px solid ${goldColor}`,
                borderTopLeftRadius: 16,
                opacity: 0.5,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 60,
                height: 60,
                borderBottom: `2px solid ${goldColor}`,
                borderRight: `2px solid ${goldColor}`,
                borderBottomRightRadius: 16,
                opacity: 0.5,
              }}
            />

            <Chip
              icon={<VerifiedIcon sx={{ color: `${goldColor} !important` }} />}
              label="PATENT PENDING · 특허 출원"
              sx={{
                bgcolor: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.12)',
                border: `1px solid ${goldColor}40`,
                color: goldColor,
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                mb: 4,
              }}
            />

            <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, fontSize: { xs: '1.4rem', md: '2rem' } }}>
              세계 최초 AI 자율이송
              <br />
              <Box component="span" sx={{ color: goldColor }}>발렛 주차 시스템</Box>
            </Typography>

            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 4, maxWidth: 520, mx: 'auto', fontSize: '0.95rem' }}
            >
              단순히 건물 앞에 차를 세워주는 기존 발렛을 넘어, AI 자율이송로봇이 각 세대의 전용 스카이게러지까지
              차량을 직접 배송하는 <strong>세계 유일의 특허 기술</strong>입니다.
              주차 탐색 시간 제로, 24시간 무인 운영, 앱 기반 예약 출차까지 — 주거 혁신의 새로운 기준.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['AI Autonomous', 'Patent Filed', 'Door-to-Garage', '24/7 Unmanned', 'App Controlled'].map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    bgcolor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)',
                    border: `1px solid ${COLORS.TECH_BLUE}30`,
                    color: COLORS.TECH_BLUE,
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    letterSpacing: '0.03em',
                  }}
                />
              ))}
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
