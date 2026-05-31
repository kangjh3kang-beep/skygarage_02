import { useIntersection } from '../hooks/useIntersection';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { PARKING_GARAGE } from '../constants/images';
import { useSiteImages } from '../hooks/useSiteImages';
import ImageEditOverlay from './ImageEditOverlay';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RouteIcon from '@mui/icons-material/Route';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const stats = [
  {
    value: '30분',
    description: '출퇴근 평균 주차로\n사라지는 시간',
  },
  {
    value: '1.78조원',
    description: '한국이 매년 치르는\n주차 사회적 비용',
  },
  {
    value: '65%',
    description: '입주민 주차 불편\n민원 비율',
  },
];

const processSteps = [
  {
    icon: <PhoneAndroidIcon sx={{ fontSize: 28 }} />,
    label: '1. 앱 호출',
  },
  {
    icon: <LocalShippingIcon sx={{ fontSize: 28 }} />,
    label: '2. ATR 자율 픽업',
  },
  {
    icon: <RouteIcon sx={{ fontSize: 28 }} />,
    label: '3. 최적 동선 이동',
  },
  {
    icon: <LocationOnIcon sx={{ fontSize: 28 }} />,
    label: '4. 픽업존 도착',
  },
];

export default function PainPointSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { getImageUrl, getObjectPosition, getImageScale, refetch } = useSiteImages();

  const sectionBg = isDark
    ? `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.BG_SECONDARY} 50%, #0a0a0f 100%)`
    : `linear-gradient(180deg, #f8f6f0 0%, #ede8da 50%, #f8f6f0 100%)`;

  return (
    <Box
      id="painpoint"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg" ref={ref}>
        {/* Section title */}
        <Typography
          variant="overline"
          sx={{
            display: 'block',
            textAlign: 'center',
            color: '#ef4444',
            letterSpacing: '0.2em',
            fontSize: '0.7rem',
            mb: 2,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          STRESS REALITY
        </Typography>
        <Typography
          variant="h2"
          sx={{
            textAlign: 'center',
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' },
            fontWeight: 700,
            mb: 1.5,
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s ease',
          }}
        >
          매일 우리가 잃는 것은{' '}
          <Box
            component="span"
            sx={{
              background: `linear-gradient(135deg, #ef4444, #f97316)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            차 한 대의 주차시간이 아닙니다
          </Box>
        </Typography>
        <Typography
          variant="body1"
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            mb: { xs: 5, md: 8 },
            maxWidth: 540,
            mx: 'auto',
            fontSize: { xs: '0.88rem', md: '0.95rem' },
            lineHeight: 1.8,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.1s ease',
          }}
        >
          부모님과의 대화가 줄고, 아이와의 시간이 줄고,
          <br />
          오늘 하루의 여유가 사라집니다
        </Typography>

        {/* Stats row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 3,
            mb: { xs: 5, md: 8 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s 0.1s ease',
          }}
        >
          {stats.map((stat) => (
            <Box
              key={stat.value}
              sx={{
                textAlign: 'center',
                p: { xs: 3, md: 4 },
                background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
                borderRadius: 3,
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"Montserrat", sans-serif',
                  fontWeight: 900,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                  color: isDark ? '#ffffff' : '#1a1a2e',
                  mb: 1,
                }}
              >
                {stat.value}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}
              >
                {stat.description}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Middle statement with parking image */}
        <ImageEditOverlay
          slot="painpoint-visual"
          label="페인포인트 비주얼"
          currentUrl={getImageUrl('painpoint-visual', '')}
          onImageChange={refetch}
        >
          <Box
            sx={{
              position: 'relative',
              borderRadius: 3,
              overflow: 'hidden',
              mb: { xs: 5, md: 8 },
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s 0.2s ease',
            }}
          >
            <Box
              component="img"
              src={getImageUrl('painpoint-visual', PARKING_GARAGE)}
              alt="혼잡한 지하주차장"
              loading="lazy"
              sx={{
                width: '100%',
                height: { xs: 180, sm: 220, md: 280 },
                objectFit: 'cover',
                objectPosition: getObjectPosition('painpoint-visual'),
                display: 'block',
                transform: getImageScale('painpoint-visual') > 100 ? `scale(${getImageScale('painpoint-visual') / 100})` : undefined,
                transformOrigin: getObjectPosition('painpoint-visual'),
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.6rem' },
                  color: '#ffffff',
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                }}
              >
                차량 보급률 1.2대... 한계에 도달했습니다.
              </Typography>
            </Box>
          </Box>
        </ImageEditOverlay>

        {/* Process steps */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
            mb: { xs: 4, md: 6 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s 0.3s ease',
          }}
        >
          {processSteps.map((step, i) => (
            <Box
              key={step.label}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                p: { xs: 2.5, md: 3 },
                background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
                borderRadius: 3,
                position: 'relative',
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(20px)',
                transition: `all 0.6s ${0.3 + i * 0.1}s ease`,
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.1)',
                  border: `1px solid ${isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.2)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? COLORS.GOLD : COLORS.GOLD_DARK,
                }}
              >
                {step.icon}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textAlign: 'center',
                }}
              >
                {step.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Promise */}
        <Typography
          variant="h3"
          sx={{
            textAlign: 'center',
            fontWeight: 900,
            fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.4rem' },
            color: isDark ? COLORS.GOLD : COLORS.GOLD_DARK,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.5s ease',
          }}
        >
          그 시간, 돌려드립니다.
        </Typography>
      </Container>
    </Box>
  );
}
