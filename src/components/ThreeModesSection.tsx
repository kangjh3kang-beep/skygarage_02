import { useIntersection } from '../hooks/useIntersection';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import ApartmentIcon from '@mui/icons-material/Apartment';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import VerifiedIcon from '@mui/icons-material/Verified';
import BadgeImageZone from './BadgeImageZone';
import { useSiteImages } from '../hooks/useSiteImages';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(201,168,76,0.2), 0 0 40px rgba(201,168,76,0.05); }
  50% { box-shadow: 0 0 30px rgba(201,168,76,0.4), 0 0 60px rgba(201,168,76,0.15); }
`;

const floatUp = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

interface ModeCardProps {
  id: string;
  index: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  specs: { icon: React.ReactNode; label: string }[];
  situations: string[];
  visible: boolean;
  isDark: boolean;
  getImageUrl: (slot: string, fallback: string) => string;
  refetch: () => void;
}

function ModeCard({ id, index, icon, title, subtitle, description, accentColor, specs, situations, visible, isDark, getImageUrl, refetch }: ModeCardProps) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 4,
        background: isDark
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(255,255,255,0.8)',
        border: isDark
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(0,0,0,0.06)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `all 0.7s ${0.2 + index * 0.15}s ease`,
        '&:hover': {
          transform: visible ? 'translateY(-8px)' : 'translateY(30px)',
          border: `1px solid ${accentColor}50`,
          background: isDark
            ? `rgba(${accentColor === COLORS.GOLD ? '201,168,76' : accentColor === COLORS.TECH_BLUE ? '59,130,246' : '16,185,129'},0.04)`
            : `rgba(${accentColor === COLORS.GOLD ? '201,168,76' : accentColor === COLORS.TECH_BLUE ? '59,130,246' : '16,185,129'},0.04)`,
          boxShadow: isDark
            ? `0 20px 60px rgba(0,0,0,0.4), 0 0 30px ${accentColor}15`
            : `0 20px 60px rgba(0,0,0,0.08), 0 0 20px ${accentColor}10`,
        },
      }}
    >
      {/* Top image zone */}
      <BadgeImageZone
        slot={`mode-${id}`}
        position="top"
        imageUrl={getImageUrl(`mode-${id}-top`, '')}
        onImageChange={refetch}
        height={{ xs: 56, sm: 64, md: 72 }}
      />

      <Box sx={{ p: { xs: 3, md: 3.5 } }}>
      {/* Mode number */}
      <Typography
        sx={{
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: 900,
          fontSize: '0.7rem',
          color: accentColor,
          letterSpacing: '0.15em',
          mb: 2,
        }}
      >
        MODE 0{index + 1}
      </Typography>

      {/* Icon */}
      <Box
        sx={{
          width: 60,
          height: 60,
          borderRadius: 2.5,
          background: isDark ? `${accentColor}15` : `${accentColor}12`,
          border: `1px solid ${accentColor}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2.5,
        }}
      >
        {icon}
      </Box>

      {/* Title */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: 800,
          fontSize: { xs: '1.2rem', md: '1.35rem' },
          mb: 0.5,
        }}
      >
        {title}
      </Typography>

      {/* Subtitle */}
      <Typography
        variant="caption"
        sx={{
          color: accentColor,
          fontSize: '0.72rem',
          letterSpacing: '0.05em',
          fontWeight: 700,
          display: 'block',
          mb: 2,
        }}
      >
        {subtitle}
      </Typography>

      {/* Description */}
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          fontSize: '0.85rem',
          lineHeight: 1.7,
          mb: 3,
          minHeight: { md: 60 },
        }}
      >
        {description}
      </Typography>

      {/* Specs */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
        {specs.map((spec) => (
          <Box key={spec.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: accentColor, display: 'flex', alignItems: 'center' }}>
              {spec.icon}
            </Box>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
              {spec.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Recommended situations */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {situations.map((s) => (
          <Chip
            key={s}
            label={s}
            size="small"
            sx={{
              fontSize: '0.68rem',
              height: 24,
              bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
              color: 'text.secondary',
            }}
          />
        ))}
      </Box>
      </Box>

      {/* Bottom image zone */}
      <BadgeImageZone
        slot={`mode-${id}`}
        position="bottom"
        imageUrl={getImageUrl(`mode-${id}-bottom`, '')}
        onImageChange={refetch}
        height={{ xs: 48, sm: 56, md: 64 }}
      />
    </Box>
  );
}

export default function ThreeModesSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { getImageUrl, refetch } = useSiteImages();

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const sectionBg = isDark
    ? `linear-gradient(180deg, ${COLORS.BG_PRIMARY} 0%, ${COLORS.BG_SECONDARY} 100%)`
    : `linear-gradient(180deg, ${COLORS.LIGHT_BG_PRIMARY} 0%, #ffffff 100%)`;

  const modes: Omit<ModeCardProps, 'visible' | 'isDark' | 'getImageUrl' | 'refetch'>[] = [
    {
      id: 'direct',
      index: 0,
      icon: <ApartmentIcon sx={{ fontSize: 30, color: COLORS.GOLD }} />,
      title: '세대직입',
      subtitle: 'Direct Unit Access',
      description: '거실 옆 전용 차고에서 바로 탑승. ATR이 차량을 각 세대 현관 앞까지 자동 이송합니다. 지하주차장을 걸어갈 필요가 없습니다.',
      accentColor: isDark ? COLORS.GOLD : COLORS.GOLD_DARK,
      specs: [
        { icon: <AccessTimeIcon sx={{ fontSize: 16 }} />, label: '도보 0m · 대기 0~30초' },
        { icon: <TouchAppIcon sx={{ fontSize: 16 }} />, label: '1탭 호출 · 완전 자동' },
        { icon: <VerifiedIcon sx={{ fontSize: 16 }} />, label: '유리 도어 · 방진방음' },
      ],
      situations: ['노부모님 외출', '악천후', '짐 많은 날', '휠체어 사용'],
    },
    {
      id: 'valet',
      index: 1,
      icon: <SmartToyIcon sx={{ fontSize: 30, color: COLORS.TECH_BLUE }} />,
      title: '자율 ATR 발렛',
      subtitle: 'Autonomous Valet',
      description: 'ATR 자율이송로봇이 24시간 무인으로 차량을 픽업하고 배치합니다. 출근길 1탭 호출이면 차가 당신에게 옵니다.',
      accentColor: COLORS.TECH_BLUE,
      specs: [
        { icon: <AccessTimeIcon sx={{ fontSize: 16 }} />, label: '1탭 호출 · 4~8분 도착' },
        { icon: <TouchAppIcon sx={{ fontSize: 16 }} />, label: '24h 무인 · 자동 결제' },
        { icon: <VerifiedIcon sx={{ fontSize: 16 }} />, label: '차체 회전 ±90° · 정밀 배치' },
      ],
      situations: ['출퇴근 피크', '심야 귀가', '게스트 방문', '여행 출발'],
    },
    {
      id: 'selfpark',
      index: 2,
      icon: <DirectionsCarIcon sx={{ fontSize: 30, color: '#10b981' }} />,
      title: '자가주차',
      subtitle: 'Self-Park Mode',
      description: '직접 운전의 즐거움을 보존합니다. 스마트 LED 가이드가 빈자리까지 안내하고, 결제는 자동으로 처리됩니다.',
      accentColor: '#10b981',
      specs: [
        { icon: <AccessTimeIcon sx={{ fontSize: 16 }} />, label: 'LED 자동 안내 · 빈 자리 실시간' },
        { icon: <TouchAppIcon sx={{ fontSize: 16 }} />, label: '결제 자동 · EV 충전 지원' },
        { icon: <VerifiedIcon sx={{ fontSize: 16 }} />, label: '기존 방식 100% 호환' },
      ],
      situations: ['주말 드라이브', '신차 자랑', '운전 좋아하는 날'],
    },
  ];

  return (
    <Box
      id="three-modes"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg" ref={ref}>
        {/* Section header */}
        <Box
          sx={{
            textAlign: 'center',
            mb: { xs: 3, md: 4 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s ease',
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: goldColor, letterSpacing: '0.2em', fontSize: '0.7rem', mb: 2, display: 'block' }}
          >
            AI INTEGRATED PARKING MODES
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' },
              fontWeight: 800,
              mb: 2,
            }}
          >
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${COLORS.GOLD_DARK} 0%, ${goldColor} 40%, ${goldLight} 70%, ${goldColor} 100%)`,
                backgroundSize: '300% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: `${shimmer} 5s linear infinite`,
              }}
            >
              3 모드
            </Box>
            , 하나의 AI
            <br />
            당신은 그저 선택하면 됩니다
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 620,
              mx: 'auto',
              fontSize: { xs: '0.88rem', md: '1rem' },
              lineHeight: 1.8,
            }}
          >
            매일 다른 상황, 다른 가족, 다른 라이프스타일에 맞춰
            <br />
            AI가 최적 모드를 자동 추천하거나 직접 선택할 수 있습니다
          </Typography>
        </Box>

        {/* AI Recommendation badge */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: { xs: 4, md: 6 },
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.15s ease',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 3,
              py: 1.5,
              borderRadius: 10,
              background: isDark ? 'rgba(201,168,76,0.06)' : 'rgba(201,168,76,0.06)',
              border: `1px solid ${isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.2)'}`,
              backdropFilter: 'blur(12px)',
              animation: `${pulseGlow} 4s ease-in-out infinite`,
            }}
          >
            <PsychologyIcon sx={{ fontSize: 22, color: goldColor, animation: `${floatUp} 3s ease-in-out infinite` }} />
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, color: goldColor, fontSize: '0.75rem', letterSpacing: '0.05em', display: 'block' }}
              >
                AI 자동 추천 엔진
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                시간대 · 날씨 · 가족 구성 · 선호도 종합 분석
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 3 Mode Cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: { xs: 3, md: 3 },
            mb: { xs: 5, md: 7 },
          }}
        >
          {modes.map((mode) => (
            <ModeCard key={mode.title} {...mode} visible={visible} isDark={isDark} getImageUrl={getImageUrl} refetch={refetch} />
          ))}
        </Box>

        {/* Bottom connector - mode switching visualization */}
        <Box
          sx={{
            textAlign: 'center',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.7s 0.6s ease',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              px: 4,
              py: 2,
              borderRadius: 3,
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isDark ? COLORS.GOLD : COLORS.GOLD_DARK }} />
            <Box sx={{ width: 40, height: 1, bgcolor: 'divider' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.TECH_BLUE }} />
            <Box sx={{ width: 40, height: 1, bgcolor: 'divider' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
            <Box sx={{ ml: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                상황에 따라 자유롭게 전환
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                AI가 학습하여 자동 추천 · 수용률 87%
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
