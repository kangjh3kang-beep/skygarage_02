import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import DiamondIcon from '@mui/icons-material/Diamond';
import VerifiedIcon from '@mui/icons-material/Verified';
import { usePageTracking } from '../hooks/usePageTracking';

const brandColors = [
  { name: 'Gold Primary', hex: '#c9a84c', usage: '주요 브랜드 컬러, CTA, 강조' },
  { name: 'Gold Light', hex: '#e8c96a', usage: '호버 상태, 그라디언트 보조' },
  { name: 'Gold Dark', hex: '#9e7f30', usage: '라이트 모드 주요 컬러' },
  { name: 'Tech Blue', hex: '#3b82f6', usage: '보조 컬러, 기술 관련 요소' },
  { name: 'Dark BG', hex: '#0a0a0f', usage: '다크 모드 배경' },
  { name: 'Navy Deep', hex: '#111827', usage: '다크 모드 카드 배경' },
  { name: 'Light BG', hex: '#f8f6f0', usage: '라이트 모드 배경' },
  { name: 'Silver', hex: '#a8b2c1', usage: '보조 텍스트, 아이콘' },
];

const typographySpecs = [
  { variant: 'Display', font: 'Montserrat', weight: 900, usage: '브랜드명, 히어로 타이틀', example: 'PALATRIA' },
  { variant: 'Heading', font: 'Noto Sans KR', weight: 800, usage: '섹션 제목, 주요 헤딩', example: '팔라트리아' },
  { variant: 'Subtitle', font: 'Noto Sans KR', weight: 600, usage: '소제목, 카드 타이틀', example: '스카이게러지' },
  { variant: 'Body', font: 'Noto Sans KR', weight: 400, usage: '본문 텍스트', example: '하늘 위의 궁전 같은 프리미엄 공간' },
  { variant: 'Caption', font: 'Montserrat', weight: 600, usage: '레이블, 뱃지, 오버라인', example: 'SKYGARAGE' },
];

const brandValues = [
  {
    icon: <DiamondIcon />,
    title: 'Premium',
    subtitle: '프리미엄',
    description: '하늘 위의 궁전이라는 브랜드 정체성에 걸맞은 최고급 경험을 모든 접점에서 제공합니다.',
  },
  {
    icon: <PrecisionManufacturingIcon />,
    title: 'Innovation',
    subtitle: '혁신',
    description: 'ATR 자율이송로봇과 세대직입 시스템으로 주거 환경의 패러다임을 재정의합니다.',
  },
  {
    icon: <VerifiedIcon />,
    title: 'Trust',
    subtitle: '신뢰',
    description: '특허 기술과 검증된 파트너십을 통해 시행사와 입주민 모두의 확고한 신뢰를 구축합니다.',
  },
  {
    icon: <AutoAwesomeIcon />,
    title: 'Experience',
    subtitle: '경험',
    description: '주차라는 일상적 행위를 프리미엄 라이프스타일의 일부로 승화시킵니다.',
  },
];

const dosAndDonts = {
  dos: [
    '투명 배경에서 로고 사용 시 충분한 여백(로고 너비의 25%) 확보',
    '공식 골드 그라디언트 색상 조합만 사용',
    '다크 배경에서는 글로우 효과(drop-shadow) 적용',
    '라이트 배경에서는 미세한 드롭 섀도우 적용',
    '최소 크기: 디지털 32px, 인쇄 12mm 이상',
    '로고와 텍스트 조합 시 수평 정렬 유지',
  ],
  donts: [
    '로고 색상을 임의로 변경하지 않음',
    '로고를 왜곡하거나 회전하지 않음',
    '복잡한 배경 위에 직접 배치하지 않음',
    '로고 주변 보호 영역을 침범하지 않음',
    '저해상도 이미지로 사용하지 않음',
    '그림자나 외곽선을 임의로 추가하지 않음',
  ],
};

export default function BrandGuidePage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  usePageTracking('/brand-guide');

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;
  const cardBg = isDark ? COLORS.BG_ELEVATED : '#ffffff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)';

  return (
    <Box
      sx={{
        pt: { xs: 10, md: 12 },
        pb: { xs: 8, md: 12 },
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        background: isDark
          ? `linear-gradient(180deg, ${COLORS.BG_PRIMARY} 0%, ${COLORS.BG_SECONDARY} 100%)`
          : `linear-gradient(180deg, ${COLORS.LIGHT_BG_PRIMARY} 0%, #ede8da 100%)`,
      }}
    >
      <Container maxWidth="lg">
        {/* Page Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
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
            BRAND IDENTITY
          </Typography>
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: '1.8rem', md: '2.8rem' }, mb: 2 }}
          >
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              PALATRIA
            </Box>{' '}
            Brand Guide
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}>
            팔라트리아 브랜드의 일관된 시각적 아이덴티티를 유지하기 위한 공식 가이드라인입니다.
          </Typography>
        </Box>

        {/* Section 0: Brand Philosophy */}
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            브랜드 철학
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            팔라트리아 브랜드를 관통하는 4가지 핵심 가치
          </Typography>

          <Grid container spacing={2.5}>
            {brandValues.map((val) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={val.title}>
                <Card
                  sx={{
                    background: cardBg,
                    border: cardBorder,
                    height: '100%',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: isDark ? 'rgba(201,168,76,0.3)' : 'rgba(158,127,48,0.3)',
                      transform: 'translateY(-4px)',
                      boxShadow: isDark
                        ? '0 12px 40px rgba(201,168,76,0.1)'
                        : '0 12px 40px rgba(158,127,48,0.08)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        background: `linear-gradient(135deg, ${goldColor}15, ${goldLight}10)`,
                        border: `1px solid ${goldColor}25`,
                        color: goldColor,
                      }}
                    >
                      {val.icon}
                    </Box>
                    <Typography
                      sx={{
                        fontFamily: '"Montserrat", sans-serif',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em',
                        color: goldColor,
                        mb: 0.25,
                      }}
                    >
                      {val.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                      {val.subtitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.7 }}>
                      {val.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Section 1: Logo Display */}
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
            로고 시스템
          </Typography>

          <Grid container spacing={3}>
            {/* Primary Logo */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ background: cardBg, border: cardBorder, height: '100%' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="subtitle2" sx={{ color: goldColor, fontWeight: 700, mb: 2, letterSpacing: '0.05em' }}>
                    Primary Logo
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      py: { xs: 4, md: 6 },
                      px: 3,
                      borderRadius: 3,
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(201,168,76,0.03), rgba(17,24,39,0.8))'
                        : 'linear-gradient(135deg, rgba(248,246,240,1), rgba(237,232,218,1))',
                      border: isDark ? '1px solid rgba(201,168,76,0.1)' : '1px solid rgba(158,127,48,0.1)',
                    }}
                  >
                    <Box
                      component="img"
                      src="/logo03.png"
                      alt="PALATRIA Brand Identity"
                      sx={{
                        width: '100%',
                        maxWidth: 500,
                        height: 'auto',
                        objectFit: 'contain',
                        filter: isDark ? 'drop-shadow(0 0 20px rgba(201,168,76,0.3))' : 'none',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, textAlign: 'center' }}>
                    팔라트리아 풀 브랜드 아이덴티티 - 로고 마크 + 워드마크 + 브랜드 설명
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Logo Variations */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
                {/* Icon Mark */}
                <Card sx={{ background: cardBg, border: cardBorder, flex: 1 }}>
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant="subtitle2" sx={{ color: goldColor, fontWeight: 700, mb: 2, letterSpacing: '0.05em', alignSelf: 'flex-start' }}>
                      Icon Mark
                    </Typography>
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 3,
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                        mb: 1,
                      }}
                    >
                      <Box
                        component="img"
                        src="/logo-palatria.webp"
                        alt="PALATRIA Icon"
                        sx={{ width: 72, height: 72, objectFit: 'contain' }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                      앱 아이콘, 파비콘, 소셜 프로필
                    </Typography>
                  </CardContent>
                </Card>

                {/* Sizing Rules */}
                <Card sx={{ background: cardBg, border: cardBorder, flex: 1 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle2" sx={{ color: goldColor, fontWeight: 700, mb: 2, letterSpacing: '0.05em' }}>
                      Sizing Rules
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {[
                        { label: '최소 크기 (디지털)', value: '32px' },
                        { label: '최소 크기 (인쇄)', value: '12mm' },
                        { label: '보호 영역', value: '로고 너비 25%' },
                        { label: '종횡비', value: '고정 (변경 금지)' },
                      ].map((item) => (
                        <Box
                          key={item.label}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            py: 0.75,
                            px: 1.5,
                            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: goldColor, fontWeight: 700, fontSize: '0.75rem' }}>
                            {item.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Section 2: Brand Etymology */}
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
            브랜드 어원
          </Typography>
          <Card sx={{ background: cardBg, border: cardBorder }}>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 2, md: 4 },
                  py: 3,
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 700, fontSize: '1.2rem', color: goldColor }}>
                    palatium
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>궁전</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.5rem', color: goldColor, fontWeight: 300 }}>+</Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 700, fontSize: '1.2rem', color: COLORS.TECH_BLUE }}>
                    aria
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>공간 / 영역</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.5rem', color: goldColor, fontWeight: 300 }}>=</Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 900, fontSize: '1.5rem', color: goldColor }}>
                    PALATRIA
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>하늘 위의 궁전 같은 프리미엄 공간</Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 3 }} />
              <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'center', lineHeight: 1.8 }}>
                최첨단 자율 주차 시스템과 프리미엄 주거 경험의 조화.<br />
                팔라트리아는 "궁전(Palatium)"의 웅장함과 "공간(Aria)"의 개방감을 결합하여,<br />
                입주민에게 하늘 위의 궁전과 같은 프리미엄 생활 공간을 제공합니다.
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Section 3: Color Palette */}
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
            컬러 팔레트
          </Typography>
          <Grid container spacing={2}>
            {brandColors.map((color) => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={color.name}>
                <Card sx={{ background: cardBg, border: cardBorder, height: '100%' }}>
                  <Box
                    sx={{
                      height: 80,
                      background: color.hex,
                      borderRadius: '12px 12px 0 0',
                    }}
                  />
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.5 }}>
                      {color.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: '"Montserrat", sans-serif',
                        fontWeight: 600,
                        color: 'text.secondary',
                        display: 'block',
                        mb: 0.5,
                      }}
                    >
                      {color.hex}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem', lineHeight: 1.4 }}>
                      {color.usage}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Section 4: Typography */}
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
            타이포그래피
          </Typography>
          <Card sx={{ background: cardBg, border: cardBorder }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {typographySpecs.map((spec, i) => (
                  <Box key={spec.variant}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'flex-start', md: 'center' },
                        gap: { xs: 1, md: 3 },
                        py: 2.5,
                        px: 2,
                      }}
                    >
                      <Box sx={{ width: { md: 100 }, flexShrink: 0 }}>
                        <Chip
                          label={spec.variant}
                          size="small"
                          sx={{
                            bgcolor: `${goldColor}15`,
                            color: goldColor,
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            border: `1px solid ${goldColor}30`,
                          }}
                        />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontFamily: `"${spec.font}", sans-serif`,
                            fontWeight: spec.weight,
                            fontSize: spec.variant === 'Display' ? '1.5rem' : spec.variant === 'Heading' ? '1.2rem' : '1rem',
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {spec.example}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {spec.font} / {spec.weight} weight — {spec.usage}
                        </Typography>
                      </Box>
                    </Box>
                    {i < typographySpecs.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Section 5: Do's and Don'ts */}
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
            사용 가이드라인
          </Typography>
          <Grid container spacing={3}>
            {/* Do's */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                sx={{
                  background: cardBg,
                  border: isDark ? '1px solid rgba(0,230,118,0.15)' : '1px solid rgba(46,125,50,0.15)',
                  height: '100%',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                    <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 22 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.success.main, fontSize: '1rem' }}>
                      올바른 사용 (Do)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {dosAndDonts.dos.map((item) => (
                      <Box key={item} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main, mt: 0.2, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.84rem', lineHeight: 1.6 }}>
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Don'ts */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                sx={{
                  background: cardBg,
                  border: isDark ? '1px solid rgba(255,82,82,0.15)' : '1px solid rgba(211,47,47,0.15)',
                  height: '100%',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                    <CancelIcon sx={{ color: theme.palette.error.main, fontSize: 22 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.error.main, fontSize: '1rem' }}>
                      잘못된 사용 (Don't)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {dosAndDonts.donts.map((item) => (
                      <Box key={item} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <CancelIcon sx={{ fontSize: 16, color: theme.palette.error.main, mt: 0.2, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.84rem', lineHeight: 1.6 }}>
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Section 6: Brand Application */}
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            브랜드 적용
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            다양한 매체에서의 브랜드 적용 가이드
          </Typography>

          <Grid container spacing={3}>
            {[
              {
                title: '다크 배경 적용',
                desc: '어두운 배경에서는 골드 그라디언트 로고와 글로우 효과를 사용합니다.',
                bg: 'linear-gradient(135deg, #0a0a0f, #111827)',
                logoFilter: 'drop-shadow(0 0 20px rgba(201,168,76,0.5))',
              },
              {
                title: '라이트 배경 적용',
                desc: '밝은 배경에서는 Gold Dark 컬러와 미세한 섀도우를 적용합니다.',
                bg: 'linear-gradient(135deg, #f8f6f0, #ede8da)',
                logoFilter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))',
              },
              {
                title: '인쇄물 적용',
                desc: 'CMYK 변환 시 골드 컬러의 정확한 재현을 위해 별색(Pantone) 인쇄를 권장합니다.',
                bg: isDark ? 'linear-gradient(135deg, #1a1a2e, #2d2d4a)' : 'linear-gradient(135deg, #ffffff, #f5f5f5)',
                logoFilter: 'none',
              },
            ].map((app) => (
              <Grid size={{ xs: 12, md: 4 }} key={app.title}>
                <Card sx={{ background: cardBg, border: cardBorder, height: '100%' }}>
                  <Box
                    sx={{
                      height: 140,
                      background: app.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '12px 12px 0 0',
                    }}
                  >
                    <Box
                      component="img"
                      src="/logo-palatria.webp"
                      alt="Logo application"
                      sx={{
                        width: 64,
                        height: 64,
                        objectFit: 'contain',
                        filter: app.logoFilter,
                      }}
                    />
                  </Box>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.85rem' }}>
                      {app.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', lineHeight: 1.6 }}>
                      {app.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Section 7: Contact Info */}
        <Card
          sx={{
            background: isDark
              ? `linear-gradient(135deg, rgba(201,168,76,0.05), rgba(17,24,39,0.8))`
              : `linear-gradient(135deg, rgba(248,246,240,1), rgba(237,232,218,1))`,
            border: isDark ? '1px solid rgba(201,168,76,0.15)' : '1px solid rgba(158,127,48,0.15)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              브랜드 관련 문의
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              로고 파일 요청, 브랜드 협업, 라이선스 관련 문의는 아래로 연락해 주세요.
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 2,
                fontWeight: 600,
                color: goldColor,
              }}
            >
              brand@jhholdings.co.kr
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
