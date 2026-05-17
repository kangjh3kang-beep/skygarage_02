import { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import { useSiteImages } from '../hooks/useSiteImages';
import BadgeImageZone from './BadgeImageZone';
import HouseIcon from '@mui/icons-material/House';
import GppGoodIcon from '@mui/icons-material/GppGood';
import AccessibleIcon from '@mui/icons-material/Accessible';
import BoltIcon from '@mui/icons-material/Bolt';
import ConstructionIcon from '@mui/icons-material/Construction';
import NatureIcon from '@mui/icons-material/Park';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const benefits = [
  {
    id: 'convenience',
    icon: <HouseIcon sx={{ fontSize: 40 }} />,
    emoji: '🏠',
    title: '세대직입 편의성',
    subtitle: 'Door-to-Door Convenience',
    highlight: '현관 앞까지 차량 이송',
    description: '지하 3~5층 주차장을 내려갈 필요 없이, 차량이 현관 앞까지 직접 이송됩니다. 장바구니, 유모차, 어린이 동반 시에도 현관에서 바로 승하차.',
    details: [
      '야간 귀가 시 지하주차장 이동 불필요',
      '장바구니·대형 짐 운반 부담 제로',
      '앱 1탭으로 차량 호출/반납',
      '스마트워치·NFC 키 지원',
    ],
    color: COLORS.GOLD,
    gradient: 'rgba(201,168,76,0.06)',
    stat: '95%',
    statLabel: '입주민 만족도',
  },
  {
    id: 'security',
    icon: <GppGoodIcon sx={{ fontSize: 40 }} />,
    emoji: '🔒',
    title: '보안 강화',
    subtitle: 'Enhanced Security',
    highlight: '외부인 차량 접근 원천 차단',
    description: '모든 차량은 등록된 ATR 시스템을 통해서만 진입·이동이 가능합니다. 지하주차장 전체가 외부인 접근 불가 구역이 되어 보안 수준이 획기적으로 향상됩니다.',
    details: [
      '비등록 차량 자동 차단',
      '지하 보행자 동선 완전 분리',
      '24시간 AI CCTV 연동',
      '침입 감지 즉시 알림',
    ],
    color: '#10b981',
    gradient: 'rgba(16,185,129,0.06)',
    stat: '100%',
    statLabel: '외부 침입 차단율',
  },
  {
    id: 'universal',
    icon: <AccessibleIcon sx={{ fontSize: 40 }} />,
    emoji: '♿',
    title: '유니버설 디자인',
    subtitle: 'Universal Accessibility',
    highlight: '모든 입주민을 위한 설계',
    description: '노약자, 장애인, 임산부, 영유아 동반 가정이 지하주차장 경사로와 씨름할 필요가 없습니다. 우선 배차 설정으로 교통약자가 가장 먼저 서비스를 받습니다.',
    details: [
      '교통약자 우선 배차 시스템',
      '음성 명령 및 보조 기기 연동',
      '카시트·유모차 공간 자동 확보',
      '9개 언어 다국어 지원',
    ],
    color: '#f97316',
    gradient: 'rgba(249,115,22,0.06)',
    stat: '34%',
    statLabel: '교통약자 배려 대상',
  },
  {
    id: 'ev-charge',
    icon: <BoltIcon sx={{ fontSize: 40 }} />,
    emoji: '⚡',
    title: '전기차 충전 통합',
    subtitle: 'Integrated EV Charging',
    highlight: '주차 중 자동 충전',
    description: '주차 완료와 동시에 ATR이 충전 커넥터를 자동 연결합니다. 세대별 충전 사용량은 자동 정산되며, 최대 150kW 급속 충전 및 V2G 양방향 충전을 지원합니다.',
    details: [
      '자동 충전 커넥터 연결',
      '세대별 충전 사용량 자동 정산',
      '150kW 급속 충전 지원',
      'V2G 양방향 충전',
    ],
    color: COLORS.TECH_BLUE,
    gradient: 'rgba(59,130,246,0.06)',
    stat: '150kW',
    statLabel: '최대 충전 출력',
  },
  {
    id: 'space',
    icon: <ConstructionIcon sx={{ fontSize: 40 }} />,
    emoji: '🏗️',
    title: '공간 효율 극대화',
    subtitle: 'Space Optimization',
    highlight: '기존 대비 주차 공간 40% 증가',
    description: '차량 이동을 위한 경사로·회전 구간·전면 공간이 필요 없어 동일 면적에 40% 이상의 차량을 수용합니다. 남은 공간은 커뮤니티 시설·창고로 활용 가능합니다.',
    details: [
      '주차 공간 40% 이상 증가',
      '경사로 면적 제거로 비용 절감',
      '여유 공간 커뮤니티 활용',
      '층고 효율화로 건설비 절감',
    ],
    color: '#8b5cf6',
    gradient: 'rgba(139,92,246,0.06)',
    stat: '+40%',
    statLabel: '주차 공간 증가율',
  },
  {
    id: 'eco',
    icon: <NatureIcon sx={{ fontSize: 40 }} />,
    emoji: '🌿',
    title: '친환경 스마트시티',
    subtitle: 'Eco Smart City',
    highlight: '탄소 저감 및 에너지 효율화',
    description: '차량 배기가스가 지하에 머무는 시간이 대폭 감소하고, 태양광 연계 충전으로 탄소 발자국을 최소화합니다. 스마트시티 인증 및 ESG 점수 향상에 기여합니다.',
    details: [
      '지하 공기질 대폭 개선',
      '태양광 연계 친환경 충전',
      'ESG 스마트시티 인증 연계',
      '에너지 사용량 30% 절감',
    ],
    color: '#10b981',
    gradient: 'rgba(16,185,129,0.06)',
    stat: '-30%',
    statLabel: '에너지 사용 절감',
  },
];

export default function BenefitsSection() {
  const { ref, visible } = useIntersection();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { getImageUrl, refetch } = useSiteImages();

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const sectionBg = isDark
    ? `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.BG_SECONDARY} 50%, #0a0a0f 100%)`
    : `linear-gradient(180deg, #f8f6f0 0%, #ede8da 50%, #f8f6f0 100%)`;

  return (
    <Box
      id="benefits"
      component="section"
      sx={{
        py: { xs: 5, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background accent */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(ellipse 60% 40% at 50% 50%, rgba(201,168,76,0.03) 0%, transparent 70%)`,
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
            KEY BENEFITS
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
            6가지{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              핵심 가치
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
            카드를 클릭하면 상세 설명을 확인할 수 있습니다
          </Typography>
        </Box>

        {/* Benefits grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {benefits.map((benefit, i) => {
            const isExpanded = expandedIndex === i;
            return (
              <Card
                key={benefit.title}
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                sx={{
                  cursor: 'pointer',
                  height: 'fit-content',
                  background: isExpanded
                    ? `linear-gradient(135deg, ${benefit.gradient}, ${isDark ? COLORS.BG_ELEVATED : '#ffffff'})`
                    : (isDark ? COLORS.BG_ELEVATED : '#ffffff'),
                  border: isExpanded
                    ? `1px solid ${benefit.color}50`
                    : (isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'),
                  boxShadow: isExpanded ? `0 0 40px ${benefit.gradient}, 0 20px 60px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)'}` : 'none',
                  transform: isExpanded ? 'translateY(-4px)' : 'none',
                  '&:hover': {
                    border: `1px solid ${benefit.color}40`,
                    transform: 'translateY(-6px)',
                    boxShadow: `0 0 30px ${benefit.gradient}`,
                  },
                  opacity: visible ? 1 : 0,
                  transitionDelay: `${0.1 + i * 0.08}s`,
                }}
              >
                {/* Top image zone */}
              <BadgeImageZone
                slot={`benefit-${benefit.id}`}
                position="top"
                imageUrl={getImageUrl(`benefit-${benefit.id}-top`, '')}
                onImageChange={refetch}
                height={{ xs: 80, sm: 100, md: 120 }}
              />
              <CardContent sx={{ p: 3 }}>
                  {/* Top row: icon + stat */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box
                      sx={{
                        width: 68,
                        height: 68,
                        borderRadius: 2,
                        background: benefit.gradient,
                        border: `1px solid ${benefit.color}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: benefit.color,
                        transition: 'all 0.3s ease',
                        ...(isExpanded && { boxShadow: `0 0 20px ${benefit.gradient}` }),
                      }}
                    >
                      {benefit.icon}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        sx={{
                          fontFamily: '"Montserrat", sans-serif',
                          fontWeight: 900,
                          fontSize: '1.4rem',
                          color: benefit.color,
                          lineHeight: 1,
                        }}
                      >
                        {benefit.stat}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        {benefit.statLabel}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Title */}
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: '1rem' }}>
                    {benefit.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: benefit.color, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', mb: 1, display: 'block', opacity: 0.8 }}
                  >
                    {benefit.highlight}
                  </Typography>

                  {/* Description */}
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 1.5, fontSize: '0.83rem' }}>
                    {benefit.description}
                  </Typography>

                  {/* Expand indicator */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: benefit.color, fontSize: '0.68rem', fontWeight: 600 }}>
                      {isExpanded ? '접기' : '상세 보기'}
                    </Typography>
                    <ExpandMoreIcon
                      sx={{
                        fontSize: '0.9rem',
                        color: benefit.color,
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  </Box>

                  {/* Expanded details */}
                  <Collapse in={isExpanded}>
                    <Box
                      sx={{
                        mt: 2,
                        pt: 2,
                        borderTop: `1px solid ${benefit.color}20`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      {benefit.details.map((detail) => (
                        <Box key={detail} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <CheckCircleIcon
                            sx={{ fontSize: '0.9rem', color: benefit.color, mt: 0.2, flexShrink: 0 }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.8rem', lineHeight: 1.5 }}>
                            {detail}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </CardContent>
              {/* Bottom image zone */}
              <BadgeImageZone
                slot={`benefit-${benefit.id}`}
                position="bottom"
                imageUrl={getImageUrl(`benefit-${benefit.id}-bottom`, '')}
                onImageChange={refetch}
                height={{ xs: 72, sm: 88, md: 104 }}
              />
              </Card>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}
