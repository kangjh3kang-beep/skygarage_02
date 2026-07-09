import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BusinessIcon from '@mui/icons-material/Business';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { addPlace, verifyOfficeCode, searchSites } from '../services/placeService';
import type { PlaceType } from '../types';

export default function SgpPlacesAdd() {
  const { user } = useSgpAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; address: string; available: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [officeCode, setOfficeCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [addedName, setAddedName] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchSites(searchQuery);
    setSearchResults(results);
    setSearching(false);
  };

  const handleAddPartner = async (site: { id: string; name: string }) => {
    if (!user) return;
    const result = await addPlace(user.id, site.id, 'PARTNER', site.name);
    if (result.success) {
      setAddedName(site.name);
      setSuccessDialog(true);
    }
  };

  const handleVerifyOffice = async () => {
    if (!user || !officeCode.trim()) return;
    setCodeLoading(true);
    setCodeError('');

    const result = await verifyOfficeCode(user.id, officeCode.trim());
    if (result.success && result.siteId) {
      const addResult = await addPlace(user.id, result.siteId, 'OFFICE', result.siteName ?? '사무실');
      if (addResult.success) {
        setAddedName(result.siteName ?? '사무실');
        setSuccessDialog(true);
      } else {
        setCodeError(addResult.error ?? '등록 실패');
      }
    } else {
      setCodeError(result.error ?? '검증 실패');
    }
    setCodeLoading(false);
  };

  const tabs: { label: string; type: PlaceType; icon: React.ReactNode }[] = [
    { label: '제휴 검색', type: 'PARTNER', icon: <StorefrontIcon /> },
    { label: '사무실 코드', type: 'OFFICE', icon: <BusinessIcon /> },
    { label: '거주 확인', type: 'HOME_UNIT', icon: <ApartmentIcon /> },
  ];

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
        장소 추가
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          mb: 3, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', minHeight: 44, textTransform: 'none', fontSize: '0.82rem' },
          '& .Mui-selected': { color: '#00d4aa' },
          '& .MuiTabs-indicator': { bgcolor: '#00d4aa' },
        }}
      >
        {tabs.map(t => <Tab key={t.label} label={t.label} />)}
      </Tabs>

      {/* Partner Search */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="주차장 이름 또는 주소 검색"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={searching}
              sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', minWidth: 44, borderRadius: 2 }}
            >
              {searching ? <CircularProgress size={20} /> : <SearchIcon />}
            </Button>
          </Box>

          {searchResults.map(site => (
            <Card key={site.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, mb: 1 }}>
              <CardActionArea onClick={() => handleAddPartner(site)}>
                <CardContent sx={{ py: 1.5, px: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: '#fff' }}>{site.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>{site.address}</Typography>
                  <Typography variant="caption" sx={{ color: '#00d4aa', display: 'block' }}>
                    잔여 {site.available}면
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      {/* Office Code */}
      {tab === 1 && (
        <Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
            법인 관리자로부터 받은 초대 코드를 입력하세요.
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="초대 코드 (예: SGP-OFFICE-XXXX)"
            value={officeCode}
            onChange={e => setOfficeCode(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              },
            }}
          />
          {codeError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{codeError}</Alert>}
          <Button
            fullWidth
            variant="contained"
            onClick={handleVerifyOffice}
            disabled={codeLoading || !officeCode.trim()}
            sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, borderRadius: 2, py: 1.2 }}
          >
            {codeLoading ? <CircularProgress size={20} /> : '코드 검증'}
          </Button>
        </Box>
      )}

      {/* Home Unit */}
      {tab === 2 && (
        <Box>
          <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
            거주 단지는 관리사무소 승인 후 자동 등록됩니다. 이미 승인된 세대원이면 멤버십에서 확인하세요.
          </Alert>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/app/profile')}
            sx={{ color: '#00d4aa', borderColor: 'rgba(0,212,170,0.3)', borderRadius: 2 }}
          >
            멤버십 확인
          </Button>
        </Box>
      )}

      {/* Success Dialog */}
      <Dialog open={successDialog} onClose={() => { setSuccessDialog(false); navigate('/app'); }}>
        <DialogTitle>등록 완료</DialogTitle>
        <DialogContent>
          <Typography>{addedName}이(가) 즐겨찾기에 추가되었습니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSuccessDialog(false); navigate('/app'); }} sx={{ color: '#00d4aa' }}>
            홈으로
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
