import { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import { MARKET_BUILDINGS, ATR_CAR } from '../constants/images';
import { useSiteImages } from '../hooks/useSiteImages';
import ImageEditOverlay from './ImageEditOverlay';
import BadgeImageZone from './BadgeImageZone';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import HouseIcon from '@mui/icons-material/House';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BoltIcon from '@mui/icons-material/Bolt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const features = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 36 }} />,
    number: '01',
    title: '자율 주행 및 차량 감지',
    subtitle: 'Autonomous Navigation',
    description: 'LiDAR, 카메라, 초음파 센서 융합으로 차량 위치와 크기를 정밀 인식. 주차장 내 장애물, 보행자, 기둥을 실시간 회피하며 최적 경로로 이동합니다.',
    tags: ['LiDAR', 'Computer Vision', 'SLAM'],
    color: COLORS.GOLD,
    gradient: 'rgba(201,168,76,0.08)',
  },
  {
    icon: <PrecisionManufacturingIcon sx={{ fontSize: 36 }} />,
    number: '02',
    title: '정밀 리프팅 및 이송',
    subtitle: 'Precision Lifting System',
    description: '차량 하부로 슬라이딩 진입 후 유압식 멀티포인트 리프팅. 소형차부터 대형 SUV까지 최대 3.5톤 무게를 +/-2mm 정밀도로 안정적으로 들어올립니다.',
    tags: ['Hydraulic Lift', '+/-2mm 정밀도', '3.5t 지원'],
    color: COLORS.TECH_BLUE,
    gradient: 'rgba(59,130,246,0.08)',
  },
  {
    icon: <HouseIcon sx={{ fontSize: 36 }} />,
    number: '03',
    title: '세대 직접 배송',
    subtitle: 'Door-to-Door Parking',
    description: '전용 엘리베이터와 완벽 연동하여 수직 이동 후 각 세대 층의 전용 주차 공간 또는 현관 앞에 정확히 주차 완료. 입주민이 지하에 내려올 필요가 없습니다.',
    tags: ['엘리베이터 연동', '층별 이송', '현관 직배'],
    color: '#10b981',
    gradient: 'rgba(16,185,129,0.08)',
  },
  {
    icon: <PsychologyIcon sx={{ fontSize: 36 }} />,
    number: '04',
    title: 'AI 기반 최적 경로',
    subtitle: 'AI Route Optimization',
    description: '실시간 주차장 점유 현황, 다수 ATR 동선 충돌 방지, 우선순위 배차(교통약자·예약)를 AI가 통합 계산하여 평균 처리시간 최소화.',
    tags: ['Multi-Robot', 'Priority Queue', 'AI Scheduling'],
    color: '#8b5cf6',
    gradient: 'rgba(139,92,246,0.08)',
  },
  {
    icon: <BoltIcon sx={{ fontSize: 36 }} />,
    number: '05',
    title: '전기차 자동 충전',
    subtitle: 'Auto EV Charging',
    description: '주차 과정 중 자동 충전 커넥터 연결. 세대별 충전 사용량 정산 시스템 내장. 최대 150kW 급속 충전 모듈 탑재 가능하며 V2G 양방향 충전도 지원합니다.',
    tags: ['Auto Connect', '150kW 급속', 'V2G 지원'],
    color: '#f59e0b',
    gradient: 'rgba(245,158,11,0.08)',
  },
  {
    icon: <AccessTimeIcon sx={{ fontSize: 36 }} />,
    number: '06',
    title: '24시간 무인 운영',
    subtitle: '24/7 Unmanned Operation',
    description: '원격 관제센터와 실시간 연동, 예외상황 자동 대응, OTA 펌웨어 업데이트. 정기 유지보수 외 별도 상주 인력이 필요 없어 관리비를 대폭 절감합니다.',
    tags: ['원격 관제', 'OTA 업데이트', '자동 복구'],
    color: '#06b6d4',
    gradient: 'rgba(6,182,212,0.08)',
  },
];

const performanceStats = [
  { value: '3.5톤', label: '최대 적재 중량' },
  { value: '≤8분', label: '세대 도착 SLA' },
  { value: '+/-2mm', label: '주차 정밀도' },
];

export default function ATRSection() {
  const { ref, visible } = useIntersection();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { getImageUrl, getObjectPosition, getImageScale, refetch } = useSiteImages();

  const marketSegments = [
    {
      title: '공동주택',
      slot: 'market-apartment',
      label: '시장 - 공동주택',
      image: getImageUrl('market-apartment', MARKET_BUILDINGS.apartment),
      features: [
        { left: '대형 아파트 단지', right: '300~3,000세대 규모' },
      ],
      benefits: ['스마트 주차 시스템 완벽 적용', '분양가 프리미엄 효과'],
    },
    {
      title: '오피스텔',
      slot: 'market-officetel',
      label: '시장 - 오피스텔',
      image: getImageUrl('market-officetel', MARKET_BUILDINGS.officetel),
      features: [
        { left: '도심 오피스텔', right: '소형 주차공간 최적화' },
      ],
      benefits: ['스마트 발렛 주차 서비스', '주차 효율 40% 향상'],
    },
    {
      title: '주상복합, 지산센터',
      slot: 'market-mixed',
      label: '시장 - 주상복합',
      image: getImageUrl('market-mixed', MARKET_BUILDINGS.mixedUse),
      features: [
        { left: '복합 건축물', right: '다용도 주차 관리' },
      ],
      benefits: ['스마트 구역별 자동 배차', '저비용 무인 관리 운영'],
    },
  ];

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const sectionBg = isDark
    ? `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.BG_SECONDARY} 100%)`
    : `linear-gradient(180deg, #f8f6f0 0%, #ede8da 100%)`;

  return (
    <Box
      id="technology"
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
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(59,130,246,0.04) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(201,168,76,0.04) 0%, transparent 40%)
          `,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" ref={ref}>
        {/* Header - Rotation feature */}
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' },
              fontWeight: 700,
              mb: 2,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s ease',
            }}
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
              360° 자유 회전
            </Box>
            {' '}능력을 갖추고
            <br />
            완벽한 제어
          </Typography>
        </Box>

        {/* Car rotation visual */}
        <ImageEditOverlay
          slot="technology-visual"
          label="ATR 기술 비주얼"
          currentUrl={getImageUrl('technology-visual', '')}
          onImageChange={refetch}
        >
          <Box
            sx={{
              mb: { xs: 4, md: 6 },
              position: 'relative',
              borderRadius: 4,
              overflow: 'hidden',
              height: { xs: 220, sm: 300, md: 380 },
              border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
              boxShadow: `0 24px 80px rgba(0,0,0,0.3)`,
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.8s 0.2s ease',
            }}
          >
            <Box
              component="img"
              src={getImageUrl('technology-visual', ATR_CAR)}
              alt="ATR 자율이송주차로봇 차체 회전 기술"
              loading="lazy"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: getObjectPosition('technology-visual'),
                transform: getImageScale('technology-visual') > 100 ? `scale(${getImageScale('technology-visual') / 100})` : undefined,
                transformOrigin: getObjectPosition('technology-visual'),
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,10,30,0.3) 50%, rgba(0,0,0,0.6) 100%)'
                  : 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,10,30,0.15) 50%, rgba(0,0,0,0.4) 100%)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  width: { xs: 160, sm: 200, md: 240 },
                  height: { xs: 160, sm: 200, md: 240 },
                  borderRadius: '50%',
                  border: `2px solid ${isDark ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.5)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: `conic-gradient(from 0deg, rgba(59,130,246,0.3) 0deg, rgba(59,130,246,0.1) 90deg, transparent 90deg, transparent 270deg, rgba(59,130,246,0.1) 270deg, rgba(59,130,246,0.3) 360deg)`,
                  }}
                />
                <Typography
                  sx={{
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: 900,
                    fontSize: { xs: '1.2rem', md: '1.6rem' },
                    color: '#ffffff',
                    textAlign: 'center',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  }}
                >
                  360° 자유 회전
                </Typography>
              </Box>
            </Box>
          </Box>
        </ImageEditOverlay>

        {/* Performance stats */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 2,
            mb: { xs: 6, md: 8 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s 0.3s ease',
          }}
        >
          {performanceStats.map((stat) => (
            <Box key={stat.value} sx={{ textAlign: 'center' }}>
              <Typography
                sx={{
                  fontFamily: '"Montserrat", sans-serif',
                  fontWeight: 900,
                  fontSize: { xs: '1.3rem', sm: '1.6rem', md: '2rem' },
                  color: isDark ? '#ffffff' : '#1a1a2e',
                  mb: 0.5,
                }}
              >
                {stat.value}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Market segment cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 3,
            mb: { xs: 8, md: 12 },
          }}
        >
          {marketSegments.map((segment, i) => (
            <Card
              key={segment.title}
              sx={{
                height: '100%',
                background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                borderRadius: 3,
                opacity: visible ? 1 : 0,
                transitionDelay: `${0.4 + i * 0.1}s`,
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.4)' : '0 20px 60px rgba(0,0,0,0.1)',
                },
              }}
            >
              <ImageEditOverlay
                slot={segment.slot}
                label={segment.label}
                currentUrl={getImageUrl(segment.slot, '')}
                onImageChange={refetch}
              >
                <Box
                  sx={{
                    height: 140,
                    position: 'relative',
                    overflow: 'hidden',
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)',
                  }}
                >
                  <Box
                    component="img"
                    src={segment.image}
                    alt={`${segment.title} 적용 사례`}
                    loading="lazy"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: getObjectPosition(segment.slot),
                      transition: 'transform 0.4s ease',
                      transform: getImageScale(segment.slot) > 100 ? `scale(${getImageScale(segment.slot) / 100})` : undefined,
                      transformOrigin: getObjectPosition(segment.slot),
                      '&:hover': { transform: `scale(${Math.max(1.05, (getImageScale(segment.slot) || 100) / 100 * 1.05)})` },
                    }}
                  />
                </Box>
              </ImageEditOverlay>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 2, textAlign: 'center' }}>
                  {segment.title}
                </Typography>
                {segment.features.map((feat, fi) => (
                  <Box
                    key={fi}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 0.75,
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {feat.left}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {feat.right}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {segment.benefits.map((benefit) => (
                    <Box
                      key={benefit}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        background: isDark ? 'rgba(201,168,76,0.05)' : 'rgba(201,168,76,0.06)',
                        border: `1px solid ${isDark ? 'rgba(201,168,76,0.12)' : 'rgba(158,127,48,0.15)'}`,
                        borderRadius: 1.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD_DARK, fontSize: '0.72rem', fontWeight: 600 }}
                      >
                        {benefit}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Core Technology Section */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
          <Typography
            variant="overline"
            sx={{
              color: COLORS.TECH_BLUE,
              letterSpacing: '0.2em',
              fontSize: '0.7rem',
              mb: 2,
              display: 'block',
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          >
            CORE TECHNOLOGY
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
            ATR{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              자율이송주차로봇
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 560,
              mx: 'auto',
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.2s ease',
            }}
          >
            Autonomous Transfer Robot — 주차 산업을 재정의하는 6가지 핵심 기술 모듈
          </Typography>
        </Box>

        {/* Feature cards grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {features.map((feat, i) => (
            <Card
              key={feat.title}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              sx={{
                height: '100%',
                background: hoveredIndex === i
                  ? `linear-gradient(135deg, ${feat.gradient}, ${isDark ? COLORS.BG_ELEVATED : '#ffffff'})`
                  : (isDark ? COLORS.BG_ELEVATED : '#ffffff'),
                border: hoveredIndex === i ? `1px solid ${feat.color}60` : (isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)'),
                boxShadow: hoveredIndex === i ? `0 0 30px ${feat.gradient}, 0 20px 60px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}` : 'none',
                transform: hoveredIndex === i ? 'translateY(-6px)' : 'none',
                opacity: visible ? 1 : 0,
                transitionDelay: `${0.1 + i * 0.07}s`,
              }}
            >
              {/* Top image zone */}
              <BadgeImageZone
                slot={`atr-feat-${feat.number}`}
                position="top"
                imageUrl={getImageUrl(`atr-feat-${feat.number}-top`, '')}
                onImageChange={refetch}
                height={{ xs: 48, sm: 56, md: 64 }}
              />
              <CardContent sx={{ p: 3 }}>
                <Typography
                  sx={{
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: 900,
                    fontSize: '0.7rem',
                    color: feat.color,
                    opacity: 0.5,
                    letterSpacing: '0.1em',
                    mb: 2,
                  }}
                >
                  {feat.number}
                </Typography>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: 2,
                    background: feat.gradient,
                    border: `1px solid ${feat.color}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: feat.color,
                    mb: 2.5,
                  }}
                >
                  {feat.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.95rem' }}>
                  {feat.title}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: feat.color, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', mb: 1.5, display: 'block', opacity: 0.8 }}
                >
                  {feat.subtitle}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2.5, fontSize: '0.83rem' }}>
                  {feat.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {feat.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        bgcolor: `${feat.color}15`,
                        color: feat.color,
                        border: `1px solid ${feat.color}30`,
                        fontSize: '0.65rem',
                        height: 22,
                        fontWeight: 600,
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
              {/* Bottom image zone */}
              <BadgeImageZone
                slot={`atr-feat-${feat.number}`}
                position="bottom"
                imageUrl={getImageUrl(`atr-feat-${feat.number}-bottom`, '')}
                onImageChange={refetch}
                height={{ xs: 40, sm: 48, md: 56 }}
              />
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
