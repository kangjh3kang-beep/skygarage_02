import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import GavelIcon from '@mui/icons-material/Gavel';
import DescriptionIcon from '@mui/icons-material/Description';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ApartmentIcon from '@mui/icons-material/Apartment';
import SecurityIcon from '@mui/icons-material/Security';
import MemoryIcon from '@mui/icons-material/Memory';
import RouteIcon from '@mui/icons-material/Route';

const patentSections = [
  {
    title: '발명의 명칭',
    content: 'ATR 자율이송로봇을 활용한 세대직입형 스마트 주차 시스템 및 그 운용 방법',
  },
  {
    title: '기술 분야',
    content:
      '본 발명은 자율주행 이송 로봇(ATR: Autonomous Transfer Robot)을 이용하여 공동주택 또는 상업용 건축물의 주차장에서 차량을 각 세대 전용 주차 공간까지 자동으로 이송하는 세대직입형 스마트 주차 시스템과 그 운용 방법에 관한 것이다. 특히, 지상 또는 지하 주차구역에서 차량을 인식·리프팅한 뒤, 전용 엘리베이터를 통해 각 층별 세대 주차룸까지 완전 무인 자동 배송하는 통합 주차 솔루션에 관한 것이다.',
  },
  {
    title: '배경 기술',
    content:
      '기존 공동주택 지하주차장은 입주민이 직접 차량을 운전하여 주차 공간을 찾아야 하며, 대단지 아파트의 경우 지하 2~5층까지 내려가야 하는 불편함이 존재한다. 기계식 주차설비는 주차 효율을 높이지만, 차량 손상 위험과 대기 시간 문제가 있다. 기존 발렛 주차 서비스는 인건비 부담과 차량 관리 책임 문제가 발생하며, 365일 24시간 안정적 운영이 어렵다. 이에 인건비 없이 24시간 무인 자동 운영이 가능하고, 입주민이 지하주차장에 내려갈 필요 없이 현관 앞에서 차량을 인수하는 혁신적 주차 방식이 요구되고 있다.',
  },
];

const inventionDetails = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 28 }} />,
    title: 'ATR 자율이송로봇 시스템',
    items: [
      'LiDAR, 비전 카메라, 초음파 센서를 융합한 다중 센서 인식 모듈을 통해 차량 위치, 크기, 형상을 실시간으로 정밀 감지하는 구성',
      '차량 하부로 슬라이딩 진입 후 유압식 멀티포인트 리프팅 메커니즘을 통해 최대 3.5톤 차량을 +/-2mm 정밀도로 들어올리는 리프팅 시스템',
      'SLAM(Simultaneous Localization and Mapping) 기반 실시간 위치 추적 및 최적 경로 계산 알고리즘',
      '장애물, 보행자, 기둥 등을 실시간으로 감지하고 동적으로 회피하는 자율주행 제어 모듈',
      '복수의 ATR 로봇 간 충돌 방지를 위한 중앙 제어 서버 연동 및 우선순위 스케줄링 시스템',
    ],
  },
  {
    icon: <ApartmentIcon sx={{ fontSize: 28 }} />,
    title: '세대직입 이송 경로 구성',
    items: [
      '지상 또는 지하 차량 인수 스테이션에서 ATR이 차량을 수령하고, 전용 카-엘리베이터에 자동 탑승하여 수직 이동하는 구성',
      '각 층별 세대 전용 주차룸(차량 1~2대 수용) 또는 현관 인접 주차 공간까지 수평 이동하여 정밀 주차 완료하는 공정',
      '차량 인수 시점부터 세대 주차 완료까지 전 과정을 SLA 8분 이내로 보장하는 시간 관리 체계',
      '세대 출차 요청 시 역순으로 ATR이 차량을 인수하여 지정된 출차 스테이션까지 자동 배송하는 환수 프로세스',
    ],
  },
  {
    icon: <PrecisionManufacturingIcon sx={{ fontSize: 28 }} />,
    title: '전용 카-엘리베이터 연동 시스템',
    items: [
      'ATR의 접근 신호를 수신하여 자동으로 해당 층에 대기하는 엘리베이터 호출 연동 프로토콜',
      '차량 탑재 상태의 ATR이 안전하게 탑승·하차할 수 있도록 설계된 대형 카 규격 및 하중 설계(최대 5톤 적재)',
      '복수 층 동시 요청 시 최적 배차를 수행하는 엘리베이터 스케줄링 알고리즘',
      '정전 또는 비상 상황 시 차량 안전 고정 및 비상 대피 모드 전환 메커니즘',
    ],
  },
  {
    icon: <MemoryIcon sx={{ fontSize: 28 }} />,
    title: '중앙 관제 및 AI 운영 시스템',
    items: [
      '전체 주차장 내 ATR 로봇 현황, 차량 위치, 엘리베이터 상태를 통합 모니터링하는 중앙 관제 대시보드',
      '입출차 패턴 학습을 통한 AI 기반 선제적 차량 배치(Pre-positioning) 알고리즘',
      '출퇴근 피크타임 예측 및 ATR 최적 배치를 위한 머신러닝 수요 예측 모델',
      '실시간 이상 감지 및 자동 긴급 정지, 관리자 알림 시스템',
      '입주민 모바일 앱 연동을 통한 입출차 예약, 실시간 위치 추적, 도착 알림 서비스',
    ],
  },
  {
    icon: <RouteIcon sx={{ fontSize: 28 }} />,
    title: '통합 주차 모드 운영',
    items: [
      '세대직입 주차, 공용주차장 자동 발렛, 자가 주차 등 복수의 주차 방식을 단일 플랫폼에서 통합 운영하는 구성',
      '입주민 선호도, 세대 유형, 시간대별 수요에 따라 최적의 주차 모드를 자동 배정하는 지능형 할당 엔진',
      '방문 차량에 대해 임시 주차 구역 자동 배정 및 시간 제한 관리 기능',
      '비상 차량(구급차, 소방차 등) 감지 시 자동 경로 확보 및 우선 처리 프로토콜',
    ],
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 28 }} />,
    title: '안전 및 보안 시스템',
    items: [
      '차량 리프팅 시 다단계 안전 잠금 장치 및 이중 센서 확인을 통한 낙하 방지 메커니즘',
      'ATR 이동 경로 상의 보행자 감지 시 즉시 정지 및 우회 경로 전환 기능',
      '각 세대 주차룸의 차량 도어락 연동 및 출입 인증(생체, 앱, 카드키) 보안 시스템',
      '24시간 CCTV 연동 및 이상행동 AI 감지를 통한 차량 도난·훼손 방지 체계',
      '정전, 화재, 지진 등 비상 상황별 시나리오에 따른 차량 안전 고정 및 대피 프로토콜',
    ],
  },
];

const effects = [
  '입주민이 지하주차장에 내려갈 필요 없이 현관 앞에서 차량을 인수할 수 있어 주거 편의성이 획기적으로 향상됨',
  '기존 주차장 대비 40% 이상의 주차 공간 효율 증가 달성 (통로 폭 축소, 주차 간격 최적화)',
  '24시간 365일 무인 자동 운영으로 인건비 절감 및 서비스 일관성 확보',
  '분양 시 차별화 포인트로 작용하여 분양가 프리미엄 및 높은 청약경쟁률 유도 가능',
  '차량 간 접촉 사고를 근본적으로 방지하여 주차장 내 사고율 제로에 가까운 수준으로 감소',
  '입출차 동선 단축 및 대기 시간 최소화로 출퇴근 시간 피크타임에도 SLA 8분 이내 보장',
  'AI 기반 수요 예측과 선제적 배치로 로봇 운영 효율 극대화 및 에너지 소비 최적화',
];

export default function PatentPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  return (
    <Box
      sx={{
        pt: { xs: 12, md: 14 },
        pb: { xs: 8, md: 12 },
        minHeight: 'calc(var(--vh, 1vh) * 100)',
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Chip
            icon={<GavelIcon sx={{ fontSize: 16 }} />}
            label="특허 출원 기술"
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
              fontWeight: 900,
              mb: 2,
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            스카이게러지 특허 기술 명세
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto', lineHeight: 1.8 }}>
            ATR 자율이송로봇 기반 세대직입 주차 시스템의 핵심 기술 구성과 효과를 상세히 기술합니다.
          </Typography>
        </Box>

        {/* Basic info sections */}
        {patentSections.map((section) => (
          <Card
            key={section.title}
            variant="outlined"
            sx={{
              mb: 3,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <DescriptionIcon sx={{ fontSize: 20, color: goldColor }} />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  {section.title}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ lineHeight: 2, color: 'text.secondary', pl: 4.5 }}>
                {section.content}
              </Typography>
            </CardContent>
          </Card>
        ))}

        <Divider sx={{ my: { xs: 4, md: 6 } }} />

        {/* Detailed invention description */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            mb: 4,
            fontSize: { xs: '1.3rem', md: '1.5rem' },
          }}
        >
          발명의 상세한 설명
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {inventionDetails.map((detail) => (
            <Card
              key={detail.title}
              variant="outlined"
              sx={{
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(158,127,48,0.06)',
                      color: goldColor,
                    }}
                  >
                    {detail.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    {detail.title}
                  </Typography>
                </Box>
                <Box component="ul" sx={{ pl: 2.5, m: 0, '& li': { mb: 1.5 } }}>
                  {detail.items.map((item, idx) => (
                    <Typography
                      key={idx}
                      component="li"
                      variant="body2"
                      sx={{ lineHeight: 1.8, color: 'text.secondary' }}
                    >
                      {item}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Divider sx={{ my: { xs: 4, md: 6 } }} />

        {/* Effects */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            mb: 4,
            fontSize: { xs: '1.3rem', md: '1.5rem' },
          }}
        >
          발명의 효과
        </Typography>

        <Card
          variant="outlined"
          sx={{
            borderColor: isDark ? 'rgba(201,168,76,0.2)' : 'rgba(158,127,48,0.15)',
            bgcolor: isDark ? 'rgba(201,168,76,0.03)' : 'rgba(158,127,48,0.02)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 2 } }}>
              {effects.map((effect, idx) => (
                <Typography
                  key={idx}
                  component="li"
                  variant="body2"
                  sx={{ lineHeight: 1.9, color: 'text.primary' }}
                >
                  {effect}
                </Typography>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Footer notice */}
        <Box sx={{ mt: 6, textAlign: 'center' }}>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
            본 문서는 주식회사 제이에이치홀딩스의 특허 출원 기술 내용을 기술한 것으로,
            무단 복제 및 도용을 금지합니다.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
