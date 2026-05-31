import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import { CITY_SKYLINE } from '../constants/images';
import { useSiteImages } from '../hooks/useSiteImages';
import ImageEditOverlay from './ImageEditOverlay';
import BadgeImageZone from './BadgeImageZone';
import ApartmentIcon from '@mui/icons-material/Apartment';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import BusinessIcon from '@mui/icons-material/Business';
import FactoryIcon from '@mui/icons-material/Factory';
import HolidayVillageIcon from '@mui/icons-material/HolidayVillage';
import DomainIcon from '@mui/icons-material/Domain';
import HomeIcon from '@mui/icons-material/Home';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

function useCountUp(target: number, duration: number, active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return count;
}

const markets = [
  {
    id: 'premium-apt',
    icon: <ApartmentIcon sx={{ fontSize: 36 }} />,
    title: '고급 아파트 / 주상복합',
    subtitle: 'Premium Apartment',
    summary: '300~3,000세대 규모 공동주택에 최적화된 솔루션',
    description: '300~3,000세대 규모 공동주택. 분양가 차별화 포인트, 입주민 편의 극대화, 관리비 절감 효과로 시행사·시공사의 선호도가 가장 높습니다.',
    kpis: [
      { label: '적용 단지 규모', value: '300~3,000세대' },
      { label: 'ROI 회수 기간', value: '약 8~12년' },
      { label: '분양가 프리미엄', value: '약 5~8%' },
    ],
    benefits: [
      '분양 시 프리미엄 마케팅 포인트',
      '입주민 만족도 향상으로 민원 감소',
      '기존 평면 주차 대비 3배 공간 효율',
      '관리비 절감 및 추가 수익 창출 가능',
    ],
    color: COLORS.GOLD,
    gradient: 'rgba(201,168,76,0.06)',
  },
  {
    id: 'officetel',
    icon: <MeetingRoomIcon sx={{ fontSize: 36 }} />,
    title: '오피스텔',
    subtitle: 'Officetel',
    summary: '1인·2인 가구 중심 차별화 임대 수익 극대화',
    description: '1인·2인 가구 중심. 게스트 임시 주차, 단기 임대 차량 관리, 여성 입주자 야간 안전 동선 확보로 수익률 향상과 차별화를 동시에 달성합니다.',
    kpis: [
      { label: '적용 단지 규모', value: '100~1,000실' },
      { label: '임대료 프리미엄', value: '약 10~15%' },
      { label: '공실률 감소', value: '약 30%' },
    ],
    benefits: [
      '여성 입주자 야간 안전 동선 확보',
      '게스트 임시 주차 자동 관리',
      '단기 임대 차량 원격 관리',
      '임대 수익률 극대화',
    ],
    color: COLORS.TECH_BLUE,
    gradient: 'rgba(59,130,246,0.06)',
  },
  {
    id: 'smart-building',
    icon: <BusinessIcon sx={{ fontSize: 36 }} />,
    title: '스마트 빌딩 / 주상복합',
    subtitle: 'Smart Building',
    summary: '주거+상업 복합 건물 가치 극대화 솔루션',
    description: '주거+상업 복합 건물. 거주자·방문객 권한을 자동 분리하고, 방문객 유료 주차 수익 창출, 물류 배송 차량 자동 관리로 건물 가치를 극대화합니다.',
    kpis: [
      { label: '방문객 주차 수익', value: '연 5,000만~3억' },
      { label: '상업 면적 증가', value: '약 15%' },
      { label: '건물 가치 상승', value: '약 10%' },
    ],
    benefits: [
      '거주자·방문객 권한 자동 분리',
      '방문객 유료 주차로 추가 수익',
      '물류 배송 차량 자동 관리',
      '상업 면적 확보로 임대 수익 증대',
    ],
    color: '#10b981',
    gradient: 'rgba(16,185,129,0.06)',
  },
  {
    id: 'industrial',
    icon: <FactoryIcon sx={{ fontSize: 36 }} />,
    title: '지식산업센터',
    subtitle: 'Industrial Complex',
    summary: '입주 기업 배차 최적화 및 복합 수익화 모델',
    description: '입주 기업 단위 차량 풀 관리, 미팅 일정 연동 배차, 외부 방문객 유료 공유로 복합 수익화. 전기 물류차 충전 거점으로도 활용 가능합니다.',
    kpis: [
      { label: '기업 배차 최적화', value: '30% 효율 향상' },
      { label: '외부 공유 수익', value: '연 1~5억' },
      { label: 'EV 충전 수익', value: '연 3,000만~1억' },
    ],
    benefits: [
      '입주 기업 차량 풀 통합 관리',
      '미팅 일정 연동 자동 배차',
      '외부 방문객 유료 공유 수익',
      'EV 충전 거점 활용 가능',
    ],
    color: '#8b5cf6',
    gradient: 'rgba(139,92,246,0.06)',
  },
  {
    id: 'townhouse',
    icon: <HolidayVillageIcon sx={{ fontSize: 36 }} />,
    title: '타운하우스 / 연립주택',
    subtitle: 'Townhouse',
    summary: '소규모 공동주거 단지에 맞춤화된 주차 솔루션',
    description: '20~100세대 규모의 타운하우스·연립주택 단지에 적용. 제한된 부지 내 주차 공간을 극대화하고, 세대별 전용 주차 공간을 확보하여 프리미엄 주거 가치를 높입니다.',
    kpis: [
      { label: '적용 단지 규모', value: '20~100세대' },
      { label: '주차 공간 증가', value: '약 40~60%' },
      { label: '분양 프리미엄', value: '약 8~12%' },
    ],
    benefits: [
      '제한된 부지 내 주차공간 극대화',
      '세대별 전용 주차 공간 확보',
      '프리미엄 주거 브랜드 가치 상승',
      '소규모 단지 맞춤형 시스템 구성',
    ],
    color: '#059669',
    gradient: 'rgba(5,150,105,0.06)',
  },
  {
    id: 'commercial',
    icon: <DomainIcon sx={{ fontSize: 36 }} />,
    title: '상업용 빌딩',
    subtitle: 'Commercial Building',
    summary: '오피스·상업시설 방문객 주차 자동화 및 수익 창출',
    description: '대형 오피스빌딩·쇼핑몰·병원 등 방문객이 많은 상업시설에 적용. 무인 발렛 서비스로 고객 경험을 향상시키고, 유료 주차 운영으로 추가 수익을 창출합니다.',
    kpis: [
      { label: '방문객 회전율', value: '약 35% 향상' },
      { label: '유료 주차 수익', value: '연 3~10억' },
      { label: '고객 만족도', value: '약 40% 향상' },
    ],
    benefits: [
      '무인 발렛으로 VIP 고객 경험 제공',
      '주차 공간 회전율 극대화',
      '유료 주차 자동 정산 시스템',
      '피크 타임 대기시간 최소화',
    ],
    color: '#0891b2',
    gradient: 'rgba(8,145,178,0.06)',
  },
  {
    id: 'private-home',
    icon: <HomeIcon sx={{ fontSize: 36 }} />,
    title: '단독주택 / 고급 주거',
    subtitle: 'Private Residence',
    summary: '개인 주택 맞춤형 스마트 주차 시스템',
    description: '고급 단독주택·전원주택에 설치 가능한 개인 맞춤형 솔루션. 한정된 대지 내 다수 차량 보관, 원격 호출, 보안 연동으로 프라이빗 주차 경험을 제공합니다.',
    kpis: [
      { label: '차량 보관 용량', value: '2~6대' },
      { label: '출차 소요시간', value: '약 2분 이내' },
      { label: '부지 절감 효과', value: '약 50%' },
    ],
    benefits: [
      '한정된 대지 내 다수 차량 보관',
      '앱 기반 원격 차량 호출',
      '보안 시스템 연동 (CCTV·센서)',
      '프라이빗 주차 경험 제공',
    ],
    color: '#d97706',
    gradient: 'rgba(217,119,6,0.06)',
  },
];

const marketStats = [
  { target: 1780, suffix: '억원', label: '국내 주차난 연간 사회적 비용' },
  { target: 27000, suffix: '개', label: '연간 신규 공동주택 단지 수' },
  { target: 40, suffix: '%', label: '전기차 보급 예상 증가율(5년)' },
  { target: 6, suffix: '조원', label: '스마트 주차 시장 규모(2030)' },
];

export default function MarketSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState<string | false>(false);
  const { getImageUrl, refetch } = useSiteImages();

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const count0 = useCountUp(marketStats[0].target, 2000, visible);
  const count1 = useCountUp(marketStats[1].target, 2000, visible);
  const count2 = useCountUp(marketStats[2].target, 1500, visible);
  const count3 = useCountUp(marketStats[3].target, 1500, visible);
  const counts = [count0, count1, count2, count3];

  const handleAccordionChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box
      id="market"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        background: isDark
          ? `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.BG_SECONDARY} 100%)`
          : `linear-gradient(180deg, #f8f6f0 0%, #ede8da 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 10% 80%, rgba(201,168,76,0.04) 0%, transparent 40%),
            radial-gradient(circle at 90% 20%, rgba(59,130,246,0.04) 0%, transparent 40%)
          `,
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
            TARGET MARKET
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
            다양한{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              적용 시장
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
            아파트부터 타운하우스·빌딩·단독주택까지 — 각 시장을 클릭하여 상세 정보를 확인하세요
          </Typography>
        </Box>

        {/* Market stats (countup) */}
        <ImageEditOverlay
          slot="market-background"
          label="시장 섹션 배경"
          currentUrl={getImageUrl('market-background', '')}
          onImageChange={refetch}
        >
        <Box
          sx={{
            position: 'relative',
            borderRadius: 4,
            overflow: 'hidden',
            mb: { xs: 6, md: 8 },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${getImageUrl('market-background', CITY_SKYLINE)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <Box sx={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)' }} />
          <Box
            sx={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 0,
            }}
          >
            {marketStats.map((stat, i) => (
              <Box
                key={stat.label}
                sx={{
                  textAlign: 'center',
                  p: { xs: 3, md: 4 },
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  borderBottom: { xs: i < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none', md: 'none' },
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'none' : 'translateY(20px)',
                  transition: `all 0.6s ${0.2 + i * 0.1}s ease`,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: 900,
                    fontSize: { xs: '1.6rem', md: '2.4rem' },
                    color: goldLight,
                    lineHeight: 1,
                    mb: 0.5,
                    textShadow: `0 0 30px ${goldColor}80`,
                  }}
                >
                  {counts[i].toLocaleString('ko-KR')}
                  <Box component="span" sx={{ fontSize: { xs: '1rem', md: '1.3rem' } }}>
                    {stat.suffix}
                  </Box>
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', lineHeight: 1.4, display: 'block' }}>
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        </ImageEditOverlay>

        {/* Expandable Market Accordions */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(30px)',
            transition: 'all 0.6s 0.3s ease',
          }}
        >
          {markets.map((market) => (
            <Box key={market.subtitle} sx={{ display: 'flex', flexDirection: 'column' }}>
              <BadgeImageZone
                slot={`market-${market.id}`}
                position="top"
                imageUrl={getImageUrl(`market-${market.id}-top`, '')}
                onImageChange={refetch}
                height={{ xs: 40, sm: 48, md: 56 }}
              />
            <Accordion
              expanded={expanded === market.subtitle}
              onChange={handleAccordionChange(market.subtitle)}
              disableGutters
              sx={{
                background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                border: expanded === market.subtitle
                  ? `1px solid ${market.color}60`
                  : isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                borderLeft: `4px solid ${market.color}`,
                borderRadius: '12px !important',
                overflow: 'hidden',
                transition: theme.transitions.create(['border-color', 'box-shadow'], {
                  duration: theme.transitions.duration.standard,
                }),
                '&:before': { display: 'none' },
                '&:hover': {
                  borderColor: `${market.color}40`,
                  boxShadow: `0 4px 20px ${market.color}15`,
                },
                ...(expanded === market.subtitle && {
                  boxShadow: `0 8px 32px ${market.color}20`,
                }),
              }}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMoreIcon sx={{ color: market.color, fontSize: 28 }} />
                }
                aria-controls={`${market.subtitle}-content`}
                id={`${market.subtitle}-header`}
                sx={{
                  px: { xs: 2.5, md: 3.5 },
                  py: { xs: 1.5, md: 2 },
                  '& .MuiAccordionSummary-content': { gap: 2, alignItems: 'center' },
                }}
              >
                <Box
                  sx={{
                    width: { xs: 48, md: 56 },
                    height: { xs: 48, md: 56 },
                    borderRadius: 2,
                    background: market.gradient,
                    border: `1px solid ${market.color}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: market.color,
                    flexShrink: 0,
                  }}
                >
                  {market.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', md: '1.1rem' } }}>
                      {market.title}
                    </Typography>
                    <Chip
                      label={market.subtitle}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: `${market.color}15`,
                        color: market.color,
                        border: `1px solid ${market.color}30`,
                      }}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.82rem',
                      mt: 0.5,
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {market.summary}
                  </Typography>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ px: { xs: 2.5, md: 3.5 }, pb: 3 }}>
                <Box
                  sx={{
                    pt: 1,
                    borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 3, fontSize: '0.88rem' }}>
                    {market.description}
                  </Typography>

                  <Grid container spacing={3}>
                    {/* KPIs */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: market.color, fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                        핵심 지표
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {market.kpis.map((kpi) => (
                          <Box
                            key={kpi.label}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              py: 1,
                              px: 2,
                              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 1.5,
                              border: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                              {kpi.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: market.color,
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                fontFamily: '"Montserrat", sans-serif',
                              }}
                            >
                              {kpi.value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Grid>

                    {/* Benefits */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: market.color, fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                        주요 장점
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {market.benefits.map((benefit) => (
                          <Box
                            key={benefit}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                          >
                            <CheckCircleIcon sx={{ fontSize: 18, color: market.color, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ fontSize: '0.83rem', color: 'text.secondary' }}>
                              {benefit}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </AccordionDetails>
            </Accordion>
              <BadgeImageZone
                slot={`market-${market.id}`}
                position="bottom"
                imageUrl={getImageUrl(`market-${market.id}-bottom`, '')}
                onImageChange={refetch}
                height={{ xs: 36, sm: 44, md: 48 }}
              />
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
