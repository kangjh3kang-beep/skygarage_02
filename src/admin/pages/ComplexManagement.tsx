import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import BuildIcon from '@mui/icons-material/Build';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Paper from '@mui/material/Paper';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Complex {
  id: string;
  name: string;
  code: string;
  address: string;
  road_address: string;
  jibun_address: string;
  zip_code: string;
  si_nm: string;
  sgg_nm: string;
  emd_nm: string;
  bd_nm: string;
  adm_cd: string;
  total_parking_slots: number;
  total_units: number;
  created_at: string;
  country_code: string;
  region_code: string;
  district_code: string;
  dong_code: string;
  complex_type: string;
  sequence_number: string;
  registration_date: string;
  mdm_code: string;
  latitude: number | null;
  longitude: number | null;
  total_floors: number;
  total_buildings: number;
  construction_year: number | null;
  developer_name: string;
  management_company: string;
  contact_phone: string;
  contact_email: string;
  ev_charger_count: number;
  has_valet_system: boolean;
  data_quality_score: number;
  completeness_ratio: number;
  status: string;
}

const COMPLEX_TYPES = [
  { value: 'APT', label: '아파트 (APT)' },
  { value: 'OFC', label: '오피스 (OFC)' },
  { value: 'COM', label: '상업시설 (COM)' },
  { value: 'MXD', label: '복합시설 (MXD)' },
  { value: 'RSD', label: '주거시설 (RSD)' },
];

const STATUS_MAP: Record<string, { label: string; color: 'success' | 'warning' | 'info' | 'default' }> = {
  poc: { label: 'PoC', color: 'info' },
  pilot: { label: 'Pilot', color: 'warning' },
  active: { label: '운영중', color: 'success' },
  inactive: { label: '비활성', color: 'default' },
};

const STEPS = ['기본 정보', '위치 및 규모', '시설 현황', '확인'];

interface FormData {
  name: string;
  address: string;
  road_address: string;
  jibun_address: string;
  zip_code: string;
  si_nm: string;
  sgg_nm: string;
  emd_nm: string;
  bd_nm: string;
  adm_cd: string;
  country_code: string;
  region_code: string;
  district_code: string;
  dong_code: string;
  complex_type: string;
  total_units: string;
  total_parking_slots: string;
  total_floors: string;
  total_buildings: string;
  construction_year: string;
  developer_name: string;
  management_company: string;
  contact_phone: string;
  contact_email: string;
  ev_charger_count: string;
  has_valet_system: boolean;
  status: string;
}

const emptyForm: FormData = {
  name: '',
  address: '',
  road_address: '',
  jibun_address: '',
  zip_code: '',
  si_nm: '',
  sgg_nm: '',
  emd_nm: '',
  bd_nm: '',
  adm_cd: '',
  country_code: 'KR',
  region_code: '',
  district_code: '',
  dong_code: '',
  complex_type: 'APT',
  total_units: '0',
  total_parking_slots: '0',
  total_floors: '0',
  total_buildings: '1',
  construction_year: '',
  developer_name: '',
  management_company: '',
  contact_phone: '',
  contact_email: '',
  ev_charger_count: '0',
  has_valet_system: false,
  status: 'poc',
};

function calculateCompleteness(form: FormData): number {
  const fields = [
    form.name, form.address, form.region_code, form.district_code,
    form.dong_code, form.total_units !== '0' ? form.total_units : '',
    form.total_parking_slots !== '0' ? form.total_parking_slots : '',
    form.total_floors !== '0' ? form.total_floors : '',
    form.total_buildings !== '0' ? form.total_buildings : '',
    form.construction_year, form.developer_name, form.management_company,
    form.contact_phone, form.contact_email, form.ev_charger_count !== '0' ? form.ev_charger_count : '',
  ];
  const filled = fields.filter(f => f && f.trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
}

function generatePreviewCode(form: FormData): string {
  const parts = [
    'SG',
    form.country_code || '??',
    form.region_code || '??',
    form.district_code || '???',
    form.dong_code || '???',
    form.complex_type || '???',
    'XXXX',
    new Date().toISOString().slice(0, 10).replace(/-/g, ''),
  ];
  return parts.join('-');
}

export default function ComplexManagement() {
  useDocumentTitle('단지 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Complex | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Complex | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<Complex | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; action: string; changes: Record<string, unknown>; created_at: string }>>([]);

  // Address search state
  const [addrQuery, setAddrQuery] = useState('');
  const [addrResults, setAddrResults] = useState<Array<{ roadAddr: string; jibunAddr: string; zipNo: string; bdNm: string; siNm: string; sggNm: string; emdNm: string; admCd: string }>>([]);
  const [addrSearching, setAddrSearching] = useState(false);
  const [addrDropdownOpen, setAddrDropdownOpen] = useState(false);
  const addrTimerRef = { current: null as ReturnType<typeof setTimeout> | null };

  const searchAddress = async (keyword: string) => {
    if (keyword.trim().length < 2) { setAddrResults([]); setAddrDropdownOpen(false); return; }
    setAddrSearching(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/address-search?keyword=${encodeURIComponent(keyword)}`;
      const res = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      const data = await res.json();
      setAddrResults(data.results || []);
      setAddrDropdownOpen((data.results || []).length > 0);
    } catch {
      setAddrResults([]);
    } finally {
      setAddrSearching(false);
    }
  };

  const handleAddrInputChange = (value: string) => {
    setAddrQuery(value);
    if (addrTimerRef.current) clearTimeout(addrTimerRef.current);
    addrTimerRef.current = setTimeout(() => searchAddress(value), 400);
  };

  const handleAddrSelect = (item: typeof addrResults[0]) => {
    const admCd = item.admCd || '';
    const regionCode = admCd.slice(0, 2);
    const districtCode = admCd.slice(2, 5);
    const dongCode = admCd.slice(5, 8);

    const updates: Partial<FormData> = {
      address: item.roadAddr,
      road_address: item.roadAddr,
      jibun_address: item.jibunAddr,
      zip_code: item.zipNo,
      si_nm: item.siNm,
      sgg_nm: item.sggNm,
      emd_nm: item.emdNm,
      bd_nm: item.bdNm,
      adm_cd: admCd,
      region_code: regionCode,
      district_code: districtCode,
      dong_code: dongCode,
    };
    setForm(prev => ({ ...prev, ...updates }));
    setAddrQuery(item.roadAddr);
    setAddrDropdownOpen(false);
    setAddrResults([]);
  };

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('complexes').select('*').order('name');
    if (data) setComplexes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('complexes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complexes' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const completeness = useMemo(() => calculateCompleteness(form), [form]);
  const previewCode = useMemo(() => generatePreviewCode(form), [form]);

  const handleOpenAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setAddrQuery('');
    setAddrResults([]);
    setAddrDropdownOpen(false);
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleOpenEdit = (c: Complex) => {
    setEditing(c);
    setForm({
      name: c.name,
      address: c.address || '',
      road_address: c.road_address || '',
      jibun_address: c.jibun_address || '',
      zip_code: c.zip_code || '',
      si_nm: c.si_nm || '',
      sgg_nm: c.sgg_nm || '',
      emd_nm: c.emd_nm || '',
      bd_nm: c.bd_nm || '',
      adm_cd: c.adm_cd || '',
      country_code: c.country_code || 'KR',
      region_code: c.region_code || '',
      district_code: c.district_code || '',
      dong_code: c.dong_code || '',
      complex_type: c.complex_type || 'APT',
      total_units: String(c.total_units),
      total_parking_slots: String(c.total_parking_slots),
      total_floors: String(c.total_floors || 0),
      total_buildings: String(c.total_buildings || 1),
      construction_year: c.construction_year ? String(c.construction_year) : '',
      developer_name: c.developer_name || '',
      management_company: c.management_company || '',
      contact_phone: c.contact_phone || '',
      contact_email: c.contact_email || '',
      ev_charger_count: String(c.ev_charger_count || 0),
      has_valet_system: c.has_valet_system || false,
      status: c.status || 'poc',
    });
    setAddrQuery(c.address || '');
    setAddrResults([]);
    setAddrDropdownOpen(false);
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);

    let sequenceNumber = editing?.sequence_number || '';
    let mdmCode = editing?.mdm_code || '';

    if (!editing) {
      const { data: seqData } = await supabase.rpc('generate_mdm_sequence', {
        p_country_code: form.country_code,
        p_region_code: form.region_code,
        p_complex_type: form.complex_type,
      });
      if (seqData) {
        sequenceNumber = seqData;
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        mdmCode = `SG-${form.country_code}-${form.region_code}-${form.district_code}-${form.dong_code}-${form.complex_type}-${sequenceNumber}-${dateStr}`;
      }
    }

    const completenessRatio = completeness / 100;
    const dqScore = completenessRatio * 100;

    const payload = {
      name: form.name,
      code: mdmCode || editing?.code || '',
      address: form.address,
      road_address: form.road_address,
      jibun_address: form.jibun_address,
      zip_code: form.zip_code,
      si_nm: form.si_nm,
      sgg_nm: form.sgg_nm,
      emd_nm: form.emd_nm,
      bd_nm: form.bd_nm,
      adm_cd: form.adm_cd,
      country_code: form.country_code,
      region_code: form.region_code,
      district_code: form.district_code,
      dong_code: form.dong_code,
      complex_type: form.complex_type,
      sequence_number: sequenceNumber,
      mdm_code: mdmCode || editing?.mdm_code || '',
      total_units: parseInt(form.total_units) || 0,
      total_parking_slots: parseInt(form.total_parking_slots) || 0,
      total_floors: parseInt(form.total_floors) || 0,
      total_buildings: parseInt(form.total_buildings) || 1,
      construction_year: form.construction_year ? parseInt(form.construction_year) : null,
      developer_name: form.developer_name,
      management_company: form.management_company,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email,
      ev_charger_count: parseInt(form.ev_charger_count) || 0,
      has_valet_system: form.has_valet_system,
      data_quality_score: dqScore,
      completeness_ratio: completenessRatio,
      last_validated_at: new Date().toISOString(),
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from('complexes').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); setSaving(false); return; }
      logAction('UPDATE', 'complexes', editing.id, { name: payload.name, mdm_code: payload.mdm_code });
      await supabase.from('complex_registration_history').insert({ complex_id: editing.id, action: 'update', changes: payload });
      showToast('단지가 수정되었습니다.', 'success');
    } else {
      const { data: newRow, error } = await supabase.from('complexes').insert(payload).select('id').maybeSingle();
      if (error) { showToast('등록 실패: ' + error.message, 'error'); setSaving(false); return; }
      logAction('CREATE', 'complexes', undefined, { name: payload.name, mdm_code: payload.mdm_code });
      if (newRow) await supabase.from('complex_registration_history').insert({ complex_id: newRow.id, action: 'create', changes: payload });
      showToast('단지가 등록되었습니다.', 'success');
    }
    setSaving(false);
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('complex_registration_history').insert({ complex_id: deleteTarget.id, action: 'delete', changes: { name: deleteTarget.name } });
    const { error } = await supabase.from('complexes').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
    logAction('DELETE', 'complexes', deleteTarget.id, { name: deleteTarget.name });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const handleViewHistory = async (c: Complex) => {
    setHistoryDialog(c);
    const { data } = await supabase
      .from('complex_registration_history')
      .select('*')
      .eq('complex_id', c.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setHistory(data);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast('코드가 클립보드에 복사되었습니다.', 'success');
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: return !!form.name && !!form.complex_type;
      case 1: return !!form.address;
      case 2: return true;
      default: return true;
    }
  };

  if (loading) {
    return (
      <Box>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 1 }} />
        </Box>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map(i => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  const activeComplexes = complexes.filter(c => c.status === 'active');
  const avgDQ = complexes.length > 0 ? Math.round(complexes.reduce((s, c) => s + (c.data_quality_score || 0), 0) / complexes.length) : 0;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">단지 관리 (MDM)</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>단지 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">전체 단지</Typography>
            <Typography variant="h2">{complexes.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">운영중</Typography>
            <Typography variant="h2" color="success.main">{activeComplexes.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">총 세대</Typography>
            <Typography variant="h2">{complexes.reduce((s, c) => s + (c.total_units || 0), 0).toLocaleString()}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">평균 DQ 스코어</Typography>
            <Typography variant="h2" color={avgDQ >= 80 ? 'success.main' : avgDQ >= 50 ? 'warning.main' : 'error.main'}>
              {avgDQ}%
            </Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ minWidth: 900 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 80px 80px 80px 100px 60px', gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>MDM 코드</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>단지명</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>주소</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'right' }}>세대</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'right' }}>주차면</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'center' }}>DQ</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'center' }}>상태</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'center' }}>관리</Typography>
            </Box>
            {complexes.map(c => {
              const statusInfo = STATUS_MAP[c.status] || STATUS_MAP.poc;
              return (
                <Box
                  key={c.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr 1fr 80px 80px 80px 100px 60px',
                    gap: 1, px: 2, py: 1.5,
                    borderBottom: 1, borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                    alignItems: 'center',
                    transition: 'background-color 0.15s',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', fontSize: '0.65rem' }}>
                      {c.mdm_code || c.code}
                    </Typography>
                    {(c.mdm_code || c.code) && (
                      <IconButton size="small" onClick={() => handleCopyCode(c.mdm_code || c.code)} sx={{ p: 0.25 }}>
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '-'}</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>{c.total_units}</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>{c.total_parking_slots}</Typography>
                  <Box sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      {(c.data_quality_score || 0) >= 80 ? (
                        <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      ) : (
                        <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                      )}
                      <Typography variant="caption">{Math.round(c.data_quality_score || 0)}%</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Chip label={statusInfo.label} size="small" color={statusInfo.color} sx={{ height: 22, fontSize: '0.65rem' }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0 }}>
                    <Tooltip title="이력"><IconButton size="small" onClick={() => handleViewHistory(c)}><HistoryIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                    <Tooltip title="수정"><IconButton size="small" onClick={() => handleOpenEdit(c)}><EditIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                    <Tooltip title="삭제"><IconButton size="small" onClick={() => setDeleteTarget(c)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                  </Box>
                </Box>
              );
            })}
            {complexes.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="body2" color="text.secondary">등록된 단지가 없습니다.</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Card>

      {/* Quick nav row */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" startIcon={<PeopleIcon />} onClick={() => navigate('/admin/residents')}>사용자</Button>
        <Button size="small" variant="outlined" startIcon={<LocalParkingIcon />} onClick={() => navigate('/admin/parking')}>주차 운영</Button>
        <Button size="small" variant="outlined" startIcon={<BuildIcon />} onClick={() => navigate('/admin/maintenance')}>정비</Button>
        <Button size="small" variant="outlined" startIcon={<BoltIcon />} onClick={() => navigate('/admin/energy')}>에너지</Button>
      </Box>

      {/* Registration Dialog with Stepper */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 0 }}>
          <Typography variant="h3">{editing ? '단지 수정' : '단지 등록'}</Typography>
          <Typography variant="caption" color="text.secondary">
            MDM 기반 체계적 단지 등록 시스템
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {STEPS.map(label => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {/* Code Preview */}
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">MDM 코드 (자동 생성)</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>
                  {editing?.mdm_code || previewCode}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">데이터 완성도</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={completeness} sx={{ width: 80, height: 6, borderRadius: 3 }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{completeness}%</Typography>
                </Box>
              </Box>
            </Box>
          </Alert>

          {/* Step 0: Basic Info */}
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="단지명"
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                fullWidth size="small" required
                helperText="공식 단지 명칭을 입력하세요"
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="국가"
                    select value={form.country_code}
                    onChange={e => updateField('country_code', e.target.value)}
                    fullWidth size="small"
                  >
                    <MenuItem value="KR">한국 (KR)</MenuItem>
                    <MenuItem value="US">미국 (US)</MenuItem>
                    <MenuItem value="AE">UAE (AE)</MenuItem>
                    <MenuItem value="SG">싱가포르 (SG)</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="단지 유형"
                    select value={form.complex_type}
                    onChange={e => updateField('complex_type', e.target.value)}
                    fullWidth size="small" required
                  >
                    {COMPLEX_TYPES.map(t => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="운영 상태"
                    select value={form.status}
                    onChange={e => updateField('status', e.target.value)}
                    fullWidth size="small"
                  >
                    <MenuItem value="poc">PoC (개념 검증)</MenuItem>
                    <MenuItem value="pilot">Pilot (시범 운영)</MenuItem>
                    <MenuItem value="active">운영중</MenuItem>
                    <MenuItem value="inactive">비활성</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              {form.address && (
                <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOnIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{form.road_address || form.address}</Typography>
                  {form.zip_code && <Chip label={form.zip_code} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                </Box>
              )}
            </Box>
          )}

          {/* Step 1: Location & Scale */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Address Search */}
              <Box sx={{ position: 'relative' }}>
                <TextField
                  label="주소 검색"
                  value={addrQuery}
                  onChange={e => handleAddrInputChange(e.target.value)}
                  onFocus={() => { if (addrResults.length > 0) setAddrDropdownOpen(true); }}
                  fullWidth size="small" required
                  placeholder="도로명, 건물명, 지번 검색"
                  helperText={form.address ? undefined : "주소를 검색하여 선택하세요"}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: addrSearching ? (
                        <InputAdornment position="end">
                          <CircularProgress size={16} />
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
                {addrDropdownOpen && addrResults.length > 0 && (
                  <Paper
                    elevation={8}
                    sx={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300,
                      maxHeight: 280, overflow: 'auto', mt: 0.5, borderRadius: 1,
                    }}
                  >
                    <List dense disablePadding>
                      {addrResults.map((item, idx) => (
                        <ListItemButton
                          key={idx}
                          onClick={() => handleAddrSelect(item)}
                          sx={{ py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <LocationOnIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={item.roadAddr}
                            secondary={`[${item.zipNo}] ${item.jibunAddr}`}
                            slotProps={{
                              primary: { variant: 'body2', sx: { fontWeight: 500 } },
                              secondary: { variant: 'caption' },
                            }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>

              {/* Selected Address Display */}
              {form.address && (
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <LocationOnIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main' }}>선택된 주소</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{form.road_address || form.address}</Typography>
                  {form.jibun_address && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>(지번) {form.jibun_address}</Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    {form.zip_code && <Chip label={`우편번호: ${form.zip_code}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                    {form.si_nm && <Chip label={form.si_nm} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
                    {form.sgg_nm && <Chip label={form.sgg_nm} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
                    {form.emd_nm && <Chip label={form.emd_nm} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
                  </Box>
                </Box>
              )}

              <TextField
                label="상세주소 (동/호)"
                value={form.bd_nm}
                onChange={e => updateField('bd_nm', e.target.value)}
                fullWidth size="small"
                placeholder="예: 101동 1501호, A동"
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="세대수"
                    type="number" value={form.total_units}
                    onChange={e => updateField('total_units', e.target.value)}
                    fullWidth size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="총 주차면"
                    type="number" value={form.total_parking_slots}
                    onChange={e => updateField('total_parking_slots', e.target.value)}
                    fullWidth size="small"
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="동수 (건물수)"
                    type="number" value={form.total_buildings}
                    onChange={e => updateField('total_buildings', e.target.value)}
                    fullWidth size="small"
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="최대 층수"
                    type="number" value={form.total_floors}
                    onChange={e => updateField('total_floors', e.target.value)}
                    fullWidth size="small"
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="준공 연도"
                    type="number" value={form.construction_year}
                    onChange={e => updateField('construction_year', e.target.value)}
                    fullWidth size="small"
                    placeholder="예: 2024"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Step 2: Facility Details */}
          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="시행사/개발사"
                    value={form.developer_name}
                    onChange={e => updateField('developer_name', e.target.value)}
                    fullWidth size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="관리업체"
                    value={form.management_company}
                    onChange={e => updateField('management_company', e.target.value)}
                    fullWidth size="small"
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="연락처 (전화)"
                    value={form.contact_phone}
                    onChange={e => updateField('contact_phone', e.target.value)}
                    fullWidth size="small"
                    placeholder="02-1234-5678"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="연락처 (이메일)"
                    value={form.contact_email}
                    onChange={e => updateField('contact_email', e.target.value)}
                    fullWidth size="small"
                    placeholder="admin@complex.co.kr"
                  />
                </Grid>
              </Grid>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>SkyGarage 시설</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="EV 충전기 수"
                    type="number" value={form.ev_charger_count}
                    onChange={e => updateField('ev_charger_count', e.target.value)}
                    fullWidth size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.has_valet_system}
                        onChange={e => updateField('has_valet_system', e.target.checked)}
                      />
                    }
                    label="발렛 시스템 설치"
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Step 3: Confirmation */}
          {activeStep === 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity={completeness >= 80 ? 'success' : 'warning'}>
                데이터 완성도: {completeness}% {completeness >= 80 ? '- 우수' : '- 추가 입력 권장'}
              </Alert>
              <Card variant="outlined">
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">단지명</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{form.name || '-'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">MDM 코드</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{editing?.mdm_code || previewCode}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">유형</Typography>
                      <Typography variant="body2">{COMPLEX_TYPES.find(t => t.value === form.complex_type)?.label}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">주소</Typography>
                      <Typography variant="body2">{form.road_address || form.address || '-'}</Typography>
                      {form.zip_code && <Typography variant="caption" color="text.secondary">우편번호: {form.zip_code}</Typography>}
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">세대수</Typography>
                      <Typography variant="body2">{form.total_units}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">주차면</Typography>
                      <Typography variant="body2">{form.total_parking_slots}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">EV 충전기</Typography>
                      <Typography variant="body2">{form.ev_charger_count}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>취소</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {activeStep > 0 && (
              <Button onClick={() => setActiveStep(s => s - 1)} disabled={saving}>이전</Button>
            )}
            {activeStep < STEPS.length - 1 ? (
              <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={!canProceed(activeStep)}>
                다음
              </Button>
            ) : (
              <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
                {saving ? <CircularProgress size={20} /> : editing ? '수정' : '등록'}
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>단지 삭제</DialogTitle>
        <DialogContent>
          <Typography>"{deleteTarget?.name}" 단지를 삭제하시겠습니까?</Typography>
          {deleteTarget?.mdm_code && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontFamily: 'monospace' }}>
              MDM: {deleteTarget.mdm_code}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyDialog} onClose={() => setHistoryDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h3">등록 이력</Typography>
          <Typography variant="caption" color="text.secondary">{historyDialog?.name}</Typography>
        </DialogTitle>
        <DialogContent>
          {history.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>이력이 없습니다.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {history.map(h => (
                <Card key={h.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip label={h.action} size="small" color={h.action === 'create' ? 'success' : 'info'} sx={{ height: 20, fontSize: '0.6rem' }} />
                      <Typography variant="caption" color="text.secondary">{new Date(h.created_at).toLocaleString('ko-KR')}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
