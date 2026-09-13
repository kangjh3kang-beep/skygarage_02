import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';

import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import EngineeringIcon from '@mui/icons-material/Engineering';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HandymanIcon from '@mui/icons-material/Handyman';
import DomainAddIcon from '@mui/icons-material/DomainAdd';



interface ConsultingTrack {
  id: string;
  icon: React.ReactNode;
  accentIcon: React.ReactNode;
  chip: string;
  title: string;
  subtitle: string;
  description: string;
  steps: { label: string; detail: string }[];
  color: string;
  gradient: string;
}

const tracks: ConsultingTrack[] = [
  {
    id: 'existing',
    icon: <HomeWorkIcon sx={{ fontSize: 48 }} />,
    accentIcon: <HandymanIcon sx={{ fontSize: 20 }} />,
    chip: '기존 건축물',
    title: '리모델링 도입 컨설팅',
    subtitle: 'Retrofit Consulting',
    description:
      '이미 완공된 건축물에 차세대 모빌리티 주차 시스템을 도입합니다. 기존 지하주차장 구조를 분석하고, ATR 주행 동선·충전 인프라·엘리베이터 연동 가능 여부를 종합 진단하여 최적의 리모델링 설계안을 제안합니다.',
    steps: [
      { label: '현장 실측 및 구조 진단', detail: '지하주차장 도면·천장고·경사도·기둥 간격 등을 정밀 측정하고 ATR 운행 가능 여부를 판단합니다.' },
      { label: '도입 가능성 분석 보고', detail: '기존 설비와의 간섭 요소, 필요 공사 범위, 예상 도입 효과를 분석하여 보고서로 제공합니다.' },
      { label: '맞춤형 설계안 제안', detail: 'ATR 동선 배치, 디스패치 존 위치, 충전 인프라 배치를 포함한 리모델링 설계안을 제안합니다.' },
      { label: '시공 감리 및 시운전', detail: '시스템 설치 과정을 감리하고, 완공 후 시운전·검증을 통해 안정적 운영을 확인합니다.' },
    ],
    color: COLORS.TECH_BLUE,
    gradient: 'rgba(59,130,246,0.06)',
  },
  {
    id: 'new',
    icon: <ArchitectureIcon sx={{ fontSize: 48 }} />,
    accentIcon: <DomainAddIcon sx={{ fontSize: 20 }} />,
    chip: '신규 건축물',
    title: '설계 단계 통합 컨설팅',
    subtitle: 'New Build Consulting',
    description:
      '건축 설계 초기 단계부터 차세대 모빌리티 주차 시스템을 통합 설계합니다. 주차장 층고·동선·구조를 ATR 운영에 최적화하여, 준공 후 별도 공사 없이 바로 시스템을 가동할 수 있도록 지원합니다.',
    steps: [
      { label: '설계 초기 협업', detail: '건축사·구조 설계팀과 함께 지하주차장 평면, 층고, 진입로를 ATR 최적 규격으로 설계합니다.' },
      { label: '시스템 통합 설계', detail: 'ATR 운행 경로, 디스패치 플랫폼, 전용 엘리베이터, 충전 인프라를 건축 도면에 반영합니다.' },
      { label: '인허가 및 법규 지원', detail: '개정 주택법·주차장법에 따른 인허가 요건을 검토하고 필요 서류 작성을 지원합니다.' },
      { label: '준공 연동 및 가동', detail: '건물 준공과 동시에 시스템이 즉시 가동되도록 설치·시운전·운영 전환을 지원합니다.' },
    ],
    color: COLORS.GOLD,
    gradient: 'rgba(201,168,76,0.06)',
  },
];

const sharedBenefits = [
  '건축물 유형·규모에 맞는 맞춤형 시스템 제안',
  '도입 전후 주차 효율 비교 분석 제공',
  '전담 프로젝트 매니저 배정',
  '시운전 완료 후 운영 교육 및 유지보수 계약 연계',
];

export default function ConsultingSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const cardBg = isDark
    ? 'rgba(15,15,25,0.6)'
    : 'rgba(255,255,255,0.85)';
  const stepBg = isDark
    ? 'rgba(255,255,255,0.03)'
    : 'rgba(0,0,0,0.02)';

  return (
    <Box
      id="consulting"
      component="section"
      ref={ref}
      sx={{
        py: { xs: 8, md: 12 },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '100%',
          background: isDark
            ? `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 70%)`
            : `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(158,127,48,0.03) 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg">
        {/* Section header */}
        <Box
          sx={{
            textAlign: 'center',
            mb: { xs: 5, md: 7 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(30px)',
            transition: 'all 0.7s ease',
          }}
        >
          <Chip
            icon={<EngineeringIcon sx={{ fontSize: 16 }} />}
            label="도입 컨설팅"
            sx={{
              mb: 2,
              bgcolor: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.08)',
              color: goldColor,
              fontWeight: 700,
              fontSize: '0.75rem',
              border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(158,127,48,0.2)'}`,
            }}
          />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.6rem', md: '2.4rem' },
              mb: 1.5,
            }}
          >
            건축물 맞춤형{' '}
            <Box component="span" sx={{ color: goldColor }}>
              도입 컨설팅
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.8,
              fontSize: { xs: '0.9rem', md: '1rem' },
            }}
          >
            기존 건축물의 시스템 도입 리모델링부터 신규 건축물의 설계 단계 통합까지,
            <br />
            건물의 상황에 맞는 최적의 주차 시스템 도입 경로를 제안합니다.
          </Typography>
        </Box>

        {/* Two consulting tracks */}
        <Grid container spacing={{ xs: 3, md: 4 }}>
          {tracks.map((track, idx) => (
            <Grid size={{ xs: 12, md: 6 }} key={track.id}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  background: cardBg,
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  transition: 'all 0.4s ease',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'none' : 'translateY(30px)',
                  transitionDelay: `${idx * 0.15}s`,
                  overflow: 'visible',
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    border: `1px solid ${track.color}40`,
                    boxShadow: `0 12px 40px ${track.color}12`,
                  },
                }}
              >
                {/* Top accent bar */}
                <Box
                  sx={{
                    height: 3,
                    borderRadius: '12px 12px 0 0',
                    background: `linear-gradient(90deg, ${track.color} 0%, ${track.color}40 100%)`,
                  }}
                />

                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: track.gradient,
                        border: `1px solid ${track.color}20`,
                        color: track.color,
                        flexShrink: 0,
                      }}
                    >
                      {track.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Chip
                        icon={track.accentIcon as React.ReactElement}
                        label={track.chip}
                        size="small"
                        sx={{
                          mb: 1,
                          bgcolor: `${track.color}14`,
                          color: track.color,
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          border: `1px solid ${track.color}30`,
                          '& .MuiChip-icon': { color: track.color },
                        }}
                      />
                      <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.4rem' } }}>
                        {track.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                        {track.subtitle}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Description */}
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      lineHeight: 1.8,
                      mb: 3,
                      fontSize: '0.88rem',
                    }}
                  >
                    {track.description}
                  </Typography>

                  {/* Process steps */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {track.steps.map((step, sIdx) => (
                      <Box
                        key={sIdx}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: stepBg,
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: `${track.color}08`,
                            borderColor: `${track.color}20`,
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: `${track.color}18`,
                              color: track.color,
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {sIdx + 1}
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            {step.label}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.7, pl: 4 }}
                        >
                          {step.detail}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Shared benefits strip */}
        <Box
          sx={{
            mt: { xs: 5, md: 6 },
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            background: isDark
              ? 'rgba(201,168,76,0.04)'
              : 'rgba(158,127,48,0.03)',
            border: `1px solid ${isDark ? 'rgba(201,168,76,0.15)' : 'rgba(158,127,48,0.1)'}`,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.5s ease',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', textAlign: 'center' }}
          >
            <SettingsSuggestIcon sx={{ fontSize: 18, mr: 1, verticalAlign: 'text-bottom', color: goldColor }} />
            공통 지원 사항
          </Typography>
          <Grid container spacing={2}>
            {sharedBenefits.map((item, i) => (
              <Grid size={{ xs: 12, sm: 6 }} key={i}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <CheckCircleOutlineIcon
                    sx={{ fontSize: 18, color: goldColor, mt: 0.3, flexShrink: 0 }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', lineHeight: 1.6 }}>
                    {item}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* CTA */}
        <Box
          sx={{
            textAlign: 'center',
            mt: { xs: 5, md: 6 },
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.6s ease',
          }}
        >
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            sx={{
              px: 5,
              py: 1.75,
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: 2,
            }}
          >
            도입 상담 신청하기
          </Button>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 1.5, color: 'text.secondary', fontSize: '0.75rem' }}
          >
            현장 방문 진단은 무료로 제공됩니다
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
