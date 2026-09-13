import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import ShieldIcon from '@mui/icons-material/Shield';
import AccessibleIcon from '@mui/icons-material/Accessible';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import WhatshotIcon from '@mui/icons-material/Whatshot';

const principles = [
  {
    icon: <AccessibleIcon sx={{ fontSize: 28 }} />,
    number: '01',
    title: '장애인전용구획 보존',
    desc: '장애인전용구획은 로봇으로 대체하지 않습니다. 법정 기준을 준수하여 자주식으로 존치합니다.',
    color: '#f97316',
  },
  {
    icon: <LocalFireDepartmentIcon sx={{ fontSize: 28 }} />,
    number: '02',
    title: '소방 접근 동선 확보',
    desc: '소방 접근 동선은 자주식으로 존치합니다. 긴급 상황 시 소방차 진입에 지장이 없도록 설계합니다.',
    color: '#ef4444',
  },
  {
    icon: <DirectionsCarIcon sx={{ fontSize: 28 }} />,
    number: '03',
    title: '초과 차량 자주식 존치',
    desc: '수용 제원을 초과하는 차량 대수만큼 자주식을 확정 존치합니다. 대형 SUV·특수차량도 주차 가능합니다.',
    color: COLORS.TECH_BLUE,
  },
  {
    icon: <PhoneAndroidIcon sx={{ fontSize: 28 }} />,
    number: '04',
    title: '앱 없이도 출차 가능',
    desc: '앱 없이도 차를 뺄 수 있습니다. 비상 시 물리 버튼·관리실 호출 등 대체 수단을 반드시 제공합니다.',
    color: '#10b981',
  },
  {
    icon: <WhatshotIcon sx={{ fontSize: 28 }} />,
    number: '05',
    title: '화재 시 차량 자동 대피',
    desc: '화재가 감지되면 로봇이 차량을 먼저 빼냅니다. 소방 동선 확보와 2차 폭발 위험 최소화를 위한 자동 대피 프로토콜을 운영합니다.',
    color: '#8b5cf6',
  },
];

export default function SafetyPrinciplesSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;

  const sectionBg = isDark
    ? `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.BG_SECONDARY} 100%)`
    : `linear-gradient(180deg, #f8f6f0 0%, #ede8da 100%)`;

  return (
    <Box
      id="safety"
      component="section"
      sx={{
        py: { xs: 6, md: 10 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(ellipse 60% 40% at 50% 0%, rgba(239,68,68,0.03) 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" ref={ref}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 } }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mb: 3,
              px: 2.5,
              py: 1,
              borderRadius: 10,
              background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          >
            <ShieldIcon sx={{ fontSize: 18, color: '#ef4444' }} />
            <Typography sx={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
              SAFETY FIRST
            </Typography>
          </Box>

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
            안전·존치{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              5원칙
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 620,
              mx: 'auto',
              lineHeight: 1.8,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.2s ease',
            }}
          >
            자동화가 편리함만을 추구해서는 안 됩니다.
            팔라트리아는 안전과 접근성을 절대 양보하지 않습니다.
          </Typography>
        </Box>

        {/* Principles list */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxWidth: 800,
            mx: 'auto',
          }}
        >
          {principles.map((p, i) => (
            <Box
              key={p.number}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: { xs: 2, md: 3 },
                p: { xs: 2.5, md: 3 },
                background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                border: isDark
                  ? '1px solid rgba(255,255,255,0.06)'
                  : '1px solid rgba(0,0,0,0.06)',
                borderRadius: 3,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateX(0)' : 'translateX(-20px)',
                transition: `all 0.5s ${0.15 + i * 0.08}s ease`,
                '&:hover': {
                  border: `1px solid ${p.color}40`,
                  background: isDark
                    ? `rgba(${p.color === '#ef4444' ? '239,68,68' : p.color === '#f97316' ? '249,115,22' : p.color === COLORS.TECH_BLUE ? '59,130,246' : p.color === '#10b981' ? '16,185,129' : '139,92,246'},0.04)`
                    : `rgba(${p.color === '#ef4444' ? '239,68,68' : p.color === '#f97316' ? '249,115,22' : p.color === COLORS.TECH_BLUE ? '59,130,246' : p.color === '#10b981' ? '16,185,129' : '139,92,246'},0.03)`,
                },
              }}
            >
              {/* Number + Icon */}
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: p.color,
                  background: isDark ? `${p.color}12` : `${p.color}08`,
                  border: `1px solid ${p.color}25`,
                }}
              >
                {p.icon}
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                  <Typography
                    sx={{
                      fontFamily: '"Montserrat", sans-serif',
                      fontWeight: 900,
                      fontSize: '0.7rem',
                      color: p.color,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {p.number}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, fontSize: { xs: '0.9rem', md: '1rem' } }}
                  >
                    {p.title}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.83rem',
                    lineHeight: 1.7,
                  }}
                >
                  {p.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
