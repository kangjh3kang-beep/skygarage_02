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
import { useIntersection } from '../hooks/useIntersection';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import BusinessIcon from '@mui/icons-material/Business';
import VillaIcon from '@mui/icons-material/Villa';
import ApartmentIcon from '@mui/icons-material/Apartment';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import HotelIcon from '@mui/icons-material/Hotel';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SchoolIcon from '@mui/icons-material/School';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import SavingsIcon from '@mui/icons-material/Savings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VerifiedIcon from '@mui/icons-material/Verified';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

interface MarketSector {
  icon: React.ReactNode;
  titleKo: string;
  titleEn: string;
  color: string;
}

interface BenefitItem {
  icon: React.ReactNode;
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
}

const marketSectors: MarketSector[] = [
  { icon: <LocalHospitalIcon sx={{ fontSize: 36 }} />, titleKo: '병의원', titleEn: 'Hospitals & Clinics', color: '#ef4444' },
  { icon: <BusinessIcon sx={{ fontSize: 36 }} />, titleKo: '오피스 빌딩', titleEn: 'Office Buildings', color: COLORS.TECH_BLUE },
  { icon: <VillaIcon sx={{ fontSize: 36 }} />, titleKo: '타운하우스', titleEn: 'Town Houses', color: '#10b981' },
  { icon: <ApartmentIcon sx={{ fontSize: 36 }} />, titleKo: '주거 복합단지', titleEn: 'Residential Complexes', color: COLORS.GOLD },
  { icon: <StorefrontIcon sx={{ fontSize: 36 }} />, titleKo: '상업시설', titleEn: 'Commercial Facilities', color: '#f59e0b' },
  { icon: <AccountBalanceIcon sx={{ fontSize: 36 }} />, titleKo: '공공기관', titleEn: 'Public Institutions', color: '#6366f1' },
  { icon: <HotelIcon sx={{ fontSize: 36 }} />, titleKo: '호텔', titleEn: 'Hotels', color: '#ec4899' },
  { icon: <ShoppingCartIcon sx={{ fontSize: 36 }} />, titleKo: '쇼핑몰', titleEn: 'Shopping Malls', color: '#14b8a6' },
  { icon: <LocalShippingIcon sx={{ fontSize: 36 }} />, titleKo: '물류센터', titleEn: 'Logistics Centers', color: '#f97316' },
  { icon: <SchoolIcon sx={{ fontSize: 36 }} />, titleKo: '학교/교육시설', titleEn: 'Schools & Education', color: '#8b5cf6' },
  { icon: <LocationCityIcon sx={{ fontSize: 36 }} />, titleKo: '스마트시티', titleEn: 'Smart Cities', color: '#06b6d4' },
  { icon: <MoreHorizIcon sx={{ fontSize: 36 }} />, titleKo: '그 외 다양한 시설', titleEn: 'And Many More', color: COLORS.SILVER },
];

const benefits: BenefitItem[] = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 40 }} />,
    titleKo: 'AI 자율주행 기술',
    titleEn: 'AI Autonomous Driving',
    descriptionKo: '세계 최초 특허 ATR(자율운반로봇) 기술로 완전 무인 주차를 실현합니다.',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 40 }} />,
    titleKo: '시간 효율 극대화',
    titleEn: 'Maximum Time Efficiency',
    descriptionKo: '평균 주차 시간 12분을 3분으로 단축. 하루 30분의 시간을 절약합니다.',
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 40 }} />,
    titleKo: '안전 및 보안',
    titleEn: 'Safety & Security',
    descriptionKo: '24시간 AI 모니터링, 차량 손상 제로, 야간 안전 동선을 보장합니다.',
  },
  {
    icon: <SavingsIcon sx={{ fontSize: 40 }} />,
    titleKo: '공간 효율 30% 증가',
    titleEn: '30% Space Efficiency',
    descriptionKo: '기존 주차장 대비 30% 이상 추가 주차면 확보로 공간 가치를 극대화합니다.',
  },
  {
    icon: <AutoAwesomeIcon sx={{ fontSize: 40 }} />,
    titleKo: '프리미엄 가치 창출',
    titleEn: 'Premium Value Creation',
    descriptionKo: '분양가 5~8% 프리미엄, 건물 가치 10% 상승 효과를 제공합니다.',
  },
  {
    icon: <DirectionsCarIcon sx={{ fontSize: 40 }} />,
    titleKo: 'EV 충전 통합',
    titleEn: 'Integrated EV Charging',
    descriptionKo: '주차와 동시에 전기차 자동 충전. 미래 모빌리티 인프라를 선도합니다.',
  },
];

export default function PalatriaLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { ref: marketsRef, visible: marketsVisible } = useIntersection();
  const { ref: benefitsRef, visible: benefitsVisible } = useIntersection();
  const { ref: ctaRef, visible: ctaVisible } = useIntersection();

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.alpha})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <Box component="main">
      {/* HERO SECTION */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 'calc(var(--vh, 1vh) * 100)', md: 'calc(var(--vh, 1vh) * 100)' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: isDark
            ? `radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.08) 0%, transparent 60%), linear-gradient(180deg, ${COLORS.BG_PRIMARY} 0%, ${COLORS.BG_SECONDARY} 100%)`
            : `radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.06) 0%, transparent 60%), linear-gradient(180deg, #f8f6f0 0%, #ede8da 100%)`,
        }}
      >
        <Box
          component="canvas"
          ref={canvasRef}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Decorative rings */}
        <Box
          sx={{
            position: 'absolute',
            width: { xs: 300, md: 500 },
            height: { xs: 300, md: 500 },
            borderRadius: '50%',
            border: `1px solid ${isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.08)'}`,
            animation: `${pulse} 4s ease-in-out infinite`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: { xs: 450, md: 700 },
            height: { xs: 450, md: 700 },
            borderRadius: '50%',
            border: `1px solid ${isDark ? 'rgba(201,168,76,0.05)' : 'rgba(158,127,48,0.04)'}`,
            animation: `${pulse} 5s ease-in-out infinite 1s`,
          }}
        />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* SkyGarage parent brand */}
          <Chip
            icon={<VerifiedIcon sx={{ fontSize: 16 }} />}
            label="by SkyGarage"
            sx={{
              mb: 3,
              background: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.08)',
              border: `1px solid ${isDark ? 'rgba(201,168,76,0.25)' : 'rgba(158,127,48,0.2)'}`,
              color: goldColor,
              fontWeight: 700,
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
            }}
          />

          {/* PALATRIA brand name */}
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '3rem', sm: '4rem', md: '5.5rem' },
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              mb: 1,
              background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 30%, ${goldColor} 60%, ${goldLight} 100%)`,
              backgroundSize: '300% auto',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: `${shimmer} 6s linear infinite`,
            }}
          >
            PALATRIA
          </Typography>

          {/* Korean brand name */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.2rem', sm: '1.5rem', md: '1.8rem' },
              color: goldColor,
              letterSpacing: '0.15em',
              mb: 4,
            }}
          >
            팔라트리아
          </Typography>

          {/* Tagline */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '1rem', sm: '1.2rem', md: '1.5rem' },
              color: 'text.primary',
              mb: 2,
              lineHeight: 1.5,
            }}
          >
            SkyGarage의 플래그십 스마트 주차 브랜드
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.9rem', md: '1.05rem' },
              maxWidth: 600,
              mx: 'auto',
              mb: 5,
              lineHeight: 1.8,
            }}
          >
            세계 최초 특허 AI 자율운반로봇(ATR) 기술 기반의 완전 자동 발렛 주차 시스템.
            <br />
            병원부터 스마트시티까지 — 어디서나 적용 가능한 무한 확장 솔루션.
          </Typography>

          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{ px: 5, py: 1.8, fontSize: '1rem' }}
            href="#markets"
          >
            적용 시장 알아보기
          </Button>
        </Container>
      </Box>

      {/* BRAND INTRODUCTION SECTION */}
      <Box
        sx={{
          py: { xs: 5, md: 8 },
          background: isDark
            ? `linear-gradient(180deg, ${COLORS.BG_SECONDARY} 0%, ${COLORS.BG_PRIMARY} 100%)`
            : `linear-gradient(180deg, #ede8da 0%, #f8f6f0 100%)`,
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Chip
            label="FLAGSHIP BRAND"
            sx={{
              mb: 3,
              background: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(158,127,48,0.06)',
              color: goldColor,
              fontWeight: 700,
              fontSize: '0.7rem',
              letterSpacing: '0.15em',
            }}
          />
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              mb: 3,
            }}
          >
            PALATRIA는{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor}, ${goldLight})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              무한 확장
            </Box>
            이 가능합니다
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 700,
              mx: 'auto',
              lineHeight: 1.9,
              fontSize: { xs: '0.9rem', md: '1rem' },
            }}
          >
            기존 스마트 주차 솔루션이 아파트·오피스텔 등 일부 시장에 국한되었다면,
            PALATRIA는 ATR 기술의 모듈화·표준화를 통해 병원, 호텔, 쇼핑몰, 물류센터,
            공공시설 등 <strong>규모와 용도에 관계없이</strong> 어떤 건물에도 적용할 수 있습니다.
          </Typography>
        </Container>
      </Box>

      {/* APPLICATION MARKETS SECTION */}
      <Box
        id="markets"
        component="section"
        sx={{
          py: { xs: 5, md: 8 },
          background: isDark
            ? `linear-gradient(180deg, ${COLORS.BG_PRIMARY} 0%, ${COLORS.BG_SECONDARY} 50%, ${COLORS.BG_PRIMARY} 100%)`
            : `linear-gradient(180deg, #f8f6f0 0%, #ffffff 50%, #f8f6f0 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(circle at 15% 30%, rgba(201,168,76,0.04) 0%, transparent 35%),
              radial-gradient(circle at 85% 70%, rgba(59,130,246,0.03) 0%, transparent 35%)
            `,
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="lg" ref={marketsRef}>
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
            <Typography
              variant="overline"
              sx={{
                color: goldColor,
                letterSpacing: '0.2em',
                fontSize: '0.7rem',
                mb: 2,
                display: 'block',
                opacity: marketsVisible ? 1 : 0,
                transition: 'opacity 0.6s ease',
              }}
            >
              APPLICATION MARKETS
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.8rem' },
                mb: 2,
                opacity: marketsVisible ? 1 : 0,
                transform: marketsVisible ? 'none' : 'translateY(20px)',
                transition: 'all 0.6s 0.1s ease',
              }}
            >
              어디서나 적용 가능한{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${goldColor}, ${goldLight})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                스마트 주차 솔루션
              </Box>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                maxWidth: 600,
                mx: 'auto',
                opacity: marketsVisible ? 1 : 0,
                transform: marketsVisible ? 'none' : 'translateY(20px)',
                transition: 'all 0.6s 0.2s ease',
              }}
            >
              무한한 적용 가능성. PALATRIA는 주차가 필요한 모든 곳에 설치됩니다.
            </Typography>
          </Box>

          {/* Market sector cards grid */}
          <Grid container spacing={3}>
            {marketSectors.map((sector, i) => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={sector.titleEn}>
                <Card
                  sx={{
                    height: '100%',
                    textAlign: 'center',
                    background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.05)'
                      : '1px solid rgba(0,0,0,0.06)',
                    cursor: 'default',
                    opacity: marketsVisible ? 1 : 0,
                    transform: marketsVisible ? 'none' : 'translateY(30px)',
                    transition: `all 0.5s ${0.1 + i * 0.05}s ease`,
                    '&:hover': {
                      border: `1px solid ${sector.color}50`,
                      transform: 'translateY(-8px)',
                      boxShadow: `0 12px 40px ${sector.color}20`,
                      '& .sector-icon': {
                        animation: `${float} 2s ease-in-out infinite`,
                        background: `${sector.color}18`,
                        borderColor: `${sector.color}40`,
                      },
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Box
                      className="sector-icon"
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        mx: 'auto',
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: sector.color,
                        background: isDark ? `${sector.color}10` : `${sector.color}08`,
                        border: `1px solid ${sector.color}20`,
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {sector.icon}
                    </Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: '0.85rem', md: '0.95rem' },
                        mb: 0.5,
                      }}
                    >
                      {sector.titleKo}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: sector.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {sector.titleEn}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Expansion message */}
          <Box
            sx={{
              mt: { xs: 4, md: 6 },
              textAlign: 'center',
              opacity: marketsVisible ? 1 : 0,
              transition: 'opacity 0.6s 0.8s ease',
            }}
          >
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
              label="주차가 필요한 모든 곳, PALATRIA가 답합니다"
              sx={{
                background: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(158,127,48,0.06)',
                border: `1px solid ${isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.15)'}`,
                color: goldColor,
                fontWeight: 600,
                fontSize: '0.8rem',
                py: 2.5,
                px: 1,
              }}
            />
          </Box>
        </Container>
      </Box>

      {/* BENEFITS SECTION */}
      <Box
        component="section"
        sx={{
          py: { xs: 5, md: 8 },
          background: isDark
            ? `linear-gradient(180deg, ${COLORS.BG_PRIMARY} 0%, ${COLORS.BG_SECONDARY} 100%)`
            : `linear-gradient(180deg, #f8f6f0 0%, #ede8da 100%)`,
        }}
      >
        <Container maxWidth="lg" ref={benefitsRef}>
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
            <Typography
              variant="overline"
              sx={{
                color: goldColor,
                letterSpacing: '0.2em',
                fontSize: '0.7rem',
                mb: 2,
                display: 'block',
                opacity: benefitsVisible ? 1 : 0,
                transition: 'opacity 0.6s ease',
              }}
            >
              KEY BENEFITS
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.8rem' },
                mb: 2,
                opacity: benefitsVisible ? 1 : 0,
                transform: benefitsVisible ? 'none' : 'translateY(20px)',
                transition: 'all 0.6s 0.1s ease',
              }}
            >
              PALATRIA가 제공하는{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${goldColor}, ${goldLight})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                핵심 가치
              </Box>
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {benefits.map((benefit, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={benefit.titleEn}>
                <Card
                  sx={{
                    height: '100%',
                    background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.05)'
                      : '1px solid rgba(0,0,0,0.06)',
                    opacity: benefitsVisible ? 1 : 0,
                    transform: benefitsVisible ? 'none' : 'translateY(30px)',
                    transition: `all 0.5s ${0.15 + i * 0.08}s ease`,
                    '&:hover': {
                      border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(158,127,48,0.25)'}`,
                      transform: 'translateY(-4px)',
                      boxShadow: isDark
                        ? '0 16px 48px rgba(0,0,0,0.4)'
                        : '0 12px 36px rgba(0,0,0,0.1)',
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        mb: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: goldColor,
                        background: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(158,127,48,0.06)',
                        border: `1px solid ${isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.15)'}`,
                      }}
                    >
                      {benefit.icon}
                    </Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        mb: 0.5,
                      }}
                    >
                      {benefit.titleKo}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: goldColor,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        letterSpacing: '0.03em',
                        display: 'block',
                        mb: 1.5,
                      }}
                    >
                      {benefit.titleEn}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        lineHeight: 1.7,
                        fontSize: '0.83rem',
                      }}
                    >
                      {benefit.descriptionKo}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA SECTION */}
      <Box
        component="section"
        ref={ctaRef}
        sx={{
          py: { xs: 5, md: 8 },
          position: 'relative',
          overflow: 'hidden',
          background: isDark
            ? `linear-gradient(180deg, ${COLORS.BG_SECONDARY} 0%, ${COLORS.BG_PRIMARY} 100%)`
            : `linear-gradient(180deg, #ede8da 0%, #f8f6f0 100%)`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 50%)
            `,
            pointerEvents: 'none',
          }}
        />
        <Container
          maxWidth="sm"
          sx={{
            position: 'relative',
            textAlign: 'center',
            opacity: ctaVisible ? 1 : 0,
            transform: ctaVisible ? 'none' : 'translateY(30px)',
            transition: 'all 0.6s ease',
          }}
        >
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.2rem' },
              fontWeight: 800,
              mb: 2,
            }}
          >
            PALATRIA 도입을 검토하고 계신가요?
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              mb: 4,
              lineHeight: 1.8,
            }}
          >
            건물 유형, 규모, 용도에 관계없이 맞춤형 솔루션을 제안해 드립니다.
            <br />
            전문 컨설턴트와 상담을 시작하세요.
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{ px: 5, py: 1.8, fontSize: '1rem', mb: 3 }}
            href="#contact"
          >
            무료 상담 신청
          </Button>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'text.secondary',
              fontSize: '0.75rem',
            }}
          >
            Wherever parking is needed, PALATRIA delivers.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
