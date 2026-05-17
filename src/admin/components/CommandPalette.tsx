import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../../hooks/useDebounce';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ApartmentIcon from '@mui/icons-material/Apartment';
import PeopleIcon from '@mui/icons-material/People';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ElevatorIcon from '@mui/icons-material/Elevator';
import BoltIcon from '@mui/icons-material/Bolt';
import SecurityIcon from '@mui/icons-material/Security';
import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import PublicIcon from '@mui/icons-material/Public';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import BuildIcon from '@mui/icons-material/Build';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ImageIcon from '@mui/icons-material/Image';
import GavelIcon from '@mui/icons-material/Gavel';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  keywords: string[];
  group: string;
}

const commands: CommandItem[] = [
  { label: 'Dashboard', path: '/admin', icon: <DashboardIcon />, keywords: ['대시보드', 'home', '홈'], group: '운영' },
  { label: '단지 관리', path: '/admin/complexes', icon: <ApartmentIcon />, keywords: ['complex', '아파트', '건물'], group: '운영' },
  { label: '입주민', path: '/admin/residents', icon: <PeopleIcon />, keywords: ['resident', '주민', '사용자'], group: '운영' },
  { label: '주차 운영', path: '/admin/parking', icon: <LocalParkingIcon />, keywords: ['parking', '차량', '입출차'], group: '운영' },
  { label: 'ATR 로봇', path: '/admin/atr', icon: <PrecisionManufacturingIcon />, keywords: ['robot', '로봇', '자동'], group: '운영' },
  { label: '엘리베이터', path: '/admin/elevators', icon: <ElevatorIcon />, keywords: ['elevator', '승강기'], group: '운영' },
  { label: '에너지', path: '/admin/energy', icon: <BoltIcon />, keywords: ['energy', '전력', '태양광'], group: '운영' },
  { label: '계약 관리', path: '/admin/contracts', icon: <DescriptionIcon />, keywords: ['contract', '계약서'], group: '비즈니스' },
  { label: '파트너', path: '/admin/partners', icon: <DescriptionIcon />, keywords: ['partner', '협력사'], group: '비즈니스' },
  { label: '청구/인보이스', path: '/admin/billing', icon: <DescriptionIcon />, keywords: ['invoice', '결제', '요금'], group: '비즈니스' },
  { label: '매출/청구', path: '/admin/revenue', icon: <DescriptionIcon />, keywords: ['revenue', '수익', '매출'], group: '비즈니스' },
  { label: 'CRM', path: '/admin/crm', icon: <PeopleIcon />, keywords: ['lead', '영업', '고객'], group: '비즈니스' },
  { label: '문의 관리', path: '/admin/inquiries', icon: <DescriptionIcon />, keywords: ['inquiry', '문의', '질문'], group: '비즈니스' },
  { label: '특허 관리', path: '/admin/patents', icon: <GavelIcon />, keywords: ['patent', 'IP', '지식재산'], group: 'IP/특허' },
  { label: '라이선스', path: '/admin/licenses', icon: <GavelIcon />, keywords: ['license', '사용권'], group: 'IP/특허' },
  { label: '정비 관리', path: '/admin/maintenance', icon: <BuildIcon />, keywords: ['maintenance', '수리', '점검'], group: '지원/정비' },
  { label: '지원 티켓', path: '/admin/tickets', icon: <BuildIcon />, keywords: ['ticket', '문의', '지원'], group: '지원/정비' },
  { label: '알림 센터', path: '/admin/alerts', icon: <NotificationsIcon />, keywords: ['alert', '경고', '알림'], group: '지원/정비' },
  { label: 'NOC', path: '/admin/noc', icon: <PublicIcon />, keywords: ['monitoring', '감시', '글로벌'], group: '모니터링' },
  { label: '분석', path: '/admin/analytics', icon: <BarChartIcon />, keywords: ['analytics', '통계', '차트'], group: '모니터링' },
  { label: '보안 감사', path: '/admin/security', icon: <SecurityIcon />, keywords: ['security', '감사', '로그'], group: '모니터링' },
  { label: '출입 관리', path: '/admin/access', icon: <SecurityIcon />, keywords: ['access', '게이트', '출입'], group: '모니터링' },
  { label: '이미지 관리', path: '/admin/images', icon: <ImageIcon />, keywords: ['image', '사진', '업로드'], group: '프론트엔드' },
  { label: '섹션 미디어', path: '/admin/media', icon: <ImageIcon />, keywords: ['media', '비디오', '미디어'], group: '프론트엔드' },
  { label: '사용자 관리', path: '/admin/users', icon: <SecurityIcon />, keywords: ['user', '권한', '역할'], group: '시스템' },
  { label: '팀원 관리', path: '/admin/team', icon: <PeopleIcon />, keywords: ['team', '팀', '직원'], group: '시스템' },
  { label: 'AI Agent', path: '/admin/ai', icon: <SmartToyIcon />, keywords: ['ai', '인공지능', '챗봇'], group: '시스템' },
  { label: '설정', path: '/admin/settings', icon: <SettingsIcon />, keywords: ['settings', '환경설정', '설정'], group: '시스템' },
];

interface EntityResult {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  path: string;
  group: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [entityResults, setEntityResults] = useState<EntityResult[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const navigate = useNavigate();
  const listRef = useRef<HTMLUListElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(lower) ||
      cmd.keywords.some(kw => kw.toLowerCase().includes(lower)) ||
      cmd.group.toLowerCase().includes(lower)
    );
  }, [query]);

  const totalItems = filtered.length + entityResults.length;

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setEntityResults([]);
      return;
    }

    let cancelled = false;
    setEntityLoading(true);

    (async () => {
      const results: EntityResult[] = [];
      const term = `%${debouncedQuery}%`;

      const [complexRes, residentRes, parkingRes] = await Promise.all([
        supabase
          .from('complexes')
          .select('id, name, mdm_code, city')
          .or(`name.ilike.${term},mdm_code.ilike.${term}`)
          .limit(5),
        supabase
          .from('resident_accounts')
          .select('id, name, unit_number, complex_id')
          .ilike('name', term)
          .limit(5),
        supabase
          .from('parking_sessions')
          .select('id, vehicle_number, status, complex_id')
          .ilike('vehicle_number', term)
          .limit(5),
      ]);

      if (cancelled) return;

      if (complexRes.data) {
        for (const c of complexRes.data) {
          results.push({
            id: c.id,
            label: c.name || c.mdm_code || 'Unknown',
            sublabel: c.mdm_code || c.city || '',
            icon: <ApartmentIcon fontSize="small" />,
            path: '/admin/complexes',
            group: '단지',
          });
        }
      }

      if (residentRes.data) {
        for (const r of residentRes.data) {
          results.push({
            id: r.id,
            label: r.name || 'Unknown',
            sublabel: r.unit_number || '',
            icon: <PeopleIcon fontSize="small" />,
            path: '/admin/residents',
            group: '입주민',
          });
        }
      }

      if (parkingRes.data) {
        for (const p of parkingRes.data) {
          results.push({
            id: p.id,
            label: p.vehicle_number || 'Unknown',
            sublabel: p.status || '',
            icon: <DirectionsCarIcon fontSize="small" />,
            path: '/admin/parking',
            group: '주차',
          });
        }
      }

      if (!cancelled) {
        setEntityResults(results);
        setEntityLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) { setQuery(''); setActiveIndex(0); setEntityResults([]); }
  }, [open]);

  const handleSelect = useCallback((item: CommandItem | EntityResult) => {
    navigate(item.path);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex]);
      } else {
        const entityIdx = activeIndex - filtered.length;
        if (entityResults[entityIdx]) handleSelect(entityResults[entityIdx]);
      }
    }
  }, [filtered, entityResults, activeIndex, handleSelect, totalItems]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-label="명령 팔레트"
      slotProps={{
        paper: {
          sx: {
            position: 'fixed',
            top: '15%',
            m: 0,
            maxHeight: '60vh',
            borderRadius: 3,
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box sx={{ p: 0 }} role="combobox" aria-expanded={open} aria-haspopup="listbox">
        <TextField
          autoFocus
          fullWidth
          placeholder="페이지 이동... (이름 또는 키워드 입력)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          variant="outlined"
          aria-label="검색어 입력"
          aria-autocomplete="list"
          aria-controls="command-palette-list"
          aria-activedescendant={totalItems > 0 ? `cmd-item-${activeIndex}` : undefined}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              '& fieldset': { border: 'none' },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Chip label="ESC" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.625rem' }} />
                </InputAdornment>
              ),
              sx: { fontSize: '0.9375rem', py: 0.5 },
            },
          }}
        />

        <Box sx={{ borderTop: 1, borderColor: 'divider', maxHeight: 400, overflow: 'auto' }}>
          {totalItems === 0 && !entityLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">결과가 없습니다</Typography>
            </Box>
          ) : (
            <List dense ref={listRef} sx={{ py: 0.5 }} role="listbox" id="command-palette-list" aria-label="검색 결과">
              {filtered.map((item, idx) => (
                <ListItemButton
                  key={item.path}
                  id={`cmd-item-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  selected={idx === activeIndex}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  sx={{
                    mx: 0.5,
                    borderRadius: 1.5,
                    py: 0.75,
                    '&.Mui-selected': { bgcolor: 'action.selected' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: idx === activeIndex ? 'primary.main' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 } } }}
                  />
                  <Chip label={item.group} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.625rem' }} />
                </ListItemButton>
              ))}

              {entityResults.length > 0 && (
                <>
                  <Divider sx={{ my: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">데이터 검색 결과</Typography>
                  </Divider>
                  {entityResults.map((item, idx) => {
                    const globalIdx = filtered.length + idx;
                    return (
                      <ListItemButton
                        key={`entity-${item.id}`}
                        id={`cmd-item-${globalIdx}`}
                        role="option"
                        aria-selected={globalIdx === activeIndex}
                        selected={globalIdx === activeIndex}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        sx={{
                          mx: 0.5,
                          borderRadius: 1.5,
                          py: 0.75,
                          '&.Mui-selected': { bgcolor: 'action.selected' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32, color: globalIdx === activeIndex ? 'primary.main' : 'text.secondary' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          secondary={item.sublabel}
                          slotProps={{
                            primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 } },
                            secondary: { sx: { fontSize: '0.6875rem' } },
                          }}
                        />
                        <Chip label={item.group} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.625rem' }} />
                      </ListItemButton>
                    );
                  })}
                </>
              )}

              {entityLoading && (
                <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={18} />
                </Box>
              )}
            </List>
          )}
        </Box>

        <Box sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 0.75, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            <Chip label="↑↓" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.5625rem', mr: 0.5 }} /> 이동
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <Chip label="Enter" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.5625rem', mr: 0.5 }} /> 선택
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <Chip label="Esc" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.5625rem', mr: 0.5 }} /> 닫기
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}
