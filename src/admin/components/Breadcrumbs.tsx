import { useMemo } from 'react';
import Box from '@mui/material/Box';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import { useLocation, useNavigate } from 'react-router-dom';

const ROUTE_LABELS: Record<string, string> = {
  admin: 'Dashboard',
  complexes: '단지 관리',
  residents: '사용자',
  parking: '주차 운영',
  atr: 'ATR 로봇',
  elevators: '엘리베이터',
  energy: '에너지',
  contracts: '계약',
  billing: '청구',
  crm: 'CRM',
  noc: 'NOC',
  analytics: '분석',
  security: '보안 감사',
  ai: 'AI Agent',
  'ai-management': 'AI 관리',
  users: '사용자',
  team: '팀원',
  access: '출입',
  notifications: '알림',
  maintenance: '정비',
  tickets: '티켓',
  alerts: '알림 센터',
  observability: '관측성',
  esg: 'ESG',
  partners: '파트너',
  inquiries: '문의',
  images: '이미지',
  media: '미디어',
  operations: '운영',
  system: '시스템',
  safety: '안전',
  projects: '프로젝트',
  regions: '지역 허브',
  zones: '존 콘솔',
  workflows: '워크플로',
  v2g: 'V2G',
  events: '이벤트 로그',
  activity: '활동 로그',
  revenue: '매출',
  patents: '특허',
  licenses: '라이선스',
  settings: '설정',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();

  const crumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return [];

    return segments.slice(1).map((seg, idx) => {
      const path = '/' + segments.slice(0, idx + 2).join('/');
      const label = ROUTE_LABELS[seg] || seg;
      const isLast = idx === segments.length - 2;
      return { label, path, isLast };
    });
  }, [location.pathname]);

  if (crumbs.length === 0) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      <MuiBreadcrumbs
        separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
        sx={{ '& .MuiBreadcrumbs-separator': { mx: 0.5 } }}
      >
        <Link
          underline="hover"
          color="text.secondary"
          onClick={() => navigate('/admin')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', fontSize: '0.75rem' }}
        >
          <HomeIcon sx={{ fontSize: 14 }} />
        </Link>
        {crumbs.map(crumb => (
          crumb.isLast ? (
            <Typography key={crumb.path} variant="caption" color="text.primary" sx={{ fontWeight: 600 }}>
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={crumb.path}
              underline="hover"
              color="text.secondary"
              onClick={() => navigate(crumb.path)}
              sx={{ cursor: 'pointer', fontSize: '0.75rem' }}
            >
              {crumb.label}
            </Link>
          )
        ))}
      </MuiBreadcrumbs>
    </Box>
  );
}
