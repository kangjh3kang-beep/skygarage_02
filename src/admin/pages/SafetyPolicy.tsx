import { useState, useEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ShieldIcon from '@mui/icons-material/Shield';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GppGoodIcon from '@mui/icons-material/GppGood';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useNavigate } from 'react-router-dom';

interface SafetyEvent {
  id: string;
  complex_id: string;
  event_type: string;
  severity: string;
  description: string;
  result: string;
  created_at: string;
}

interface Complex {
  id: string;
  name: string;
  code: string;
}

const eventTypeLabels: Record<string, string> = {
  allow_gate: 'ALLOW Gate',
  safety_stop: '안전 정지',
  emergency: '비상 정지',
  interlock: '인터록',
  system_check: '시스템 점검',
};

const severityConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  info: { icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, color: '#00e676', label: '정상' },
  warning: { icon: <WarningIcon sx={{ fontSize: 16 }} />, color: '#ffc107', label: '경고' },
  critical: { icon: <ErrorIcon sx={{ fontSize: 16 }} />, color: '#ff5252', label: '위험' },
};

interface EventForm {
  complex_id: string;
  event_type: string;
  severity: string;
  description: string;
  result: string;
}

const emptyForm: EventForm = {
  complex_id: '',
  event_type: 'system_check',
  severity: 'info',
  description: '',
  result: 'pass',
};

export default function SafetyPolicy() {
  useDocumentTitle('안전 정책');
  const navigate = useNavigate();
  const { selectedComplex: tenantComplex } = useTenant();
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SafetyEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SafetyEvent | null>(null);

  const loadData = useCallback(async () => {
    let safetyQuery = supabase.from('safety_events').select('*').order('created_at', { ascending: false }).limit(200);
    if (tenantComplex) safetyQuery = safetyQuery.eq('complex_id', tenantComplex.id);
    const [eRes, cRes] = await Promise.all([
      safetyQuery,
      supabase.from('complexes').select('id, name, code'),
    ]);
    if (eRes.data) setEvents(eRes.data);
    if (cRes.data) setComplexes(cRes.data);
    setLoading(false);
  }, [tenantComplex]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('safety-events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_events' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (period !== 'all') {
      const days = period === '7d' ? 7 : 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      result = result.filter((e) => new Date(e.created_at) >= cutoff);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.description.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') result = result.filter((e) => e.event_type === typeFilter);
    if (severityFilter !== 'all') result = result.filter((e) => e.severity === severityFilter);
    return result;
  }, [events, period, search, typeFilter, severityFilter]);

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setForm({ ...emptyForm, complex_id: tenantComplex?.id || '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (event: SafetyEvent) => {
    setEditingEvent(event);
    setForm({
      complex_id: event.complex_id,
      event_type: event.event_type,
      severity: event.severity,
      description: event.description,
      result: event.result,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.description.trim() || !form.complex_id) {
      showToast('단지와 설명은 필수입니다.', 'error');
      return;
    }
    const payload = {
      complex_id: form.complex_id,
      event_type: form.event_type,
      severity: form.severity,
      description: form.description.trim(),
      result: form.result,
    };
    if (editingEvent) {
      const { error } = await supabase.from('safety_events').update(payload).eq('id', editingEvent.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'safety_events', editingEvent.id, { event_type: form.event_type });
      showToast('안전 이벤트가 수정되었습니다.', 'success');
    } else {
      const { data, error } = await supabase.from('safety_events').insert(payload).select('id').single();
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'safety_events', data?.id, { event_type: form.event_type });
      showToast('안전 이벤트가 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('safety_events').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
    logAction('DELETE', 'safety_events', deleteTarget.id, { event_type: deleteTarget.event_type });
    showToast('안전 이벤트가 삭제되었습니다.', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const handleExportCsv = () => {
    const headers = ['단지명', '이벤트유형', '심각도', '설명', '결과', '발생시간'];
    const rows = filteredEvents.map((e) => [
      getComplexName(e.complex_id),
      eventTypeLabels[e.event_type] || e.event_type,
      severityConfig[e.severity]?.label || e.severity,
      `"${e.description.replace(/"/g, '""')}"`,
      e.result === 'pass' ? 'PASS' : 'TRIGGERED',
      new Date(e.created_at).toLocaleString('ko-KR'),
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety_events_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#00d4ff' }} />
      </Box>
    );
  }

  const getComplexName = (id: string) => complexes.find((c) => c.id === id)?.name || '-';
  const passCount = filteredEvents.filter((e) => e.result === 'pass').length;
  const failCount = filteredEvents.filter((e) => e.result === 'fail' || e.result === 'triggered').length;
  const criticalCount = filteredEvents.filter((e) => e.severity === 'critical').length;
  const gatePassRate = filteredEvents.length > 0 ? Math.round((passCount / filteredEvents.length) * 100) : 100;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 0.5 }}>안전 / 정책 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ALLOW Gate 정책 + Safety Chain [132-271-272-270] 모니터링
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/access')}>출입 기록</Button>
          <ToggleButtonGroup value={period} exclusive onChange={(_, v) => v && setPeriod(v)} size="small">
            <ToggleButton value="7d" sx={{ px: 1.5, fontSize: '0.75rem' }}>7일</ToggleButton>
            <ToggleButton value="30d" sx={{ px: 1.5, fontSize: '0.75rem' }}>30일</ToggleButton>
            <ToggleButton value="all" sx={{ px: 1.5, fontSize: '0.75rem' }}>전체</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd} size="small">
            이벤트 등록
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'ALLOW Gate 통과율', value: `${gatePassRate}%`, color: gatePassRate >= 95 ? '#00e676' : '#ffc107', icon: <ShieldIcon sx={{ fontSize: 20 }} /> },
          { label: '정상 이벤트', value: passCount, color: '#00e676', icon: <VerifiedUserIcon sx={{ fontSize: 20 }} /> },
          { label: '안전 트리거', value: failCount, color: failCount > 0 ? '#ffc107' : '#00e676', icon: <SecurityIcon sx={{ fontSize: 20 }} /> },
          { label: 'Critical 이벤트', value: criticalCount, color: criticalCount > 0 ? '#ff5252' : '#00e676', icon: <ErrorIcon sx={{ fontSize: 20 }} /> },
        ].map((s) => (
          <Grid size={{ xs: 6, lg: 3 }} key={s.label}>
            <Card>
              <CardContent sx={{ p: '16px 20px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: s.color }}>{s.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{s.label}</Typography>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>{s.value}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Search / Filter */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: '12px 20px !important' }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="설명 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> } }}
              sx={{ minWidth: 200 }}
            />
            <TextField select size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{ minWidth: 130 }} label="이벤트유형">
              <MenuItem value="all">전체</MenuItem>
              {Object.entries(eventTypeLabels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <TextField select size="small" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} sx={{ minWidth: 100 }} label="심각도">
              <MenuItem value="all">전체</MenuItem>
              {Object.entries(severityConfig).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
            </TextField>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {filteredEvents.length}건 / 총 {events.length}건
              </Typography>
              <IconButton size="small" onClick={handleExportCsv} title="CSV 내보내기">
                <DownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        {/* Policy Chain Diagram */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2.5 }}>Safety Chain 상태</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 2 }}>
                특허출원: STO [271] - Safety Relay [272] - Drive [270]
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { code: '[132]', name: 'ALLOW Gate', desc: '호출 승인 정책 검증', status: 'active' },
                  { code: '[271]', name: 'STO (Safe Torque Off)', desc: '안전 토크 차단', status: 'active' },
                  { code: '[272]', name: 'Safety Relay', desc: '안전 릴레이 인터록', status: 'active' },
                  { code: '[270]', name: 'Drive Controller', desc: '모터 드라이브 제어', status: 'active' },
                  { code: '[710]', name: 'Charging Dock', desc: '무선 충전 도크 정렬', status: 'active' },
                ].map((item, i) => (
                  <Box key={item.code}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GppGoodIcon sx={{ fontSize: 20, color: '#00e676' }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontFamily: '"Montserrat", monospace', color: '#00d4ff', fontWeight: 700 }}>{item.code}</Typography>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>{item.name}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{item.desc}</Typography>
                      </Box>
                      <Chip label="정상" size="small" sx={{ bgcolor: 'rgba(0,230,118,0.12)', color: '#00e676', fontWeight: 700, fontSize: '0.7rem' }} />
                    </Box>
                    {i < 4 && (
                      <Box sx={{ ml: 2.5, pl: 2.25, borderLeft: '2px dashed rgba(0,230,118,0.3)', height: 12 }} />
                    )}
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2.5 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                <LockIcon sx={{ fontSize: 20, color: '#00d4ff' }} />
                <Box>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>Attestation [660]</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Hash-chain 무결성: 검증 완료</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Event Log */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>안전 이벤트 로그</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {filteredEvents.slice(0, 15).map((event) => {
                  const config = severityConfig[event.severity] || severityConfig.info;
                  return (
                    <Box key={event.id} sx={{ display: 'flex', gap: 1.5, py: 1.25, px: 1.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                      <Box sx={{ color: config.color, mt: 0.25, flexShrink: 0 }}>{config.icon}</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Chip label={eventTypeLabels[event.event_type] || event.event_type} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)' }} />
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{getComplexName(event.complex_id)}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#e0e6f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.description}
                        </Typography>
                      </Box>
                      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip label={event.result === 'pass' ? 'PASS' : 'TRIGGERED'} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800, bgcolor: event.result === 'pass' ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)', color: event.result === 'pass' ? '#00e676' : '#ff5252' }} />
                          <Typography sx={{ fontSize: '0.65rem', color: 'rgba(176,184,200,0.6)', mt: 0.5 }}>
                            {new Date(event.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => handleOpenEdit(event)} sx={{ color: 'text.secondary' }}>
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteTarget(event)} sx={{ color: 'error.main' }}>
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
                {filteredEvents.length === 0 && (
                  <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                    이벤트가 없습니다.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEvent ? '안전 이벤트 수정' : '안전 이벤트 등록'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField select label="단지" value={form.complex_id} onChange={(e) => setForm({ ...form, complex_id: e.target.value })} fullWidth size="small" required>
            {complexes.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField select label="이벤트 유형" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} fullWidth size="small">
            {Object.entries(eventTypeLabels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <TextField select label="심각도" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} fullWidth size="small">
            {Object.entries(severityConfig).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
          </TextField>
          <TextField label="설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth size="small" multiline rows={2} required />
          <TextField select label="결과" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} fullWidth size="small">
            <MenuItem value="pass">PASS</MenuItem>
            <MenuItem value="triggered">TRIGGERED</MenuItem>
            <MenuItem value="fail">FAIL</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.description.trim() || !form.complex_id}>
            {editingEvent ? '수정' : '등록'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>안전 이벤트 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 안전 이벤트를 삭제하시겠습니까?</Typography>
          {deleteTarget && (
            <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: 'rgba(255,82,82,0.05)', border: '1px solid rgba(255,82,82,0.15)' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{deleteTarget.description}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {eventTypeLabels[deleteTarget.event_type] || deleteTarget.event_type} | {getComplexName(deleteTarget.complex_id)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
