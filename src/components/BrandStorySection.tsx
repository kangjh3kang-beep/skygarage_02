import { useIntersection } from '../hooks/useIntersection';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
`;

export default function BrandStorySection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const sectionBg = isDark
    ? `linear-gradient(180deg, rgba(10,10,15,0.95) 0%, ${COLORS.BG_SECONDARY} 50%, ${COLORS.BG_PRIMARY} 100%)`
    : `linear-gradient(180deg, rgba(248,246,240,0.95) 0%, #ffffff 50%, #f8f6f0 100%)`;

  return (
    <Box
      id="brand-story"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative radial */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" ref={ref}>
        {/* Section header */}
        <Box
          sx={{
            textAlign: 'center',
            mb: { xs: 5, md: 8 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s ease',
          }}
        >
          <Typography
            variant="overline"
            sx={{
              color: goldColor,
              letterSpacing: '0.2em',
              fontSize: '0.7rem',
              mb: 2,
              display: 'block',
            }}
          >
            BRAND STORY
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' },
              fontWeight: 800,
              mb: 2,
            }}
          >
            하늘 위의 궁전,{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${COLORS.GOLD_DARK} 0%, ${goldColor} 30%, ${goldLight} 60%, ${goldColor} 100%)`,
                backgroundSize: '300% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: `${shimmer} 4s linear infinite`,
              }}
            >
              팔라트리아
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              fontSize: { xs: '0.9rem', md: '1.05rem' },
              lineHeight: 1.8,
            }}
          >
            AI 주거혁명을 이끄는 프리미엄 스마트 주차 브랜드
          </Typography>
        </Box>

        {/* Brand logo image */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: { xs: 5, md: 7 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.7s 0.15s ease',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              maxWidth: { xs: '100%', sm: 520, md: 600 },
              width: '100%',
              borderRadius: 4,
              overflow: 'hidden',
              border: isDark
                ? '1px solid rgba(201,168,76,0.2)'
                : '1px solid rgba(158,127,48,0.15)',
              boxShadow: isDark
                ? '0 24px 80px rgba(0,0,0,0.4), 0 0 40px rgba(201,168,76,0.06)'
                : '0 16px 60px rgba(0,0,0,0.08)',
            }}
          >
            <Box
              component="img"
              src="/logo03.png"
              alt="팔라트리아 브랜드 어원과 의미 - palatium(궁전) + aria(공간/영역) = PALATRIA"
              loading="lazy"
              sx={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </Box>
        </Box>

        {/* Etymology equation */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1.5, sm: 2.5, md: 4 },
            flexDirection: { xs: 'column', sm: 'row' },
            mb: { xs: 5, md: 7 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.7s 0.3s ease',
          }}
        >
          {/* Palatium */}
          <Box
            sx={{
              textAlign: 'center',
              p: { xs: 2, md: 3 },
              background: isDark ? 'rgba(201,168,76,0.06)' : 'rgba(201,168,76,0.06)',
              border: `1px solid ${isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.2)'}`,
              borderRadius: 3,
              minWidth: { xs: 140, md: 160 },
            }}
          >
            <Typography
              sx={{
                fontFamily: '"Montserrat", sans-serif',
                fontWeight: 700,
                fontSize: { xs: '1.1rem', md: '1.3rem' },
                color: goldColor,
                mb: 0.5,
                letterSpacing: '0.02em',
              }}
            >
              Palatium
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
              궁전 (Palace)
            </Typography>
          </Box>

          {/* Plus */}
          <Typography
            sx={{
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: 300,
              fontSize: { xs: '1.5rem', md: '2rem' },
              color: goldColor,
              opacity: 0.6,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            +
          </Typography>

          {/* Aria */}
          <Box
            sx={{
              textAlign: 'center',
              p: { xs: 2, md: 3 },
              background: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)',
              border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
              borderRadius: 3,
              minWidth: { xs: 140, md: 160 },
            }}
          >
            <Typography
              sx={{
                fontFamily: '"Montserrat", sans-serif',
                fontWeight: 700,
                fontSize: { xs: '1.1rem', md: '1.3rem' },
                color: COLORS.TECH_BLUE,
                mb: 0.5,
                letterSpacing: '0.02em',
              }}
            >
              Aria
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
              공간 / 영역 (Space)
            </Typography>
          </Box>

          {/* Equals */}
          <Typography
            sx={{
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: 300,
              fontSize: { xs: '1.5rem', md: '2rem' },
              color: goldColor,
              opacity: 0.6,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            =
          </Typography>

          {/* PALATRIA result */}
          <Box
            sx={{
              textAlign: 'center',
              p: { xs: 2.5, md: 3.5 },
              background: isDark
                ? 'rgba(201,168,76,0.08)'
                : 'rgba(201,168,76,0.08)',
              border: `2px solid ${isDark ? 'rgba(201,168,76,0.35)' : 'rgba(158,127,48,0.3)'}`,
              borderRadius: 3,
              minWidth: { xs: 180, md: 220 },
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(ellipse at center, rgba(201,168,76,0.1) 0%, transparent 70%)`,
                animation: `${pulseGlow} 3s ease-in-out infinite`,
                pointerEvents: 'none',
              }}
            />
            <Typography
              sx={{
                fontFamily: '"Montserrat", sans-serif',
                fontWeight: 900,
                fontSize: { xs: '1.4rem', md: '1.8rem' },
                background: `linear-gradient(135deg, ${COLORS.GOLD_DARK} 0%, ${goldColor} 30%, ${goldLight} 60%, ${goldColor} 100%)`,
                backgroundSize: '300% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: `${shimmer} 4s linear infinite`,
                mb: 0.5,
                letterSpacing: '0.08em',
                position: 'relative',
              }}
            >
              PALATRIA
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', position: 'relative' }}>
              하늘 위의 궁전 같은 프리미엄 공간
            </Typography>
          </Box>
        </Box>

        {/* Brand philosophy */}
        <Box
          sx={{
            textAlign: 'center',
            maxWidth: 700,
            mx: 'auto',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.7s 0.45s ease',
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
              fontWeight: 700,
              mb: 2,
              lineHeight: 1.6,
              animation: visible ? `${fadeInUp} 0.8s 0.5s ease both` : 'none',
            }}
          >
            최첨단 자율 주차 시스템과
            <br />
            프리미엄 주거 경험의{' '}
            <Box component="span" sx={{ color: goldColor }}>
              완벽한 조화
            </Box>
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.88rem', md: '0.98rem' },
              lineHeight: 1.9,
              mb: 4,
            }}
          >
            팔라트리아 스카이게러지는 세계 최초 AI 통합주차시스템으로
            <br />
            <Box component="span" sx={{ fontWeight: 600, color: isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD_DARK }}>
              세대직입 · 자율 ATR 발렛 · 자가주차
            </Box>
            {' '}3가지 주차 모드를
            <br />
            하나의 플랫폼으로 통합하여 현대인의 주차 스트레스에서 해방시킵니다.
          </Typography>

          {/* Key value props as minimal badges */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: { xs: 2, md: 4 },
              flexWrap: 'wrap',
            }}
          >
            {[
              { value: '3 모드', label: '자유 선택' },
              { value: 'AI', label: '자동 추천' },
              { value: '24/7', label: '무인 운영' },
              { value: '특허', label: '세계 최초' },
            ].map((item) => (
              <Box key={item.value} sx={{ textAlign: 'center' }}>
                <Typography
                  sx={{
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: 900,
                    fontSize: { xs: '1.2rem', md: '1.5rem' },
                    color: goldColor,
                    lineHeight: 1,
                    mb: 0.5,
                  }}
                >
                  {item.value}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
