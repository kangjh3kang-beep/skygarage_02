import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Patent {
  id: string;
  title: string;
  title_en: string;
  patent_number: string;
  application_number: string;
  application_date: string;
  registration_date: string;
  expiry_date: string;
  status: string;
  category: string;
  technology_area: string;
  abstract: string;
  claims_count: number;
  country: string;
  assignee: string;
  attorney: string;
  notes: string;
  entity_code: string;
  completeness_score: number;
  created_at: string;
}

const STEPS = ['기본 정보', '출원 정보', '기술 상세', '확인'];

const STATUS_OPTIONS = [
  { value: 'pending', label: '준비중', color: 'default' },
  { value: 'filed', label: '출원', color: 'info' },
  { value: 'under_review', label: '심사중', color: 'warning' },
  { value: 'granted', label: '등록', color: 'success' },
  { value: 'rejected', label: '거절', color: 'error' },
  { value: 'expired', label: '만료', color: 'default' },
  { value: 'abandoned', label: '포기', color: 'default' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'utility', label: '특허(발명)' },
  { value: 'design', label: '디자인' },
  { value: 'trademark', label: '상표' },
  { value: 'international', label: '국제출원(PCT)' },
];

const TECH_AREA_OPTIONS = [
  { value: 'atr', label: 'ATR 자율운반로봇' },
  { value: 'elevator', label: '차량용 엘리베이터' },
  { value: 'parking', label: '주차 시스템' },
  { value: 'ev_charging', label: 'EV 충전' },
  { value: 'ai', label: 'AI/딥러닝' },
  { value: 'iot', label: 'IoT/센서' },
  { value: 'v2g', label: 'V2G 에너지' },
  { value: 'safety', label: '안전/보안' },
  { value: 'other', label: '기타' },
];

const COUNTRY_OPTIONS = [
  { value: 'KR', label: '대한민국' },
  { value: 'US', label: '미국' },
  { value: 'JP', label: '일본' },
  { value: 'CN', label: '중국' },
  { value: 'EU', label: '유럽(EPO)' },
  { value: 'PCT', label: 'PCT 국제' },
];

const emptyForm = {
  title: '', title_en: '', patent_number: '', application_number: '',
  application_date: '', registration_date: '', expiry_date: '',
  status: 'pending', category: 'utility', technology_area: 'atr',
  abstract: '', claims_count: '0', country: 'KR',
  assignee: 'SkyGarage Inc.', attorney: '', notes: '',
};

function calcCompleteness(form: typeof emptyForm): number {
  const fields = [
    { val: form.title, w: 15 },
    { val: form.application_number, w: 10 },
    { val: form.application_date, w: 10 },
    { val: form.technology_area, w: 10 },
    { val: form.category, w: 5 },
    { val: form.country, w: 5 },
    { val: form.abstract, w: 15 },
    { val: form.claims_count !== '0' ? form.claims_count : '', w: 10 },
    { val: form.assignee, w: 5 },
    { val: form.attorney, w: 5 },
    { val: form.title_en, w: 5 },
    { val: form.patent_number, w: 5 },
  ];
  return fields.reduce((sum, f) => sum + (f.val ? f.w : 0), 0);
}

export default function PatentManagement() {
  useDocumentTitle('특허 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patents, setPatents] = useState<Patent[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Patent | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const completeness = useMemo(() => calcCompleteness(form), [form]);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('patents').select('*').order('created_at', { ascending: false });
    if (data) setPatents(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('patents-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patents' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const openCreate = async () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    setGeneratedCode('');
    setDialogOpen(true);
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'PAT' });
    if (data) setGeneratedCode(data);
  };

  const openEdit = (patent: Patent) => {
    setEditing(patent);
    setGeneratedCode(patent.entity_code || '');
    setForm({
      title: patent.title,
      title_en: patent.title_en || '',
      patent_number: patent.patent_number || '',
      application_number: patent.application_number || '',
      application_date: patent.application_date || '',
      registration_date: patent.registration_date || '',
      expiry_date: patent.expiry_date || '',
      status: patent.status,
      category: patent.category,
      technology_area: patent.technology_area || 'other',
      abstract: patent.abstract || '',
      claims_count: String(patent.claims_count || 0),
      country: patent.country || 'KR',
      assignee: patent.assignee || 'SkyGarage Inc.',
      attorney: patent.attorney || '',
      notes: patent.notes || '',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title,
      title_en: form.title_en,
      patent_number: form.patent_number || null,
      application_number: form.application_number,
      application_date: form.application_date || null,
      registration_date: form.registration_date || null,
      expiry_date: form.expiry_date || null,
      status: form.status,
      category: form.category,
      technology_area: form.technology_area,
      abstract: form.abstract,
      claims_count: parseInt(form.claims_count) || 0,
      country: form.country,
      assignee: form.assignee,
      attorney: form.attorney,
      notes: form.notes,
      entity_code: generatedCode || null,
      completeness_score: completeness,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from('patents').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'patents', editing.id, { title: payload.title });
      showToast('특허가 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('patents').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'patents', undefined, { title: payload.title });
      showToast('특허가 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('patents').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'patents', deleteTarget.id, { title: deleteTarget.title });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const getStatusChip = (status: string) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return <Chip label={opt?.label || status} color={opt?.color as 'default'} size="small" />;
  };

  const filtered = patents.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.patent_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.title_en || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: patents.length,
    granted: patents.filter(p => p.status === 'granted').length,
    pending: patents.filter(p => ['pending', 'filed', 'under_review'].includes(p.status)).length,
    international: patents.filter(p => p.country !== 'KR').length,
    avgCompleteness: patents.length > 0 ? Math.round(patents.reduce((s, p) => s + (p.completeness_score || 0), 0) / patents.length) : 0,
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">엔티티 코드</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{generatedCode || '생성 중...'}</Typography>
            </Box>
            <TextField fullWidth label="특허명 (한글) *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} size="small" />
            <TextField fullWidth label="특허명 (영문)" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} size="small" />
            <TextField fullWidth select label="상태" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} size="small">
              {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
            <TextField fullWidth select label="국가" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} size="small">
              {COUNTRY_OPTIONS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="특허번호" value={form.patent_number} onChange={e => setForm({ ...form, patent_number: e.target.value })} size="small" placeholder="KR-10-2024-0001234" />
            <TextField fullWidth label="출원번호" value={form.application_number} onChange={e => setForm({ ...form, application_number: e.target.value })} size="small" />
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}><TextField fullWidth type="date" label="출원일" value={form.application_date} onChange={e => setForm({ ...form, application_date: e.target.value })} size="small" slotProps={{ inputLabel: { shrink: true } }} /></Grid>
              <Grid size={{ xs: 4 }}><TextField fullWidth type="date" label="등록일" value={form.registration_date} onChange={e => setForm({ ...form, registration_date: e.target.value })} size="small" slotProps={{ inputLabel: { shrink: true } }} /></Grid>
              <Grid size={{ xs: 4 }}><TextField fullWidth type="date" label="만료일" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} size="small" slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            </Grid>
            <TextField fullWidth label="출원인" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} size="small" />
            <TextField fullWidth label="대리인 (변리사)" value={form.attorney} onChange={e => setForm({ ...form, attorney: e.target.value })} size="small" />
          </Box>
        );
      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth select label="분류" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} size="small">
              {CATEGORY_OPTIONS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
            <TextField fullWidth select label="기술분야" value={form.technology_area} onChange={e => setForm({ ...form, technology_area: e.target.value })} size="small">
              {TECH_AREA_OPTIONS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="청구항 수" type="number" value={form.claims_count} onChange={e => setForm({ ...form, claims_count: e.target.value })} size="small" />
            <TextField fullWidth multiline rows={3} label="초록/요약" value={form.abstract} onChange={e => setForm({ ...form, abstract: e.target.value })} size="small" />
            <TextField fullWidth multiline rows={2} label="메모" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} size="small" />
          </Box>
        );
      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">등록 정보 확인</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">완성도</Typography>
              <LinearProgress variant="determinate" value={completeness} sx={{ flex: 1, height: 8, borderRadius: 1 }} color={completeness >= 80 ? 'success' : completeness >= 50 ? 'warning' : 'error'} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{completeness}%</Typography>
            </Box>
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
              <Grid container spacing={1}>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">코드</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{generatedCode}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">특허명</Typography><Typography variant="body2">{form.title || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">국가</Typography><Typography variant="body2">{COUNTRY_OPTIONS.find(c => c.value === form.country)?.label}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">상태</Typography><Typography variant="body2">{STATUS_OPTIONS.find(s => s.value === form.status)?.label}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">기술분야</Typography><Typography variant="body2">{TECH_AREA_OPTIONS.find(t => t.value === form.technology_area)?.label}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">출원번호</Typography><Typography variant="body2">{form.application_number || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">청구항</Typography><Typography variant="body2">{form.claims_count}건</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">출원인</Typography><Typography variant="body2">{form.assignee || '-'}</Typography></Grid>
              </Grid>
            </Box>
          </Box>
        );
      default: return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>특허 관리</Typography>
          <Typography variant="body2" color="text.secondary">Patent Portfolio Management</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/licenses')}>라이선스 관리</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>특허 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '전체 특허', value: String(stats.total), color: 'text.primary' },
          { label: '등록완료', value: String(stats.granted), color: 'success.main' },
          { label: '심사/출원중', value: String(stats.pending), color: 'warning.main' },
          { label: '해외출원', value: String(stats.international), color: 'info.main' },
          { label: '평균 완성도', value: `${stats.avgCompleteness}%`, color: stats.avgCompleteness >= 80 ? 'success.main' : stats.avgCompleteness >= 50 ? 'warning.main' : 'error.main' },
        ].map(s => (
          <Grid size={{ xs: 6, md: 2.4 }} key={s.label}>
            <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 2, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small" placeholder="특허명, 번호 검색..." value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: 240 }}
          />
          <Tabs value={statusFilter} onChange={(_, v) => setStatusFilter(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="전체" value="all" />
            {STATUS_OPTIONS.map(s => <Tab key={s.value} label={s.label} value={s.value} />)}
          </Tabs>
        </Box>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>코드</TableCell>
                <TableCell>특허명</TableCell>
                <TableCell>번호</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>기술분야</TableCell>
                <TableCell>국가</TableCell>
                <TableCell>완성도</TableCell>
                <TableCell align="right">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <DescriptionIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">등록된 특허가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(patent => {
                const cs = patent.completeness_score || 0;
                return (
                  <TableRow key={patent.id} hover>
                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{patent.entity_code || '-'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{patent.title}</Typography>
                      {patent.title_en && <Typography variant="caption" color="text.secondary">{patent.title_en}</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{patent.patent_number || patent.application_number || '-'}</Typography></TableCell>
                    <TableCell>{getStatusChip(patent.status)}</TableCell>
                    <TableCell><Chip label={TECH_AREA_OPTIONS.find(t => t.value === patent.technology_area)?.label || patent.technology_area} size="small" variant="outlined" /></TableCell>
                    <TableCell>{COUNTRY_OPTIONS.find(c => c.value === patent.country)?.label || patent.country}</TableCell>
                    <TableCell><Chip label={`${cs}%`} size="small" color={cs >= 80 ? 'success' : cs >= 50 ? 'warning' : 'error'} variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(patent)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(patent)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '특허 수정' : '특허 등록'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LinearProgress variant="determinate" value={completeness} sx={{ flex: 1, height: 6, borderRadius: 1 }} color={completeness >= 80 ? 'success' : completeness >= 50 ? 'warning' : 'error'} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{completeness}%</Typography>
          </Box>
          {renderStep()}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
          {activeStep < STEPS.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.title}>다음</Button>
          ) : (
            <Button variant="contained" onClick={handleSave} disabled={!form.title}>{editing ? '수정' : '등록'}</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>특허 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.title}" 특허를 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
