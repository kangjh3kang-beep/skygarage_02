import { useIntersection } from '../hooks/useIntersection';
import { useSiteImages } from '../hooks/useSiteImages';
import ImageEditOverlay from './ImageEditOverlay';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import VerifiedIcon from '@mui/icons-material/Verified';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ApartmentIcon from '@mui/icons-material/Apartment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import MergeIcon from '@mui/icons-material/Merge';

const rotateSlow = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const rotateReverse = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(201,168,76,0.3); }
  50% { box-shadow: 0 0 40px rgba(201,168,76,0.6), 0 0 80px rgba(201,168,76,0.2); }
`;

export default function SolutionSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { getImageUrl, getObjectPosition, getImageScale, refetch } = useSiteImages();
  const solutionVisual = getImageUrl('solution-visual', '');

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const features = [
    {
      icon: <ApartmentIcon sx={{ fontSize: 28, color: goldColor }} />,
      title: '세대직입 주차',
      desc: 'ATR 자율이송로봇이 차량을 각 세대 현관 앞 전용 주차룸까지 자동 이송. 지하주차장에 내려갈 필요 없는 프리미엄 주거 경험',
    },
    {
      icon: <SmartToyIcon sx={{ fontSize: 28, color: COLORS.TECH_BLUE }} />,
      title: '공용주차장 자동 발렛',
      desc: 'ATR이 공용 주차구역에서 차량을 픽업·배치하는 완전 무인 발렛 서비스. 방문객·게스트 차량도 자동 처리',
    },
    {
      icon: <DirectionsCarIcon sx={{ fontSize: 28, color: '#10b981' }} />,
      title: '자가주차 모드',
      desc: '기존 방식 그대로 직접 주차도 가능. 운전을 즐기는 입주민을 위한 자유로운 선택지를 보장',
    },
    {
      icon: <MergeIcon sx={{ fontSize: 28, color: '#f59e0b' }} />,
      title: '통합 플랫폼',
      desc: '세 가지 주차 모드를 하나의 스마트 시스템으로 통합 관제. 상황에 맞게 자유롭게 전환하여 주차 스트레스 완전 해소',
    },
  ];

  const sectionBg = isDark
    ? COLORS.BG_PRIMARY
    : COLORS.LIGHT_BG_PRIMARY;

  const featureItemBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)';
  const featureItemBorder = isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)';
  const featureItemHoverBg = isDark ? 'rgba(201,168,76,0.04)' : 'rgba(201,168,76,0.06)';
  const featureItemHoverBorder = isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.25)';

  return (
    <Box
      id="solution"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: -200,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" ref={ref}>
        <Grid container spacing={{ xs: 4, md: 8 }} sx={{ alignItems: 'center' }}>
          {/* Left: Illustration */}
          <Grid size={{ xs: 12, md: 5 }}>
            <ImageEditOverlay
              slot="solution-visual"
              label="솔루션 비주얼"
              currentUrl={solutionVisual}
              onImageChange={refetch}
            >
            {solutionVisual ? (
              <Box
                sx={{
                  position: 'relative',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateX(0)' : 'translateX(-40px)',
                  transition: 'all 0.8s ease',
                  height: { xs: 280, sm: 340, md: 420 },
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: isDark
                    ? '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(201,168,76,0.08)'
                    : '0 24px 80px rgba(0,0,0,0.12)',
                  border: isDark ? '1px solid rgba(201,168,76,0.15)' : '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <Box
                  component="img"
                  src={solutionVisual}
                  alt="스카이게러지 통합 주차 솔루션"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: getObjectPosition('solution-visual'),
                    transform: getImageScale('solution-visual') > 100 ? `scale(${getImageScale('solution-visual') / 100})` : undefined,
                    transformOrigin: getObjectPosition('solution-visual'),
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: isDark
                      ? 'linear-gradient(180deg, transparent 60%, rgba(10,10,15,0.6) 100%)'
                      : 'linear-gradient(180deg, transparent 60%, rgba(248,246,240,0.5) 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </Box>
            ) : (
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateX(0)' : 'translateX(-40px)',
                transition: 'all 0.8s ease',
                height: { xs: 280, sm: 340, md: 420 },
              }}
            >
              {/* Outer ring */}
              <Box
                sx={{
                  position: 'absolute',
                  width: { xs: 240, sm: 290, md: 320 },
                  height: { xs: 240, sm: 290, md: 320 },
                  borderRadius: '50%',
                  border: isDark ? `1px dashed rgba(201,168,76,0.15)` : `1px dashed rgba(158,127,48,0.2)`,
                  animation: `${rotateSlow} 20s linear infinite`,
                }}
              />
              {/* Middle ring */}
              <Box
                sx={{
                  position: 'absolute',
                  width: { xs: 180, sm: 210, md: 240 },
                  height: { xs: 180, sm: 210, md: 240 },
                  borderRadius: '50%',
                  border: isDark ? `1px solid rgba(201,168,76,0.1)` : `1px solid rgba(158,127,48,0.15)`,
                  animation: `${rotateReverse} 15s linear infinite`,
                }}
              />
              {/* Inner ring */}
              <Box
                sx={{
                  position: 'absolute',
                  width: { xs: 120, sm: 140, md: 160 },
                  height: { xs: 120, sm: 140, md: 160 },
                  borderRadius: '50%',
                  border: isDark ? `2px solid rgba(201,168,76,0.2)` : `2px solid rgba(158,127,48,0.25)`,
                  animation: `${rotateSlow} 8s linear infinite`,
                }}
              />

              {/* Orbit dots */}
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <Box
                  key={angle}
                  sx={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: goldColor,
                    boxShadow: `0 0 8px ${goldColor}`,
                    left: `calc(50% + ${Math.cos((angle * Math.PI) / 180) * 120}px - 3px)`,
                    top: `calc(50% + ${Math.sin((angle * Math.PI) / 180) * 120}px - 3px)`,
                    opacity: 0.6,
                  }}
                />
              ))}

              {/* Center illustration */}
              <Box
                sx={{
                  width: { xs: 110, md: 140 },
                  height: { xs: 110, md: 140 },
                  borderRadius: '50%',
                  background: isDark
                    ? `radial-gradient(circle, rgba(201,168,76,0.12) 0%, rgba(26,34,53,0.9) 70%)`
                    : `radial-gradient(circle, rgba(201,168,76,0.15) 0%, rgba(248,246,240,0.95) 70%)`,
                  border: isDark ? `2px solid rgba(201,168,76,0.4)` : `2px solid rgba(158,127,48,0.4)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: `${glowPulse} 3s ease-in-out infinite`,
                  zIndex: 1,
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                  <rect x="8" y="20" width="32" height="44" rx="2" fill="none" stroke={goldColor} strokeWidth="1.5" opacity="0.7" />
                  <rect x="12" y="24" width="6" height="6" rx="1" fill={goldColor} opacity="0.5" />
                  <rect x="22" y="24" width="6" height="6" rx="1" fill={goldColor} opacity="0.5" />
                  <rect x="12" y="34" width="6" height="6" rx="1" fill={goldColor} opacity="0.5" />
                  <rect x="22" y="34" width="6" height="6" rx="1" fill={goldLight} opacity="0.8" />
                  <rect x="12" y="44" width="6" height="6" rx="1" fill={goldColor} opacity="0.5" />
                  <rect x="22" y="44" width="6" height="6" rx="1" fill={goldColor} opacity="0.5" />
                  <rect x="19" y="52" width="10" height="12" rx="1" fill={goldLight} opacity="0.6" />
                  <rect x="44" y="48" width="20" height="10" rx="3" fill={COLORS.TECH_BLUE} opacity="0.8" />
                  <circle cx="49" cy="62" r="4" fill={COLORS.SILVER} opacity="0.7" />
                  <circle cx="59" cy="62" r="4" fill={COLORS.SILVER} opacity="0.7" />
                  <rect x="42" y="40" width="24" height="10" rx="3" fill={goldColor} opacity="0.6" />
                  <path d="M46 40 L50 34 L58 34 L62 40" stroke={goldLight} strokeWidth="1.5" fill="none" opacity="0.8" />
                  <path d="M40 58 L44 58" stroke={goldColor} strokeWidth="2" strokeDasharray="2 2" />
                  <polyline points="42,56 44,58 42,60" stroke={goldColor} strokeWidth="1.5" fill="none" />
                </svg>
              </Box>

              {/* Label tags */}
              {[
                { text: '세대직입', angle: -30, color: goldColor },
                { text: '발렛 주차', angle: 150, color: COLORS.TECH_BLUE },
                { text: '자가주차', angle: 270, color: '#10b981' },
              ].map((tag) => (
                <Box
                  key={tag.text}
                  sx={{
                    position: 'absolute',
                    left: `calc(50% + ${Math.cos((tag.angle * Math.PI) / 180) * 160}px)`,
                    top: `calc(50% + ${Math.sin((tag.angle * Math.PI) / 180) * 160}px)`,
                    transform: 'translate(-50%, -50%)',
                    background: isDark ? 'rgba(10,10,15,0.9)' : 'rgba(255,255,255,0.95)',
                    border: `1px solid ${tag.color}40`,
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 0.5,
                    display: { xs: 'none', sm: 'block' },
                    boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: tag.color,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {tag.text}
                  </Typography>
                </Box>
              ))}
            </Box>
            )}
            </ImageEditOverlay>
          </Grid>

          {/* Right: Content */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Box
              sx={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateX(0)' : 'translateX(40px)',
                transition: 'all 0.8s 0.2s ease',
              }}
            >
              <Typography variant="overline" sx={{ color: goldColor, letterSpacing: '0.2em', fontSize: '0.7rem', mb: 2, display: 'block' }}>
                WORLD'S FIRST AI INTEGRATED PARKING
              </Typography>

              <Typography variant="h2" sx={{ fontSize: { xs: '1.6rem', sm: '2rem', md: '2.6rem' }, mb: 2 }}>
                세계최초{' '}
                <Box component="span" sx={{ color: goldColor }}>AI 통합주차</Box>
                시스템
              </Typography>

              <Typography
                variant="body1"
                sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.8, fontSize: { xs: '0.9rem', md: '1rem' } }}
              >
                세대직입 · 자율 ATR 발렛 · 자가주차 —{' '}
                <Box component="span" sx={{ color: isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD_DARK, fontWeight: 600 }}>
                  3가지 주차 모드를 하나의 AI가 통합 운영
                </Box>
                합니다. 당신의 라이프스타일을 학습하고, 상황에 맞는 최적의 모드를
                자동으로 추천하는 세계 최초의 AI 통합주차 플랫폼입니다.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 4 }}>
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: '0.9rem !important' }} />}
                  label="세계 최초 통합 주차 플랫폼"
                  sx={{
                    bgcolor: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.1)',
                    border: isDark ? `1px solid rgba(201,168,76,0.35)` : `1px solid rgba(158,127,48,0.35)`,
                    color: isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD_DARK,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    '& .MuiChip-icon': { color: `${goldColor} !important` },
                  }}
                />
                <Chip
                  icon={<LocalParkingIcon sx={{ fontSize: '0.9rem !important' }} />}
                  label="3-in-1 주차 모드"
                  sx={{
                    bgcolor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
                    border: isDark ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(59,130,246,0.25)',
                    color: isDark ? '#93c5fd' : COLORS.TECH_BLUE,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    '& .MuiChip-icon': { color: `${COLORS.TECH_BLUE} !important` },
                  }}
                />
                <Chip
                  label="특허 출원 완료"
                  sx={{
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                  }}
                />
              </Box>

              {/* Feature list */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
                {features.map((f, i) => (
                  <Box
                    key={f.title}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      p: { xs: 1.75, md: 2 },
                      background: featureItemBg,
                      border: featureItemBorder,
                      borderRadius: 2,
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateX(0)' : 'translateX(20px)',
                      transition: `all 0.6s ${0.3 + i * 0.1}s ease`,
                      '&:hover': {
                        background: featureItemHoverBg,
                        borderColor: featureItemHoverBorder,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1.5,
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(201,168,76,0.08)',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(158,127,48,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25, fontSize: '0.9rem' }}>
                        {f.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.6 }}>
                        {f.desc}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => document.getElementById('technology')?.scrollIntoView({ behavior: 'smooth' })}
              >
                ATR 기술 자세히 보기
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
