import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import { useSiteImages } from '../hooks/useSiteImages';
import BadgeImageZone from './BadgeImageZone';
import VerifiedIcon from '@mui/icons-material/Verified';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScienceIcon from '@mui/icons-material/Science';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GroupsIcon from '@mui/icons-material/Groups';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';


const glowAward = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(201,168,76,0.3), 0 0 0 0 rgba(201,168,76,0.2); }
  50% { box-shadow: 0 0 40px rgba(201,168,76,0.5), 0 0 60px rgba(201,168,76,0.1); }
`;

const patents = [
  { number: '청구항 1', title: 'ATR 자율이송로봇 기본 구조', status: '출원 완료' },
  { number: '청구항 3', title: '차량 하부 진입 메커니즘', status: '출원 완료' },
  { number: '청구항 5', title: '세대직입 엘리베이터 연동', status: '출원 완료' },
  { number: '청구항 9', title: '멀티 로봇 동선 충돌 방지', status: '출원 완료' },
  { number: '청구항 14', title: 'AI 최적 경로 알고리즘', status: '출원 완료' },
  { number: '청구항 21', title: '전기차 자동 충전 연동', status: '심사 중' },
  { number: '청구항 22', title: '교통약자 우선 배차 시스템', status: '출원 완료' },
  { number: '청구항 23', title: '세대직입 통합 주차 시스템', status: '출원 완료' },
];

const trustBadges = [
  {
    id: 'patent',
    icon: <VerifiedIcon sx={{ fontSize: 36 }} />,
    title: '세계 최초 특허 출원',
    subtitle: '청구항 23항',
    desc: '세대직입 자율주차로봇 발렛 시스템 세계 최초 출원',
    color: COLORS.GOLD,
  },
  {
    id: 'platform',
    icon: <EmojiEventsIcon sx={{ fontSize: 36 }} />,
    title: '통합 주차 플랫폼',
    subtitle: '3-Mode System',
    desc: '세대직입·공용발렛·자가주차를 하나로 통합한 유일한 시스템',
    color: '#f59e0b',
  },
  {
    id: 'ai-design',
    icon: <ScienceIcon sx={{ fontSize: 36 }} />,
    title: 'AI 기반 설계',
    subtitle: '자율이송 기술',
    desc: 'AI 최적 경로·충돌 방지·배차 알고리즘 특허 출원',
    color: COLORS.TECH_BLUE,
  },
  {
    id: 'market-apply',
    icon: <AccountTreeIcon sx={{ fontSize: 36 }} />,
    title: '다양한 시장 적용',
    subtitle: '즉시 도입 가능',
    desc: '아파트·오피스텔·빌딩·타운하우스·단독주택 등 적용 가능',
    color: '#10b981',
  },
];

export default function TrustSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { getImageUrl, refetch } = useSiteImages();

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const sectionBg = isDark
    ? `linear-gradient(180deg, ${COLORS.BG_SECONDARY} 0%, #0a0a0f 100%)`
    : `linear-gradient(180deg, #ede8da 0%, #f8f6f0 100%)`;

  const companyBoxBg = isDark
    ? `linear-gradient(135deg, rgba(201,168,76,0.06) 0%, ${COLORS.BG_ELEVATED} 100%)`
    : `linear-gradient(135deg, rgba(201,168,76,0.08) 0%, #ffffff 100%)`;

  const companyBoxBorder = isDark ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(158,127,48,0.25)';

  const statBoxBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const statBoxBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)';

  const badgeBg = isDark ? COLORS.BG_ELEVATED : '#ffffff';

  const patentBoxBg = isDark ? 'rgba(201,168,76,0.04)' : 'rgba(201,168,76,0.05)';
  const patentBoxBorder = isDark ? '1px solid rgba(201,168,76,0.1)' : '1px solid rgba(158,127,48,0.15)';
  const patentBoxHoverBg = isDark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.1)';
  const patentBoxHoverBorder = isDark ? 'rgba(201,168,76,0.3)' : 'rgba(158,127,48,0.35)';

  return (
    <Box
      id="trust"
      component="section"
      sx={{
        py: { xs: 6, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background pattern */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(ellipse 70% 50% at 50% 50%, rgba(201,168,76,0.03) 0%, transparent 70%)`,
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
            TRUST & CREDIBILITY
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
            특허 및{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              기술 신뢰성
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
            검증된 특허 기술과 지속적인 R&D 투자로 신뢰할 수 있는 파트너
          </Typography>
        </Box>

        {/* Company spotlight */}
        <Box
          sx={{
            mb: { xs: 6, md: 8 },
            p: { xs: 3, md: 5 },
            background: companyBoxBg,
            border: companyBoxBorder,
            borderRadius: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 4,
            alignItems: 'center',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.3s ease',
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${COLORS.GOLD_DARK}, ${COLORS.GOLD})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: `${glowAward} 3s ease-in-out infinite`,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    color: '#0a0a0f',
                  }}
                >
                  JH
                </Typography>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                  주식회사 제이에이치홀딩스
                </Typography>
                <Typography variant="caption" sx={{ color: goldColor, fontWeight: 600, fontSize: '0.7rem' }}>
                  JH Holdings Co., Ltd.
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 2 }}>
              스카이게러지(SkyGarage) ATR 자율이송주차로봇 및 세대직입 주차시스템을 출원한 기술 기업입니다.
              주거 환경의 혁신을 통해 모든 입주민의 삶의 질을 높이는 것을 목표로,
              세계 최초 특허 출원 기반 자율주차 솔루션을 개발하고 있습니다.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['특허 출원', '자율이송 기술', 'AI 설계', '다양한 시장'].map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    bgcolor: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.1)',
                    border: isDark ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(158,127,48,0.3)',
                    color: isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD_DARK,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    height: 26,
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Stats */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 2,
            }}
          >
            {[
              { icon: <VerifiedIcon />, val: '23항', label: '특허 청구항', color: goldColor },
              { icon: <GroupsIcon />, val: '7+', label: '적용 가능 시장', color: COLORS.TECH_BLUE },
              { icon: <TrendingUpIcon />, val: '100+', label: '목표 단지(1년)', color: '#10b981' },
              { icon: <ScienceIcon />, val: '8분', label: '처리 SLA', color: '#8b5cf6' },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  p: 2,
                  background: statBoxBg,
                  border: statBoxBorder,
                  borderRadius: 2,
                  textAlign: 'center',
                }}
              >
                <Box sx={{ color: item.color, mb: 0.5, '& svg': { fontSize: '1.5rem' } }}>
                  {item.icon}
                </Box>
                <Typography
                  sx={{
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: 900,
                    fontSize: '1.4rem',
                    color: item.color,
                    lineHeight: 1,
                    mb: 0.25,
                  }}
                >
                  {item.val}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Trust badges */}
        <Grid container spacing={3} sx={{ mb: { xs: 6, md: 8 } }}>
          {trustBadges.map((badge, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={badge.title}>
              <Box
                sx={{
                  textAlign: 'center',
                  background: badgeBg,
                  border: isDark ? `1px solid ${badge.color}20` : `1px solid ${badge.color}30`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:hover': {
                    border: `1px solid ${badge.color}50`,
                    transform: 'translateY(-4px)',
                    boxShadow: isDark
                      ? `0 0 30px ${badge.color}15`
                      : `0 8px 30px ${badge.color}20`,
                  },
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'none' : 'translateY(20px)',
                  transition: `all 0.6s ${0.2 + i * 0.1}s ease`,
                }}
              >
                <BadgeImageZone
                  slot={`trust-${badge.id}`}
                  position="top"
                  imageUrl={getImageUrl(`trust-${badge.id}-top`, '')}
                  onImageChange={refetch}
                  height={{ xs: 40, sm: 48, md: 56 }}
                />
                <Box sx={{ p: 3 }}>
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${badge.color}15 0%, transparent 70%)`,
                      border: `2px solid ${badge.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: badge.color,
                      mx: 'auto',
                      mb: 2,
                      animation: i === 0 ? `${glowAward} 3s ease-in-out infinite` : 'none',
                    }}
                  >
                    {badge.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.5 }}>
                    {badge.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: badge.color, fontWeight: 700, fontSize: '0.7rem', display: 'block', mb: 1 }}>
                    {badge.subtitle}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.5 }}>
                    {badge.desc}
                  </Typography>
                </Box>
                <BadgeImageZone
                  slot={`trust-${badge.id}`}
                  position="bottom"
                  imageUrl={getImageUrl(`trust-${badge.id}-bottom`, '')}
                  onImageChange={refetch}
                  height={{ xs: 36, sm: 44, md: 48 }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Patent list */}
        <Box
          sx={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.5s ease',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, fontSize: '1rem', color: goldColor }}>
            특허 출원 현황
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {patents.map((patent) => (
              <Box
                key={patent.number}
                sx={{
                  p: 2,
                  background: patentBoxBg,
                  border: patentBoxBorder,
                  borderRadius: 2,
                  '&:hover': {
                    background: patentBoxHoverBg,
                    borderColor: patentBoxHoverBorder,
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography
                    sx={{
                      fontFamily: '"Montserrat", sans-serif',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      color: goldColor,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {patent.number}
                  </Typography>
                  <Chip
                    label={patent.status}
                    size="small"
                    sx={{
                      bgcolor: patent.status === '출원 완료' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: patent.status === '출원 완료' ? '#10b981' : '#f59e0b',
                      fontSize: '0.6rem',
                      height: 18,
                      fontWeight: 700,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.78rem', lineHeight: 1.4, display: 'block' }}>
                  {patent.title}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
