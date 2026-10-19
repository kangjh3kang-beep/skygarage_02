import { useState, useEffect, useCallback } from 'react';
import Alert from '@mui/material/Alert';
import { requireResult, operationError } from '../../lib/operation-result';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import LinearProgress from '@mui/material/LinearProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  tier: string;
  steps: Array<{ step: number; name: string; action: string; timeout: number }>;
  active: boolean;
}

interface WorkflowExec {
  id: string;
  definition_id: string;
  status: string;
  current_step: number;
  context: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  running: <PlayArrowIcon sx={{ fontSize: 16, color: 'info.main' }} />,
  pending: <PauseIcon sx={{ fontSize: 16, color: 'warning.main' }} />,
  completed: <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />,
  failed: <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />,
  waiting: <PauseIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
};

interface DefForm {
  name: string;
  description: string;
  trigger_event: string;
  tier: string;
  active: boolean;
}

const emptyDefForm: DefForm = { name: '', description: '', trigger_event: '', tier: 'T3', active: true };

export default function WorkflowManager() {
  useDocumentTitle('Workflow Manager');
  const navigate = useNavigate();
  const theme = useTheme();
  const { logAction } = useAuditLog();
  const [definitions, setDefinitions] = useState<WorkflowDef[]>([]);
  const [executions, setExecutions] = useState<WorkflowExec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<WorkflowDef | null>(null);
  const [defForm, setDefForm] = useState<DefForm>(emptyDefForm);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const results = await Promise.all([
        supabase.from('workflow_definitions').select('*').order('name'),
        supabase.from('workflow_executions').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      results.forEach(requireResult);
      setDefinitions(results[0].data || []); setExecutions(results[1].data || []);
    } catch (e) {
      setDefinitions([]); setExecutions([]); setError(operationError(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase.channel('workflow-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_executions' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const getDefName = (defId: string) => definitions.find(d => d.id === defId)?.name || defId;

  const unavailable = () => setError('현장 워크플로 엔진은 인수 전입니다. 실행·처리·이벤트 소비를 사용할 수 없습니다.');
  const triggerWorkflow = async (_triggerEvent: string) => unavailable();
  const processWorkflows = async () => unavailable();
  const consumeEvents = async () => unavailable();

  const handleOpenAdd = () => {
    setEditingDef(null);
    setDefForm(emptyDefForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (def: WorkflowDef) => {
    setEditingDef(def);
    setDefForm({ name: def.name, description: def.description || '', trigger_event: def.trigger_event, tier: def.tier, active: def.active });
    setDialogOpen(true);
  };

  const handleSaveDef = async () => {
    const payload = { name: defForm.name.trim(), description: defForm.description.trim(), trigger_event: defForm.trigger_event.trim(), tier: defForm.tier, active: defForm.active };
    if (!payload.name || !payload.trigger_event) return;
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = editingDef
        ? await supabase.from('workflow_definitions').update(payload).eq('id', editingDef.id).select('id').single()
        : await supabase.from('workflow_definitions').insert({ ...payload, steps: [] }).select('id').single();
      const row = requireResult(result);
      if (!row?.id) throw new Error('missing_write_receipt');
      const audit = await logAction(editingDef ? 'update' : 'create', 'workflow_definitions', row.id, { name: payload.name });
      if (!audit.ok) throw new Error('audit_failed');
      setDialogOpen(false);
      await fetchData();
    } catch (e) { setError(operationError(e)); }
    finally { setBusy(false); }
  };

  const handleToggleActive = async (_def: WorkflowDef) => unavailable();
  // Deletion must be one authorized server transaction, never two browser deletes.
  const handleDeleteDef = async () => setError('삭제와 감사 기록을 함께 검증하는 서버 기능 연결 후 사용할 수 있습니다.');

  const stats = {
    total: definitions.length,
    active: definitions.filter(d => d.active).length,
    running: executions.filter(e => e.status === 'running').length,
    failed: executions.filter(e => e.status === 'failed').length,
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <AccountTreeIcon sx={{ color: theme.palette.info.main, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Workflow Manager</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            워크플로우 정의 관리 및 실행 이력 모니터링
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/observability')}>관측성</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/events')}>이벤트 로그</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>현장 인수 전 화면입니다. 실제 워크플로 실행·삭제·활성 변경은 제공하지 않습니다.</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress aria-label="워크플로 조회 중" />}
      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{loading || error ? '—' : stats.total}</Typography>
              <Typography variant="caption" color="text.secondary">정의된 워크플로우</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }} color="success.main">{loading || error ? '—' : stats.active}</Typography>
              <Typography variant="caption" color="text.secondary">활성</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }} color="info.main">{loading || error ? '—' : stats.running}</Typography>
              <Typography variant="caption" color="text.secondary">실행중</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }} color="error.main">{loading || error ? '—' : stats.failed}</Typography>
              <Typography variant="caption" color="text.secondary">실패</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="워크플로우 정의" />
          <Tab label="실행 이력" />
        </Tabs>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            워크플로우 추가
          </Button>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={processWorkflows}>
            실행 처리
          </Button>
          <Button size="small" variant="outlined" onClick={consumeEvents}>
            이벤트 소비
          </Button>
          <IconButton size="small" onClick={fetchData}><RefreshIcon fontSize="small" /></IconButton>
        </Box>
      </Box>

      {tab === 0 && (
        <Card>
          <CardContent>
            <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>이름</TableCell>
                    <TableCell>설명</TableCell>
                    <TableCell align="center">Tier</TableCell>
                    <TableCell>트리거</TableCell>
                    <TableCell align="center">스텝 수</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="center">실행</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {definitions.map(def => (
                    <TableRow key={def.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{def.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{def.description}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={def.tier} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{def.trigger_event}</Typography>
                      </TableCell>
                      <TableCell align="center">{def.steps?.length || 0}</TableCell>
                      <TableCell align="center">
                        <Switch size="small" checked={def.active} onChange={() => handleToggleActive(def)} />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <IconButton size="small" onClick={() => handleOpenEdit(def)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="primary" onClick={() => triggerWorkflow(def.trigger_event)} disabled={!def.active}>
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            {executions.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                실행 이력이 없습니다
              </Typography>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>워크플로우</TableCell>
                      <TableCell align="center">상태</TableCell>
                      <TableCell align="center">현재 스텝</TableCell>
                      <TableCell>진행률</TableCell>
                      <TableCell>시작시간</TableCell>
                      <TableCell>오류</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {executions.map(exec => {
                      const def = definitions.find(d => d.id === exec.definition_id);
                      const totalSteps = def?.steps?.length || 1;
                      const progress = (exec.current_step / totalSteps) * 100;
                      return (
                        <TableRow key={exec.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{getDefName(exec.definition_id)}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                              {statusIcons[exec.status]}
                              <Typography variant="caption">{exec.status}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">{exec.current_step}/{totalSteps}</TableCell>
                          <TableCell>
                            <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 6 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {exec.started_at ? new Date(exec.started_at).toLocaleString('ko-KR') : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {exec.error_message && (
                              <Typography variant="caption" color="error.main" noWrap sx={{ maxWidth: 150, display: 'block' }}>
                                {exec.error_message}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
      {/* Workflow Definition Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingDef ? '워크플로우 수정' : '워크플로우 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="이름" value={defForm.name} onChange={e => setDefForm({ ...defForm, name: e.target.value })} fullWidth />
          <TextField label="설명" value={defForm.description} onChange={e => setDefForm({ ...defForm, description: e.target.value })} multiline rows={2} fullWidth />
          <TextField label="트리거 이벤트" value={defForm.trigger_event} onChange={e => setDefForm({ ...defForm, trigger_event: e.target.value })} fullWidth placeholder="예: parking.entry, alert.created" />
          <FormControl fullWidth>
            <InputLabel>Tier</InputLabel>
            <Select value={defForm.tier} label="Tier" onChange={e => setDefForm({ ...defForm, tier: e.target.value })}>
              <MenuItem value="T0">T0</MenuItem>
              <MenuItem value="T1">T1</MenuItem>
              <MenuItem value="T2">T2</MenuItem>
              <MenuItem value="T3">T3</MenuItem>
              <MenuItem value="T4">T4</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ justifyContent: editingDef ? 'space-between' : 'flex-end', px: 3, pb: 2 }}>
          {editingDef && (
            <Button color="error" onClick={handleDeleteDef}>삭제</Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)}>취소</Button>
            <Button variant="contained" onClick={handleSaveDef} disabled={busy || !defForm.name.trim() || !defForm.trigger_event.trim()}>
              {editingDef ? '저장' : '추가'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
