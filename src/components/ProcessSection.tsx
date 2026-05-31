import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ElevatorIcon from '@mui/icons-material/Elevator';
import HouseIcon from '@mui/icons-material/House';
import UndoIcon from '@mui/icons-material/Undo';

const glowBorder = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(201,168,76,0); }
`;

const steps = [
  {
    step: '01',
    icon: <PhoneAndroidIcon sx={{ fontSize: 32 }} />,
    title: '앱/시스템 호출',
    subtitle: 'Request via App',
    description: '입주민이 스마트폰 앱 또는 세대 월패드에서 출차/입차 요청. 스마트워치, NFC 태그, 잠금화면 위젯으로도 1탭 호출 가능.',
    duration: '즉시',
    color: COLORS.GOLD,
  },
  {
    step: '02',
    icon: <SmartToyIcon sx={{ fontSize: 32 }} />,
    title: 'ATR 로봇 진입 및 리프팅',
    subtitle: 'Robot Approach & Lift',
    description: 'AI가 최적 ATR 유닛을 배차. 로봇이 차량 하부로 정밀 진입 후 유압식 멀티포인트 리프팅으로 차량을 안전하게 들어올립니다.',
    duration: '1~2분',
    color: COLORS.TECH_BLUE,
  },
  {
    step: '03',
    icon: <ElevatorIcon sx={{ fontSize: 32 }} />,
    title: '최적 경로로 이동',
    subtitle: 'Optimal Route Navigation',
    description: '차량용 전용 엘리베이터와 통합 연동. 실시간 동선 충돌 방지 알고리즘으로 복수 로봇이 동시에 이동해도 절대 교차하지 않습니다.',
    duration: '2~4분',
    color: '#10b981',
  },
  {
    step: '04',
    icon: <HouseIcon sx={{ fontSize: 32 }} />,
    title: '세대 현관 앞 주차 완료',
    subtitle: 'Door-to-Door Parking',
    description: '지정된 세대 전용 주차공간 또는 현관 앞에 ±2mm 정밀도로 주차 완료. 입주민에게 앱 푸시 알림 발송. 전기차는 자동 충전 시작.',
    duration: '즉시 완료',
    color: COLORS.GOLD,
  },
  {
    step: '05',
    icon: <UndoIcon sx={{ fontSize: 32 }} />,
    title: '출차 시 역순 자동 처리',
    subtitle: 'Automatic Departure',
    description: '출차 요청 시 ATR이 차량을 픽업하여 지정 출구로 이송. 운전자는 지하주차장 진입 없이 지상 또는 포트에서 바로 탑승 가능.',
    duration: '3~5분',
    color: COLORS.TECH_BLUE,
  },
];

export default function ProcessSection() {
  const { ref, visible } = useIntersection();
  const [activeStep, setActiveStep] = useState(0);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  const sectionBg = isDark
    ? `linear-gradient(180deg, ${COLORS.BG_SECONDARY} 0%, #0a0a0f 100%)`
    : `linear-gradient(180deg, #ede8da 0%, #f8f6f0 100%)`;

  return (
    <Box
      id="process"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grid */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? `linear-gradient(rgba(201,168,76,0.02) 1px, transparent 1px),
               linear-gradient(90deg, rgba(201,168,76,0.02) 1px, transparent 1px)`
            : `linear-gradient(rgba(158,127,48,0.03) 1px, transparent 1px),
               linear-gradient(90deg, rgba(158,127,48,0.03) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" ref={ref}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
          <Typography
            variant="overline"
            sx={{
              color: goldColor,
              letterSpacing: '0.2em',
              fontSize: '0.7rem',
              mb: 2,
              display: 'block',
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          >
            HOW IT WORKS
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' },
              mb: 2,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.1s ease',
            }}
          >
            5단계{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              자동 주차 프로세스
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 520,
              mx: 'auto',
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.2s ease',
            }}
          >
            호출부터 완료까지 평균 8분 이내. 사람 없이 모든 과정이 자동으로 처리됩니다.
          </Typography>
        </Box>

        {/* Progress timeline - Desktop horizontal */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            mb: 6,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.3s ease',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', mb: 3 }}>
            {/* Connector line background */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '10%',
                right: '10%',
                height: 2,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
                transform: 'translateY(-50%)',
              }}
            />
            {/* Connector line active */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '10%',
                height: 2,
                background: `linear-gradient(90deg, ${goldColor}, ${goldLight})`,
                transform: 'translateY(-50%)',
                boxShadow: `0 0 8px rgba(201,168,76,0.5)`,
                width: `${(activeStep / (steps.length - 1)) * 80}%`,
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />

            {steps.map((step, i) => {
              const isActive = i === activeStep;
              const isCompleted = i < activeStep;
              return (
                <Box
                  key={step.step}
                  onClick={() => setActiveStep(i)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    zIndex: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isActive
                        ? `linear-gradient(135deg, ${COLORS.GOLD_DARK}, ${goldColor})`
                        : isCompleted
                        ? `rgba(201,168,76,0.3)`
                        : (isDark ? COLORS.BG_ELEVATED : '#ffffff'),
                      border: `2px solid ${isActive ? goldColor : isCompleted ? 'rgba(201,168,76,0.4)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                      boxShadow: isActive ? `0 0 0 6px rgba(201,168,76,0.15), 0 0 20px rgba(201,168,76,0.3)` : 'none',
                      transition: 'all 0.4s ease',
                      animation: isActive ? `${glowBorder} 2s ease-in-out infinite` : 'none',
                      color: isActive ? '#0a0a0f' : isCompleted ? goldColor : (isDark ? COLORS.SILVER : 'text.secondary'),
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 1,
                      color: isActive ? COLORS.GOLD : 'text.secondary',
                      fontWeight: isActive ? 700 : 400,
                      fontSize: '0.7rem',
                      textAlign: 'center',
                      maxWidth: 80,
                      lineHeight: 1.3,
                      transition: 'color 0.3s ease',
                    }}
                  >
                    {step.title}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Active step detail card */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, mb: { xs: 0, md: 4 } }}>
          <Paper
            sx={{
              background: isDark
                ? `linear-gradient(135deg, rgba(201,168,76,0.06) 0%, ${COLORS.BG_ELEVATED} 100%)`
                : `linear-gradient(135deg, rgba(201,168,76,0.06) 0%, #ffffff 100%)`,
              border: `1px solid rgba(201,168,76,0.2)`,
              borderRadius: 3,
              p: 4,
              display: 'grid',
              gridTemplateColumns: '80px 1fr auto',
              gap: 3,
              alignItems: 'center',
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s 0.5s ease',
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: 2.5,
                background: `linear-gradient(135deg, ${COLORS.GOLD_DARK}, ${COLORS.GOLD})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0a0a0f',
                boxShadow: `0 8px 24px rgba(201,168,76,0.3)`,
              }}
            >
              {steps[activeStep].icon}
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: goldColor, fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                STEP {steps[activeStep].step} · {steps[activeStep].subtitle}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, my: 0.5, fontSize: '1.15rem' }}>
                {steps[activeStep].title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                {steps[activeStep].description}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 900, fontSize: '1.4rem', color: goldColor }}>
                {steps[activeStep].duration}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                처리 시간
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Mobile: vertical steps */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 0 }}>
          {steps.map((step, i) => (
            <Box
              key={step.step}
              sx={{
                display: 'flex',
                gap: 2,
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateX(-20px)',
                transition: `all 0.6s ${0.1 + i * 0.1}s ease`,
              }}
            >
              {/* Step indicator */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
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
                {i < steps.length - 1 && (
                  <Box
                    sx={{
                      width: 2,
                      flex: 1,
                      minHeight: 40,
                      background: 'rgba(201,168,76,0.2)',
                      my: 0.5,
                    }}
                  />
                )}
              </Box>

              {/* Content */}
              <Box sx={{ pb: i < steps.length - 1 ? 3 : 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 900, fontSize: '0.65rem', color: COLORS.GOLD, opacity: 0.6 }}>
                    {step.step}
                  </Typography>
                  <Typography variant="caption" sx={{ color: COLORS.GOLD, fontWeight: 600, fontSize: '0.7rem' }}>
                    {step.duration}
                  </Typography>
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.95rem' }}>
                  {step.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.65 }}>
                  {step.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* SLA summary */}
        <Box
          sx={{
            mt: { xs: 5, md: 4 },
            p: { xs: 3, md: 4 },
            background: `linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(59,130,246,0.04) 100%)`,
            border: `1px solid rgba(201,168,76,0.2)`,
            borderRadius: 3,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
            textAlign: 'center',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.8s ease',
          }}
        >
          {[
            { val: '≤ 8분', label: '총 처리 SLA' },
            { val: '±2mm', label: '주차 정밀도' },
            { val: '3.5톤', label: '최대 차량 중량' },
            { val: '99.9%', label: '시스템 가동률' },
          ].map((item) => (
            <Box key={item.label}>
              <Typography
                sx={{
                  fontFamily: '"Montserrat", sans-serif',
                  fontWeight: 900,
                  fontSize: { xs: '1.4rem', md: '1.8rem' },
                  color: COLORS.GOLD,
                  lineHeight: 1,
                  mb: 0.5,
                }}
              >
                {item.val}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
