import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import GavelIcon from '@mui/icons-material/Gavel';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SavingsIcon from '@mui/icons-material/Savings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const floatUp = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

interface ReformStat {
  icon: React.ReactNode;
  value: string;
  label: string;
  description: string;
  color: string;
}

const reformStats: ReformStat[] = [
  {
    icon: <TrendingDownIcon sx={{ fontSize: 32 }} />,
    value: '20~30%',
    label: '지하주차공간 절감',
    description: '자가주차·발렛주차 통합 운영으로 지하주차장 면적을 20~30% 축소',
    color: COLORS.GOLD,
  },
  {
    icon: <TrendingUpIcon sx={{ fontSize: 32 }} />,
    value: '법정주차대수',
    label: '넉넉한 확보',
    description: '공간 효율화로 법정 요구 주차대수를 여유 있게 상회 확보',
    color: '#10b981',
  },
  {
    icon: <SavingsIcon sx={{ fontSize: 32 }} />,
    value: '공사비 절감',
    label: '지하주차장 건설비',
    description: '지하 굴착·구조 축소로 단지 전체 건설 비용을 획기적으로 절감',
    color: COLORS.TECH_BLUE,
  },
  {
    icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
    value: 'Premium',
    label: '차세대 모빌리티 선도단지',
    description: '프리미엄·프라이빗 이미지를 부각하는 차세대 AI 모빌리티 시스템',
    color: '#f59e0b',
  },
];

export default function LawReformSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const sectionBg = isDark
    ? `linear-gradient(180deg, ${COLORS.BG_SECONDARY} 0%, ${COLORS.BG_PRIMARY} 100%)`
    : `linear-gradient(180deg, #ede8da 0%, #f8f6f0 100%)`;

  return (
    <Box
      id="law-reform"
      component="section"
      sx={{
        py: { xs: 6, md: 10 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%),
            radial-gradient(circle at 80% 80%, rgba(59,130,246,0.03) 0%, transparent 40%)
          `,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" ref={ref} sx={{ position: 'relative' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
          <Chip
            icon={<GavelIcon sx={{ fontSize: '1rem !important' }} />}
            label="2026.07.29 법제개정 반영"
            sx={{
              mb: 3,
              background: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.08)',
              border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(158,127,48,0.25)'}`,
              color: goldColor,
              fontWeight: 700,
              fontSize: '0.78rem',
              letterSpacing: '0.05em',
              py: 2.5,
              px: 1,
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          />

          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.8rem' },
              fontWeight: 800,
              mb: 2,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.1s ease',
            }}
          >
            주택법·주차장법 개정으로{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundSize: '200% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: `${shimmer} 5s linear infinite`,
              }}
            >
              황금비를 제공합니다
            </Box>
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 780,
              mx: 'auto',
              lineHeight: 1.9,
              fontSize: { xs: '0.9rem', md: '1.05rem' },
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.2s ease',
            }}
          >
            2026년 7월 29일 시행된 <strong style={{ color: goldColor }}>주택법·주차장법 개정</strong>으로
            자가주차와 발렛주차가 법적으로 도입되었습니다.
            <br />
            이를 반영하여 지하주차공간 효율을 <strong style={{ color: goldColor }}>20%~30% 절감</strong>함으로써
            법정주차대수는 더 넉넉하게 확보하고, 지하주차장 공사비는 절감하는 황금비를 실현합니다.
          </Typography>
        </Box>

        {/* Stat cards */}
        <Grid container spacing={{ xs: 2.5, md: 3 }} sx={{ mb: { xs: 5, md: 7 } }}>
          {reformStats.map((stat, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.label}>
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 2.5, md: 3 },
                  background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.06)'
                    : '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 3,
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'none' : 'translateY(30px)',
                  transition: `all 0.5s ${0.15 + i * 0.1}s ease`,
                  '&:hover': {
                    border: `1px solid ${stat.color}50`,
                    transform: 'translateY(-8px)',
                    boxShadow: isDark
                      ? `0 16px 48px rgba(0,0,0,0.4)`
                      : `0 12px 36px rgba(0,0,0,0.1)`,
                    '& .reform-icon': {
                      animation: `${floatUp} 2s ease-in-out infinite`,
                      background: `${stat.color}18`,
                      borderColor: `${stat.color}40`,
                    },
                  },
                }}
              >
                {/* Top accent line */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, transparent 0%, ${stat.color}80 50%, transparent 100%)`,
                  }}
                />

                <Box
                  className="reform-icon"
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    mx: 'auto',
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stat.color,
                    background: isDark ? `${stat.color}10` : `${stat.color}08`,
                    border: `1px solid ${stat.color}25`,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {stat.icon}
                </Box>

                <Typography
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.3rem', md: '1.6rem' },
                    color: stat.color,
                    lineHeight: 1.1,
                    mb: 0.5,
                    fontFamily: '"Montserrat", sans-serif',
                  }}
                >
                  {stat.value}
                </Typography>

                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    mb: 1.5,
                    color: 'text.primary',
                  }}
                >
                  {stat.label}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                  }}
                >
                  {stat.description}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Premium highlight banner */}
        <Box
          sx={{
            position: 'relative',
            p: { xs: 3.5, md: 5 },
            borderRadius: 4,
            background: isDark
              ? `linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(26,34,53,0.9) 100%)`
              : `linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(255,255,255,0.95) 100%)`,
            border: `1px solid ${isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.2)'}`,
            overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(30px)',
            transition: 'all 0.6s 0.5s ease',
          }}
        >
          {/* Decorative glow */}
          <Box
            sx={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          <Box
            sx={{
              position: 'relative',
              textAlign: 'center',
              maxWidth: 720,
              mx: 'auto',
            }}
          >
            <Typography
              variant="overline"
              sx={{
                color: goldColor,
                letterSpacing: '0.25em',
                fontSize: '0.7rem',
                mb: 2,
                display: 'block',
              }}
            >
              NEXT-GENERATION AI MOBILITY SYSTEM
            </Typography>

            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '1.3rem', sm: '1.7rem', md: '2.1rem' },
                fontWeight: 800,
                mb: 2,
                lineHeight: 1.4,
              }}
            >
              차세대 AI 모빌리티 시스템
              <br />
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                  backgroundSize: '200% auto',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: `${shimmer} 5s linear infinite`,
                }}
              >
                스카이게러지 "팔라트리아"
              </Box>
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                fontSize: { xs: '0.88rem', md: '1rem' },
                lineHeight: 1.8,
                mb: 3,
              }}
            >
              주차공간 효율화와 비용 절감이라는 황금비를 달성하여
              <br />
              <strong style={{ color: goldColor }}>차세대 모빌리티 선도단지</strong>의
              프리미엄·프라이빗 이미지를 부각합니다.
              <br />
              법제개정을 선제적으로 반영한 팔라트리아가 제공하는
              <strong style={{ color: goldColor }}> 차세대 주거 가치</strong>를 경험하세요.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {['자가주차 도입', '발렛주차 도입', '법정주차대수 여유 확보', '지하공사비 절감'].map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    background: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.06)',
                    border: `1px solid ${isDark ? 'rgba(201,168,76,0.25)' : 'rgba(158,127,48,0.2)'}`,
                    color: goldColor,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
