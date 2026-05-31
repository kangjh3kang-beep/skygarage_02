import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import PublicIcon from '@mui/icons-material/Public';
import ApartmentIcon from '@mui/icons-material/Apartment';
import DomainIcon from '@mui/icons-material/Domain';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useTenant, type Region, type Complex, type Building } from '../contexts/TenantContext';

const PREMIUM_GOLD = '#C9A227';

const MOCK_REGIONS: Region[] = [
  { id: 'region_seoul', name: '서울', code: 'SEL' },
  { id: 'region_gyeonggi', name: '경기', code: 'GGI' },
  { id: 'region_busan', name: '부산', code: 'BSN' },
  { id: 'region_incheon', name: '인천', code: 'ICN' },
  { id: 'region_daejeon', name: '대전', code: 'DJN' },
];

const MOCK_COMPLEXES: Record<string, Complex[]> = {
  region_seoul: [
    { id: 'cpx_gangnam_tehran', name: '강남 테헤란 단지', code: 'GNT', region_id: 'region_seoul' },
    { id: 'cpx_songpa_park', name: '송파 파크뷰', code: 'SPP', region_id: 'region_seoul' },
    { id: 'cpx_yongsan_tower', name: '용산 타워', code: 'YST', region_id: 'region_seoul' },
  ],
  region_gyeonggi: [
    { id: 'cpx_pangyo_valley', name: '판교 밸리', code: 'PGV', region_id: 'region_gyeonggi' },
    { id: 'cpx_suwon_hub', name: '수원 허브', code: 'SWH', region_id: 'region_gyeonggi' },
  ],
  region_busan: [
    { id: 'cpx_haeundae_ocean', name: '해운대 오션', code: 'HDO', region_id: 'region_busan' },
  ],
  region_incheon: [
    { id: 'cpx_songdo_smart', name: '송도 스마트시티', code: 'SDS', region_id: 'region_incheon' },
  ],
  region_daejeon: [
    { id: 'cpx_daejeon_science', name: '대전 사이언스', code: 'DJS', region_id: 'region_daejeon' },
  ],
};

const MOCK_BUILDINGS: Record<string, Building[]> = {
  cpx_gangnam_tehran: [
    { id: 'bld_a_pickup', name: 'A동 지하픽업존', code: 'A-B1', complex_id: 'cpx_gangnam_tehran' },
    { id: 'bld_b_tower', name: 'B동 타워', code: 'B-TW', complex_id: 'cpx_gangnam_tehran' },
    { id: 'bld_c_office', name: 'C동 오피스', code: 'C-OF', complex_id: 'cpx_gangnam_tehran' },
  ],
  cpx_songpa_park: [
    { id: 'bld_101', name: '101동', code: '101', complex_id: 'cpx_songpa_park' },
    { id: 'bld_102', name: '102동', code: '102', complex_id: 'cpx_songpa_park' },
  ],
  cpx_pangyo_valley: [
    { id: 'bld_alpha', name: 'Alpha 빌딩', code: 'ALP', complex_id: 'cpx_pangyo_valley' },
    { id: 'bld_beta', name: 'Beta 빌딩', code: 'BET', complex_id: 'cpx_pangyo_valley' },
  ],
  cpx_haeundae_ocean: [
    { id: 'bld_sea1', name: '씨뷰 1동', code: 'SV1', complex_id: 'cpx_haeundae_ocean' },
  ],
};

type ActivePanel = 'region' | 'complex' | 'building' | null;

export default function ContextSwitcher() {
  const {
    scope, isImpersonating,
    canSelectRegion, canSelectComplex, canSelectBuilding,
    setRegion, setComplex, setBuilding, resetScope,
  } = useTenant();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    setActivePanel('region');
    setSearch('');
  };

  const handleClose = () => {
    setAnchorEl(null);
    setActivePanel(null);
    setSearch('');
  };

  const handleSelectRegion = (region: Region) => {
    setRegion(region);
    setActivePanel('complex');
    setSearch('');
  };

  const handleSelectComplex = (complex: Complex) => {
    setComplex(complex);
    setActivePanel('building');
    setSearch('');
  };

  const handleSelectBuilding = (building: Building) => {
    setBuilding(building);
    handleClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const currentRegions = MOCK_REGIONS.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const currentComplexes = (scope.region ? MOCK_COMPLEXES[scope.region.id] || [] : []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const currentBuildings = (scope.complex ? MOCK_BUILDINGS[scope.complex.id] || [] : []).filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const scopeLabel = scope.building
    ? scope.building.name
    : scope.complex
      ? scope.complex.name
      : scope.region
        ? scope.region.name
        : '전국 전체';

  return (
    <>
      <Tooltip title="관리 스코프 전환" placement="bottom">
        <Button
          ref={buttonRef}
          onClick={handleOpen}
          size="small"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`현재 스코프: ${scopeLabel}. 클릭하여 변경`}
          startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
          sx={{
            px: { xs: 1, sm: 1.5 },
            py: 0.5,
            borderRadius: 2,
            fontSize: { xs: '0.6875rem', sm: '0.75rem' },
            fontWeight: 700,
            textTransform: 'none',
            whiteSpace: 'nowrap',
            maxWidth: { xs: 140, sm: 280 },
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            border: isImpersonating ? `1.5px solid ${PREMIUM_GOLD}` : '1px solid',
            borderColor: isImpersonating ? PREMIUM_GOLD : 'divider',
            color: isImpersonating ? PREMIUM_GOLD : 'text.primary',
            bgcolor: isImpersonating ? 'rgba(201,162,39,0.06)' : 'transparent',
            '&:hover': {
              borderColor: isImpersonating ? PREMIUM_GOLD : 'primary.main',
              bgcolor: isImpersonating ? 'rgba(201,162,39,0.1)' : 'action.hover',
            },
          }}
        >
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
            {scope.region && (
              <>
                <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, opacity: 0.7 }}>
                  {scope.region.name}
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 12, opacity: 0.5 }} />
              </>
            )}
            {scope.complex && (
              <>
                <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, opacity: 0.85 }}>
                  {scope.complex.name}
                </Typography>
                {scope.building && <ChevronRightIcon sx={{ fontSize: 12, opacity: 0.5 }} />}
              </>
            )}
            {scope.building && (
              <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 700 }}>
                {scope.building.name}
              </Typography>
            )}
            {!scope.region && !scope.complex && !scope.building && (
              <Typography component="span" sx={{ fontSize: 'inherit' }}>전국 전체</Typography>
            )}
          </Box>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Typography component="span" sx={{ fontSize: 'inherit' }}>
              {scopeLabel.length > 10 ? scopeLabel.slice(0, 10) + '...' : scopeLabel}
            </Typography>
          </Box>
        </Button>
      </Tooltip>

      {isImpersonating && (
        <Tooltip title="스코프 초기화">
          <IconButton size="small" onClick={resetScope} sx={{ color: PREMIUM_GOLD, ml: 0.25 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              width: { xs: 280, sm: 340 },
              maxHeight: 400,
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Panel Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
              {activePanel === 'region' && '지역 선택'}
              {activePanel === 'complex' && '단지 선택'}
              {activePanel === 'building' && '건물/동 선택'}
            </Typography>
            {activePanel !== 'region' && (
              <Chip
                label={activePanel === 'complex' ? scope.region?.name : scope.complex?.name}
                size="small"
                onDelete={() => {
                  if (activePanel === 'building') {
                    setActivePanel('complex');
                    setBuilding(null);
                  } else {
                    setActivePanel('region');
                    setRegion(null);
                  }
                  setSearch('');
                }}
                sx={{ height: 22, fontSize: '0.6875rem' }}
              />
            )}
          </Box>

          {/* Breadcrumb Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            {['region', 'complex', 'building'].map((level, idx) => (
              <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {idx > 0 && <ChevronRightIcon sx={{ fontSize: 10, color: 'text.disabled' }} />}
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%',
                  bgcolor: activePanel === level ? 'primary.main'
                    : (level === 'region' && scope.region) || (level === 'complex' && scope.complex) || (level === 'building' && scope.building)
                      ? 'success.main' : 'action.disabled',
                }} />
              </Box>
            ))}
          </Box>

          <TextField
            size="small"
            placeholder="검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            fullWidth
            aria-label="스코프 검색"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                sx: { fontSize: '0.8125rem', height: 32 },
              },
            }}
          />
        </Box>

        {/* List */}
        <List
          dense
          sx={{ maxHeight: 260, overflowY: 'auto', py: 0.5 }}
          role="listbox"
          aria-label={`${activePanel} 목록`}
        >
          {activePanel === 'region' && canSelectRegion && currentRegions.map(r => (
            <ListItemButton
              key={r.id}
              onClick={() => handleSelectRegion(r)}
              selected={scope.region?.id === r.id}
              role="option"
              aria-selected={scope.region?.id === r.id}
              sx={{ borderRadius: 1, mx: 0.5, py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <PublicIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={r.name}
                secondary={r.code}
                slotProps={{
                  primary: { sx: { fontSize: '0.8125rem', fontWeight: 600 } },
                  secondary: { sx: { fontSize: '0.6875rem' } },
                }}
              />
              <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            </ListItemButton>
          ))}

          {activePanel === 'complex' && canSelectComplex && currentComplexes.map(c => (
            <ListItemButton
              key={c.id}
              onClick={() => handleSelectComplex(c)}
              selected={scope.complex?.id === c.id}
              role="option"
              aria-selected={scope.complex?.id === c.id}
              sx={{ borderRadius: 1, mx: 0.5, py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <ApartmentIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={c.name}
                secondary={c.code}
                slotProps={{
                  primary: { sx: { fontSize: '0.8125rem', fontWeight: 600 } },
                  secondary: { sx: { fontSize: '0.6875rem' } },
                }}
              />
              <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            </ListItemButton>
          ))}

          {activePanel === 'building' && canSelectBuilding && currentBuildings.map(b => (
            <ListItemButton
              key={b.id}
              onClick={() => handleSelectBuilding(b)}
              selected={scope.building?.id === b.id}
              role="option"
              aria-selected={scope.building?.id === b.id}
              sx={{ borderRadius: 1, mx: 0.5, py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <DomainIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={b.name}
                secondary={b.code}
                slotProps={{
                  primary: { sx: { fontSize: '0.8125rem', fontWeight: 600 } },
                  secondary: { sx: { fontSize: '0.6875rem' } },
                }}
              />
            </ListItemButton>
          ))}

          {activePanel === 'building' && currentBuildings.length === 0 && (
            <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                등록된 건물이 없습니다
              </Typography>
            </Box>
          )}
        </List>

        {/* Footer: skip building */}
        {activePanel === 'building' && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1 }}>
              <Button
                size="small"
                fullWidth
                onClick={handleClose}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                건물 선택 없이 단지 전체 보기
              </Button>
            </Box>
          </>
        )}
      </Popover>
    </>
  );
}
