import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import { useSiteImages } from '../hooks/useSiteImages';
import BadgeImageZone from './BadgeImageZone';

import SmartToyIcon from '@mui/icons-material/SmartToy';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import SavingsIcon from '@mui/icons-material/Savings';
import EvStationIcon from '@mui/icons-material/EvStation';
import HomeIcon from '@mui/icons-material/Home';
import GroupsIcon from '@mui/icons-material/Groups';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VerifiedIcon from '@mui/icons-material/Verified';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import RemoveIcon from '@mui/icons-material/Remove';

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(201,168,76,0.15); }
  50% { box-shadow: 0 0 40px rgba(201,168,76,0.35), 0 0 80px rgba(201,168,76,0.1); }
`;

interface ComparisonRow {
  label: string;
  icon: React.ReactNode;
  mechanical: { value: string; status: 'bad' | 'neutral' | 'good' };
  valet: { value: string; status: 'bad' | 'neutral' | 'good' };
  skygarage: { value: string; status: 'best' };
}

const comparisonData: ComparisonRow[] = [
  {
    label: '운영 방식',
    icon: <SmartToyIcon fontSize="small" />,
    mechanical: { value: '무인 기계 (단일 동작)', status: 'neutral' },
    valet: { value: '사람 16~22명 교대', status: 'bad' },
    skygarage: { value: 'AI 자율주행 + ATR 로봇', status: 'best' },
  },
  {
    label: '운영 시간',
    icon: <AccessTimeIcon fontSize="small" />,
    mechanical: { value: '24h (고장 시 전체 정지)', status: 'neutral' },
    valet: { value: '한정 (06~24시)', status: 'bad' },
    skygarage: { value: '24h 365일 무중단', status: 'best' },
  },
  {
    label: '세대 직입',
    icon: <HomeIcon fontSize="small" />,
    mechanical: { value: '불가', status: 'bad' },
    valet: { value: '불가', status: 'bad' },
    skygarage: { value: '거실 옆 전시 차고 직입', status: 'best' },
  },
  {
    label: '차량 손상 추적',
    icon: <SecurityIcon fontSize="small" />,
    mechanical: { value: '보험 분쟁 빈번', status: 'bad' },
    valet: { value: '책임 시비 연 8건', status: 'bad' },
    skygarage: { value: 'Attestation 100% 추적', status: 'best' },
  },
  {
    label: '평균 대기시간',
    icon: <SpeedIcon fontSize="small" />,
    mechanical: { value: '5~8분 (단일 큐)', status: 'bad' },
    valet: { value: '10분+ (인력 한정)', status: 'bad' },
    skygarage: { value: '1~4분 (AI 사전호출)', status: 'best' },
  },
  {
    label: '모드 선택권',
    icon: <VerifiedIcon fontSize="small" />,
    mechanical: { value: '없음 (단일)', status: 'bad' },
    valet: { value: '없음 (사람만)', status: 'bad' },
    skygarage: { value: '3 모드 자유 선택', status: 'best' },
  },
  {
    label: '운영 인건비',
    icon: <SavingsIcon fontSize="small" />,
    mechanical: { value: '관리 1~2명', status: 'good' },
    valet: { value: '22명 / 연 12억원', status: 'bad' },
    skygarage: { value: '8명 / 연 70% 절감', status: 'best' },
  },
  {
    label: 'EV 충전 통합',
    icon: <EvStationIcon fontSize="small" />,
    mechanical: { value: '불가', status: 'bad' },
    valet: { value: '불가', status: 'bad' },
    skygarage: { value: '무선 충전 도크 통합', status: 'best' },
  },
  {
    label: '고장 대처',
    icon: <WarningAmberIcon fontSize="small" />,
    mechanical: { value: '전체 정지 (단일 점 장애)', status: 'bad' },
    valet: { value: '인력 충원 한계', status: 'neutral' },
    skygarage: { value: '다 ATR 격리 자동 전환', status: 'best' },
  },
  {
    label: '노약자 동선',
    icon: <GroupsIcon fontSize="small" />,
    mechanical: { value: '지하 도보 200m+', status: 'bad' },
    valet: { value: '현관 50m', status: 'neutral' },
    skygarage: { value: '도보 0m (거실 직입)', status: 'best' },
  },
];

interface ScenarioItem {
  title: string;
  subtitle: string;
  mechanical: string;
  valet: string;
  skygarage: string;
  mechanicalTime: string;
  valetTime: string;
  skygarageTime: string;
}

const scenarios: ScenarioItem[] = [
  {
    title: '비 오는 출근길',
    subtitle: '일상의 차이가 만드는 삶의 질',
    mechanical: '우산 쓰고 지하 → 기계 단말기 → 5~8분 대기',
    valet: '발렛 호출 → 10분 대기 → 키 인수',
    skygarage: 'AI 자동 감지 → 거실 옆 차고에서 바로 출발',
    mechanicalTime: '15분',
    valetTime: '18분',
    skygarageTime: '5분',
  },
  {
    title: '70대 어머니의 외출',
    subtitle: '도보 거리가 안전을 결정합니다',
    mechanical: '200m 지하 도보 (사고 위험 높음)',
    valet: '현관 50m 이동 (도움 한정)',
    skygarage: '거실 옆에서 바로 탑승 (도보 0m)',
    mechanicalTime: '도보 200m',
    valetTime: '도보 50m',
    skygarageTime: '도보 0m',
  },
  {
    title: '새벽 3시 응급 외출',
    subtitle: 'AI는 쉬지 않습니다',
    mechanical: '기계 야간 오류 → 호출 불가 가능',
    valet: '미운영 또는 대기 30분',
    skygarage: '즉시 ATR 자율 출동, 3분 내 도착',
    mechanicalTime: '불가~8분',
    valetTime: '30분+',
    skygarageTime: '3분',
  },
];

function StatusIcon({ status }: { status: 'bad' | 'neutral' | 'good' | 'best' }) {
  if (status === 'best') return <StarIcon sx={{ fontSize: 16, color: COLORS.GOLD_LIGHT }} />;
  if (status === 'good') return <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} />;
  if (status === 'neutral') return <RemoveIcon sx={{ fontSize: 16, color: '#f59e0b' }} />;
  return <CloseIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
}

export default function ComparisonSection() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { ref: headerRef, visible: headerVisible } = useIntersection();
  const { ref: tableRef, visible: tableVisible } = useIntersection();
  const { ref: scenarioRef, visible: scenarioVisible } = useIntersection();
  const { getImageUrl, refetch } = useSiteImages();

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  return (
    <Box
      id="comparison"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? `linear-gradient(180deg, ${COLORS.BG_PRIMARY} 0%, ${COLORS.BG_SECONDARY} 50%, ${COLORS.BG_PRIMARY} 100%)`
          : `linear-gradient(180deg, #f8f6f0 0%, #ffffff 50%, #f8f6f0 100%)`,
      }}
    >
      {/* Background decoration */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(201,168,76,0.04) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(59,130,246,0.02) 0%, transparent 40%)
          `,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Section header */}
        <Box ref={headerRef} sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
          <Typography
            variant="overline"
            sx={{
              color: goldColor,
              letterSpacing: '0.2em',
              fontSize: '0.7rem',
              mb: 2,
              display: 'block',
              opacity: headerVisible ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          >
            WHY SKYGARAGE
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.8rem' },
              fontWeight: 800,
              mb: 2,
              opacity: headerVisible ? 1 : 0,
              transform: headerVisible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.1s ease',
            }}
          >
            같은 차고가 아닙니다.{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor}, ${goldLight})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              같은 시대가 아닙니다.
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 700,
              mx: 'auto',
              lineHeight: 1.8,
              opacity: headerVisible ? 1 : 0,
              transform: headerVisible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.2s ease',
            }}
          >
            기계식 주차는 차량을 운반하지만, SkyGarage는 사람의 일상을 회복합니다.
            <br />
            기존 발렛은 사람이 운전하지만, SkyGarage는 AI가 학습합니다.
          </Typography>
        </Box>

        {/* Three system headers */}
        <Box ref={tableRef}>
          {/* System identity cards */}
          <Grid
            container
            spacing={2}
            sx={{
              mb: 4,
              opacity: tableVisible ? 1 : 0,
              transform: tableVisible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s ease',
            }}
          >
            {/* Mechanical */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  background: isDark ? 'rgba(30,30,40,0.7)' : 'rgba(245,245,245,0.9)',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(239,68,68,0.25)',
                    boxShadow: '0 8px 32px rgba(239,68,68,0.1)',
                  },
                }}
              >
                <BadgeImageZone
                  slot="comparison-mechanical"
                  position="top"
                  imageUrl={getImageUrl('comparison-mechanical-top', '')}
                  onImageChange={refetch}
                  height={{ xs: 80, sm: 100, md: 120 }}
                />
                <CardContent sx={{ textAlign: 'center', py: { xs: 3, md: 4 } }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      mx: 'auto',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}
                  >
                    <PrecisionManufacturingIcon sx={{ fontSize: 28, color: '#ef4444' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>
                    기계식 주차
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                    회전식 / 퍼즐식 / 엘리베이터식
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="단일 점 장애" size="small" sx={{ fontSize: '0.65rem', height: 22, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }} />
                    <Chip label="소음·진동" size="small" sx={{ fontSize: '0.65rem', height: 22, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }} />
                  </Box>
                </CardContent>
                <BadgeImageZone
                  slot="comparison-mechanical"
                  position="bottom"
                  imageUrl={getImageUrl('comparison-mechanical-bottom', '')}
                  onImageChange={refetch}
                  height={{ xs: 72, sm: 88, md: 104 }}
                />
              </Card>
            </Grid>

            {/* Traditional Valet */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  background: isDark ? 'rgba(30,30,40,0.7)' : 'rgba(245,245,245,0.9)',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    border: isDark ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(245,158,11,0.25)',
                    boxShadow: '0 8px 32px rgba(245,158,11,0.1)',
                  },
                }}
              >
                <BadgeImageZone
                  slot="comparison-valet"
                  position="top"
                  imageUrl={getImageUrl('comparison-valet-top', '')}
                  onImageChange={refetch}
                  height={{ xs: 80, sm: 100, md: 120 }}
                />
                <CardContent sx={{ textAlign: 'center', py: { xs: 3, md: 4 } }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      mx: 'auto',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 28, color: '#f59e0b' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>
                    기존 발렛
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                    휴먼 발렛 / 인력 의존
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="인건비 12억/년" size="small" sx={{ fontSize: '0.65rem', height: 22, background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }} />
                    <Chip label="야간 미운영" size="small" sx={{ fontSize: '0.65rem', height: 22, background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }} />
                  </Box>
                </CardContent>
                <BadgeImageZone
                  slot="comparison-valet"
                  position="bottom"
                  imageUrl={getImageUrl('comparison-valet-bottom', '')}
                  onImageChange={refetch}
                  height={{ xs: 72, sm: 88, md: 104 }}
                />
              </Card>
            </Grid>

            {/* SkyGarage */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  position: 'relative',
                  background: isDark
                    ? `linear-gradient(160deg, rgba(20,18,10,0.95) 0%, rgba(30,25,15,0.98) 100%)`
                    : `linear-gradient(160deg, rgba(255,253,247,0.98) 0%, rgba(255,249,235,0.95) 100%)`,
                  border: `1px solid ${isDark ? 'rgba(201,168,76,0.4)' : 'rgba(158,127,48,0.35)'}`,
                  animation: `${glowPulse} 4s ease-in-out infinite`,
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    border: `1px solid ${goldColor}`,
                  },
                }}
              >
                <BadgeImageZone
                  slot="comparison-skygarage"
                  position="top"
                  imageUrl={getImageUrl('comparison-skygarage-top', '')}
                  onImageChange={refetch}
                  height={{ xs: 80, sm: 100, md: 120 }}
                />
                <CardContent sx={{ textAlign: 'center', py: { xs: 3, md: 4 } }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      mx: 'auto',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDark ? 'rgba(201,168,76,0.15)' : 'rgba(158,127,48,0.1)',
                      border: `1px solid ${isDark ? 'rgba(201,168,76,0.4)' : 'rgba(158,127,48,0.3)'}`,
                    }}
                  >
                    <SmartToyIcon sx={{ fontSize: 28, color: goldColor }} />
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      fontSize: '1rem',
                      mb: 0.5,
                      color: goldColor,
                    }}
                  >
                    SkyGarage AI
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                    세계최초 AI 통합주차시스템
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Chip label="24h 무인" size="small" sx={{ fontSize: '0.65rem', height: 22, background: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.08)', color: goldColor }} />
                    <Chip label="세대직입" size="small" sx={{ fontSize: '0.65rem', height: 22, background: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.08)', color: goldColor }} />
                    <Chip label="특허 기술" size="small" sx={{ fontSize: '0.65rem', height: 22, background: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.08)', color: goldColor }} />
                  </Box>
                </CardContent>
                <BadgeImageZone
                  slot="comparison-skygarage"
                  position="bottom"
                  imageUrl={getImageUrl('comparison-skygarage-bottom', '')}
                  onImageChange={refetch}
                  height={{ xs: 72, sm: 88, md: 104 }}
                />
              </Card>
            </Grid>
          </Grid>

          {/* Comparison table */}
          <Box
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
              background: isDark ? 'rgba(15,15,20,0.6)' : 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(12px)',
              opacity: tableVisible ? 1 : 0,
              transform: tableVisible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.2s ease',
            }}
          >
            {/* Table header */}
            <Box
              sx={{
                display: { xs: 'none', md: 'grid' },
                gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr',
                gap: 0,
                px: 3,
                py: 2,
                background: isDark ? 'rgba(201,168,76,0.06)' : 'rgba(158,127,48,0.04)',
                borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.7rem' }}>
                비교 항목
              </Typography>
              <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, fontSize: '0.7rem', textAlign: 'center' }}>
                기계식 주차
              </Typography>
              <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem', textAlign: 'center' }}>
                기존 발렛
              </Typography>
              <Typography variant="caption" sx={{ color: goldColor, fontWeight: 700, fontSize: '0.7rem', textAlign: 'center' }}>
                SkyGarage AI
              </Typography>
            </Box>

            {/* Table rows */}
            {comparisonData.map((row, idx) => (
              <Box
                key={row.label}
                sx={{
                  display: { xs: 'block', md: 'grid' },
                  gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr',
                  gap: 0,
                  px: 3,
                  py: { xs: 2, md: 1.5 },
                  borderBottom: idx < comparisonData.length - 1
                    ? (isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)')
                    : 'none',
                  transition: 'background 0.2s ease',
                  '&:hover': {
                    background: isDark ? 'rgba(201,168,76,0.03)' : 'rgba(158,127,48,0.02)',
                  },
                }}
              >
                {/* Label */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1.5, md: 0 } }}>
                  <Box sx={{ color: goldColor, display: 'flex', alignItems: 'center' }}>
                    {row.icon}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                    {row.label}
                  </Typography>
                </Box>

                {/* Mobile: stack all three */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1, pl: 3.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StatusIcon status={row.mechanical.status} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                      기계식: {row.mechanical.value}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StatusIcon status={row.valet.status} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                      발렛: {row.valet.value}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StatusIcon status={row.skygarage.status} />
                    <Typography variant="caption" sx={{ color: goldColor, fontWeight: 600, fontSize: '0.72rem' }}>
                      {row.skygarage.value}
                    </Typography>
                  </Box>
                </Box>

                {/* Desktop: grid columns */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                  <StatusIcon status={row.mechanical.status} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                    {row.mechanical.value}
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                  <StatusIcon status={row.valet.status} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                    {row.valet.value}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1.5,
                    background: isDark ? 'rgba(201,168,76,0.05)' : 'rgba(158,127,48,0.03)',
                  }}
                >
                  <StatusIcon status={row.skygarage.status} />
                  <Typography variant="caption" sx={{ color: goldColor, fontWeight: 600, fontSize: '0.72rem' }}>
                    {row.skygarage.value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Scenario comparison section */}
        <Box ref={scenarioRef} sx={{ mt: { xs: 8, md: 12 } }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography
              variant="overline"
              sx={{
                color: goldColor,
                letterSpacing: '0.2em',
                fontSize: '0.7rem',
                mb: 2,
                display: 'block',
                opacity: scenarioVisible ? 1 : 0,
                transition: 'opacity 0.6s ease',
              }}
            >
              REAL-LIFE SCENARIOS
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.3rem', sm: '1.6rem', md: '2.2rem' },
                fontWeight: 800,
                opacity: scenarioVisible ? 1 : 0,
                transform: scenarioVisible ? 'none' : 'translateY(20px)',
                transition: 'all 0.6s 0.1s ease',
              }}
            >
              같은 상황,{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${goldColor}, ${goldLight})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                결정적 차이
              </Box>
            </Typography>
          </Box>

          {/* Scenario cards */}
          <Grid container spacing={3}>
            {scenarios.map((scenario, idx) => (
              <Grid size={{ xs: 12, md: 4 }} key={scenario.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                    border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
                    opacity: scenarioVisible ? 1 : 0,
                    transform: scenarioVisible ? 'none' : 'translateY(30px)',
                    transition: `all 0.5s ${0.15 + idx * 0.1}s ease`,
                    '&:hover': {
                      border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(158,127,48,0.25)'}`,
                      transform: 'translateY(-4px)',
                      boxShadow: isDark
                        ? '0 16px 48px rgba(0,0,0,0.4)'
                        : '0 12px 36px rgba(0,0,0,0.1)',
                    },
                  }}
                >
                  <BadgeImageZone
                    slot={`comparison-scenario-${idx}`}
                    position="top"
                    imageUrl={getImageUrl(`comparison-scenario-${idx}-top`, '')}
                    onImageChange={refetch}
                    height={{ xs: 80, sm: 100, md: 120 }}
                  />
                  <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
                    {/* Scenario title */}
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>
                      {scenario.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', display: 'block', mb: 3 }}>
                      {scenario.subtitle}
                    </Typography>

                    {/* Mechanical */}
                    <Box sx={{ mb: 2, pb: 2, borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#ef4444' }}>
                          기계식
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#ef4444' }}>
                          {scenario.mechanicalTime}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', pl: 2.5 }}>
                        {scenario.mechanical}
                      </Typography>
                    </Box>

                    {/* Valet */}
                    <Box sx={{ mb: 2, pb: 2, borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#f59e0b' }}>
                          기존 발렛
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#f59e0b' }}>
                          {scenario.valetTime}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', pl: 2.5 }}>
                        {scenario.valet}
                      </Typography>
                    </Box>

                    {/* SkyGarage */}
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        background: isDark ? 'rgba(201,168,76,0.06)' : 'rgba(158,127,48,0.04)',
                        border: `1px solid ${isDark ? 'rgba(201,168,76,0.15)' : 'rgba(158,127,48,0.12)'}`,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <StarIcon sx={{ fontSize: 12, color: goldColor }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', color: goldColor }}>
                          SkyGarage
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: goldColor }}>
                          {scenario.skygarageTime}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: goldLight, fontWeight: 500, fontSize: '0.75rem', pl: 2.5 }}>
                        {scenario.skygarage}
                      </Typography>
                    </Box>
                  </CardContent>
                  <BadgeImageZone
                    slot={`comparison-scenario-${idx}`}
                    position="bottom"
                    imageUrl={getImageUrl(`comparison-scenario-${idx}-bottom`, '')}
                    onImageChange={refetch}
                    height={{ xs: 72, sm: 88, md: 104 }}
                  />
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Bottom highlight stats */}
        <Box
          sx={{
            mt: { xs: 6, md: 10 },
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
            opacity: scenarioVisible ? 1 : 0,
            transform: scenarioVisible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s 0.6s ease',
          }}
        >
          {[
            { value: '70%', label: '인건비 절감', desc: '22명 → 8명' },
            { value: '0m', label: '노약자 도보', desc: '거실 직입' },
            { value: '0건', label: '차량 분쟁', desc: 'Attestation 추적' },
            { value: '5분', label: '총 소요시간', desc: '출근길 기준' },
          ].map((stat) => (
            <Box
              key={stat.label}
              sx={{
                textAlign: 'center',
                py: { xs: 2.5, md: 3 },
                px: 2,
                borderRadius: 2,
                background: isDark ? 'rgba(201,168,76,0.04)' : 'rgba(158,127,48,0.03)',
                border: `1px solid ${isDark ? 'rgba(201,168,76,0.12)' : 'rgba(158,127,48,0.1)'}`,
                transition: (t) => t.transitions.create(['transform', 'box-shadow'], { duration: 300 }),
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${isDark ? 'rgba(201,168,76,0.12)' : 'rgba(158,127,48,0.1)'}`,
                },
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontFamily: '"Montserrat", sans-serif',
                  fontWeight: 900,
                  fontSize: { xs: '1.6rem', md: '2rem' },
                  color: goldColor,
                  mb: 0.5,
                }}
              >
                {stat.value}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.25 }}>
                {stat.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                {stat.desc}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
