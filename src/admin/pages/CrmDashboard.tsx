import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
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
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useNavigate } from 'react-router-dom';

interface CrmLead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  stage: string;
  source: string;
  value: number;
  assigned_to: string;
  notes: string;
  lead_code: string | null;
  complex_interest: string;
  unit_count_interest: number;
  budget_range: string;
  follow_up_count: number;
  scoring: number;
  completeness_score: number;
  created_at: string;
}

const stages = ['lead', 'contact', 'proposal', 'negotiation', 'won', 'lost'];
const stageColors: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = { lead: 'default', contact: 'info', proposal: 'primary', negotiation: 'warning', won: 'success', lost: 'error' };
const LEAD_STEPS = ['기본 정보', '비즈니스 정보', '확인'];

interface FormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  stage: string;
  source: string;
  value: string;
  notes: string;
  complex_interest: string;
  unit_count_interest: string;
  budget_range: string;
}

const emptyForm: FormData = { name: '', company: '', email: '', phone: '', stage: 'lead', source: '', value: '0', notes: '', complex_interest: '', unit_count_interest: '0', budget_range: '' };

function calcLeadScore(form: FormData): number {
  let score = 0;
  if (form.company) score += 15;
  if (form.email) score += 10;
  if (form.phone) score += 10;
  if (parseInt(form.value) > 0) score += 20;
  if (parseInt(form.unit_count_interest) > 0) score += 15;
  if (form.budget_range) score += 10;
  if (form.source) score += 5;
  if (form.complex_interest) score += 15;
  return Math.min(score, 100);
}

function calcCompleteness(form: FormData): number {
  const fields = [form.name, form.company, form.email, form.phone, form.source, form.value !== '0' ? form.value : '', form.complex_interest, form.budget_range];
  return Math.round((fields.filter(f => !!f).length / fields.length) * 100);
}

export default function CrmDashboard() {
  useDocumentTitle('CRM 대시보드');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmLead | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CrmLead | null>(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [aiRecs, setAiRecs] = useState<{ id: string; title: string; priority: string; type: string }[]>([]);

  const leadScore = useMemo(() => calcLeadScore(form), [form]);
  const completeness = useMemo(() => calcCompleteness(form), [form]);

  const loadData = useCallback(async () => {
    const [leadsRes, recsRes] = await Promise.all([
      (() => {
        let query = supabase.from('crm_leads').select('*').order('created_at', { ascending: false });
        if (stageFilter !== 'all') query = query.eq('stage', stageFilter);
        return query;
      })(),
      supabase.from('ai_recommendations').select('id, title, priority, type')
        .in('status', ['pending', 'acknowledged'])
        .eq('entity_type', 'crm_leads')
        .order('created_at', { ascending: false }).limit(5),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (recsRes.data) setAiRecs(recsRes.data);
    setLoading(false);
  }, [stageFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('crm-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let leadCode = editing?.lead_code || null;
      if (!editing) {
        const { data: codeData } = await supabase.rpc('generate_entity_code', { p_entity_type: 'crm_lead', p_prefix: 'LEAD' });
        leadCode = codeData;
      }

      const payload = {
        name: form.name, company: form.company, email: form.email, phone: form.phone,
        stage: form.stage, source: form.source, value: parseFloat(form.value) || 0, notes: form.notes,
        complex_interest: form.complex_interest, unit_count_interest: parseInt(form.unit_count_interest) || 0,
        budget_range: form.budget_range, scoring: leadScore, completeness_score: completeness,
        lead_code: leadCode,
      };

      if (editing) {
        const { error } = await supabase.from('crm_leads').update(payload).eq('id', editing.id);
        if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
        logAction('UPDATE', 'crm_leads', editing.id, { name: payload.name, scoring: leadScore });
        showToast('리드가 수정되었습니다.', 'success');
      } else {
        const { error } = await supabase.from('crm_leads').insert(payload);
        if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
        logAction('CREATE', 'crm_leads', undefined, { name: payload.name, lead_code: leadCode });
        showToast('리드가 등록되었습니다.', 'success');
      }
      setDialogOpen(false);
      setActiveStep(0);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('crm_leads').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'crm_leads', deleteTarget.id, { name: deleteTarget.name });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const handleStageChange = useCallback(async (lead: CrmLead, newStage: string) => {
    const { error } = await supabase.from('crm_leads').update({ stage: newStage }).eq('id', lead.id);
    if (error) { showToast('변경 실패', 'error'); return; }
    logAction('UPDATE', 'crm_leads', lead.id, { stage_change: `${lead.stage} -> ${newStage}` });
    loadData();
  }, [showToast, logAction, loadData]);

  const pipelineTotal = leads.filter(l => l.stage !== 'lost').reduce((s, l) => s + (l.value || 0), 0);
  const wonTotal = leads.filter(l => l.stage === 'won').reduce((s, l) => s + (l.value || 0), 0);

  const pipelineAnalytics = useMemo(() => {
    const funnelStages = ['lead', 'contact', 'proposal', 'negotiation', 'won'];
    const funnel = funnelStages.map(st => ({ stage: st, count: leads.filter(l => l.stage === st).length, value: leads.filter(l => l.stage === st).reduce((s, l) => s + (l.value || 0), 0) }));
    const totalLeads = leads.length;
    const wonCount = leads.filter(l => l.stage === 'won').length;
    const lostCount = leads.filter(l => l.stage === 'lost').length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    const avgDealSize = wonCount > 0 ? Math.round(wonTotal / wonCount) : 0;
    const avgCompleteness = totalLeads > 0 ? Math.round(leads.reduce((s, l) => s + (l.completeness_score || 0), 0) / totalLeads) : 0;
    return { funnel, winRate, avgDealSize, avgCompleteness, wonCount, lostCount };
  }, [leads, wonTotal]);

  if (loading) return <Box>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />)}</Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">CRM 대시보드</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/inquiries')}>문의 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/contracts')}>계약 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/tickets')}>지원 티켓</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/partners')}>파트너</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setForm(emptyForm); setActiveStep(0); setDialogOpen(true); }}>리드 등록</Button>
        </Box>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">전체 리드</Typography><Typography variant="h2">{leads.length}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">파이프라인 금액</Typography><Typography variant="h2">{pipelineTotal.toLocaleString()}원</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">수주 금액</Typography><Typography variant="h2" color="success.main">{wonTotal.toLocaleString()}원</Typography></CardContent></Card></Grid>
        {stages.map(st => (
          <Grid key={st} size={{ xs: 4, md: 2 }}><Card><CardContent sx={{ textAlign: 'center', py: 1 }}><Chip label={st} size="small" color={stageColors[st]} /><Typography variant="body2" sx={{ fontWeight: 600 }}>{leads.filter(l => l.stage === st).length}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      {/* Pipeline Analytics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: '16px 20px !important' }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>파이프라인 퍼널</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {pipelineAnalytics.funnel.map((item, idx) => {
                  const maxCount = Math.max(...pipelineAnalytics.funnel.map(f => f.count), 1);
                  const widthPct = (item.count / maxCount) * 100;
                  return (
                    <Box key={item.stage} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="caption" sx={{ width: 80, textAlign: 'right', fontWeight: 600 }}>{item.stage}</Typography>
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        <Box sx={{
                          height: 28,
                          borderRadius: 1,
                          bgcolor: idx === 4 ? 'rgba(0,230,118,0.2)' : `rgba(0,212,255,${0.3 - idx * 0.05})`,
                          border: `1px solid ${idx === 4 ? 'rgba(0,230,118,0.4)' : `rgba(0,212,255,${0.4 - idx * 0.05})`}`,
                          width: `${Math.max(widthPct, 8)}%`,
                          display: 'flex', alignItems: 'center', px: 1.5,
                          transition: 'width 0.3s ease',
                        }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>{item.count}건</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ width: 90, textAlign: 'right', color: 'text.secondary' }}>{item.value.toLocaleString()}원</Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: '16px 20px !important', textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">수주율 (Win Rate)</Typography>
              <Typography variant="h2" sx={{ color: pipelineAnalytics.winRate >= 50 ? 'success.main' : pipelineAnalytics.winRate >= 30 ? 'warning.main' : 'error.main' }}>
                {pipelineAnalytics.winRate}%
              </Typography>
              <Typography variant="caption" color="text.secondary">{pipelineAnalytics.wonCount}건 수주 / {pipelineAnalytics.lostCount}건 실주</Typography>
            </CardContent>
          </Card>
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: '16px 20px !important', textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">평균 딜 사이즈</Typography>
              <Typography variant="h2">{pipelineAnalytics.avgDealSize.toLocaleString()}원</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ p: '16px 20px !important', textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">평균 데이터 완성도</Typography>
              <Typography variant="h2" sx={{ color: pipelineAnalytics.avgCompleteness >= 80 ? 'success.main' : 'warning.main' }}>
                {pipelineAnalytics.avgCompleteness}%
              </Typography>
              <LinearProgress variant="determinate" value={pipelineAnalytics.avgCompleteness} sx={{ mt: 1, height: 6, borderRadius: 3 }} color={pipelineAnalytics.avgCompleteness >= 80 ? 'success' : 'warning'} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <TextField select size="small" value={stageFilter} onChange={e => setStageFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체 단계</MenuItem>
          {stages.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </Box>

      {aiRecs.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button size="small" onClick={() => navigate('/admin/ai-management')}>상세</Button>}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>AI Next Best Action</Typography>
          {aiRecs.slice(0, 3).map(rec => (
            <Typography key={rec.id} variant="caption" sx={{ display: 'block' }}>
              - {rec.title}
            </Typography>
          ))}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>이름</TableCell><TableCell>회사</TableCell><TableCell>단계</TableCell>
              <TableCell align="right">금액</TableCell><TableCell>점수</TableCell><TableCell>완성도</TableCell><TableCell align="center">관리</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {leads.map(l => (
                <TableRow key={l.id} hover>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{l.name}</Typography></TableCell>
                  <TableCell>{l.company || '-'}</TableCell>
                  <TableCell>
                    <TextField select size="small" value={l.stage} onChange={e => handleStageChange(l, e.target.value)} variant="standard" sx={{ minWidth: 100 }}>
                      {stages.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">{l.value ? l.value.toLocaleString() + '원' : '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${l.scoring || 0}점`}
                      size="small"
                      color={(l.scoring || 0) >= 70 ? 'error' : (l.scoring || 0) >= 40 ? 'warning' : 'default'}
                      sx={{ fontSize: '0.625rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${l.completeness_score || 0}%`}
                      size="small"
                      color={(l.completeness_score || 0) >= 80 ? 'success' : (l.completeness_score || 0) >= 50 ? 'warning' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => { setEditing(l); setForm({ name: l.name, company: l.company || '', email: l.email || '', phone: l.phone || '', stage: l.stage, source: l.source || '', value: String(l.value || 0), notes: l.notes || '', complex_interest: l.complex_interest || '', unit_count_interest: String(l.unit_count_interest || 0), budget_range: l.budget_range || '' }); setActiveStep(0); setDialogOpen(true); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(l)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{editing ? '리드 수정' : '리드 등록'}</Typography>
          <Typography variant="caption" color="text.secondary">AI 리드 스코어링 기반 체계적 관리</Typography>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
            {LEAD_STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Alert severity="info" sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>리드 스코어</Typography>
                <Chip label={`${leadScore}점`} size="small" color={leadScore >= 70 ? 'success' : leadScore >= 40 ? 'warning' : 'default'} />
              </Box>
              <LinearProgress variant="determinate" value={leadScore} sx={{ mt: 0.5, borderRadius: 1, height: 6 }} color={leadScore >= 70 ? 'success' : leadScore >= 40 ? 'warning' : 'error'} />
            </Alert>
          </Box>

          {activeStep === 0 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="담당자 이름 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="회사명" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="이메일" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth size="small" type="email" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="전화번호" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="단계" select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} fullWidth size="small">
                  {stages.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="유입 경로" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} fullWidth size="small" placeholder="웹사이트, 전시회, 소개 등" /></Grid>
            </Grid>
          )}

          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="예상 딜 금액 (원)" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="예산 범위" value={form.budget_range} onChange={e => setForm({ ...form, budget_range: e.target.value })} fullWidth size="small" placeholder="1억~5억" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="관심 단지/프로젝트" value={form.complex_interest} onChange={e => setForm({ ...form, complex_interest: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="관심 세대수" type="number" value={form.unit_count_interest} onChange={e => setForm({ ...form, unit_count_interest: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12 }}><TextField label="메모" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth size="small" multiline rows={2} /></Grid>
            </Grid>
          )}

          {activeStep === 2 && (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>등록 확인</Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">이름</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{form.name}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">회사</Typography><Typography variant="body2">{form.company || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">단계</Typography><Chip label={form.stage} size="small" color={stageColors[form.stage]} /></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">금액</Typography><Typography variant="body2">{parseInt(form.value).toLocaleString()}원</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">관심 단지</Typography><Typography variant="body2">{form.complex_interest || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">관심 세대</Typography><Typography variant="body2">{form.unit_count_interest}세대</Typography></Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">리드 스코어</Typography>
                  <Chip label={leadScore >= 70 ? '핫 리드' : leadScore >= 40 ? '웜 리드' : '콜드 리드'} size="small" color={leadScore >= 70 ? 'success' : leadScore >= 40 ? 'warning' : 'default'} sx={{ ml: 1 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">완성도</Typography>
                  <Chip label={`${completeness}%`} size="small" color={completeness >= 80 ? 'success' : 'warning'} sx={{ ml: 1 }} />
                </Box>
              </Box>
            </Card>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
            {activeStep < LEAD_STEPS.length - 1 ? (
              <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={!form.name}>다음</Button>
            ) : (
              <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>{saving ? '저장 중...' : editing ? '수정' : '등록'}</Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>리드 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.name}" 리드를 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
