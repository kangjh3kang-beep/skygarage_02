import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import FlagIcon from '@mui/icons-material/Flag';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTheme } from '@mui/material/styles';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  name: string;
  status: string;
  phase: string;
  budget_krw: number;
  spent_krw: number;
  start_date: string;
  target_date: string;
  completed_date: string | null;
  manager: string;
  description: string;
  region_id: string | null;
}

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  completed_at: string | null;
  status: string;
  sort_order: number;
}

const phaseLabels: Record<string, string> = {
  design: '설계',
  permit: '인허가',
  construction: '시공',
  testing: '테스트',
  commissioning: '커미셔닝',
};

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  planning: 'default',
  in_progress: 'info',
  completed: 'success',
  on_hold: 'warning',
  cancelled: 'error',
};

export default function ProjectTracker() {
  useDocumentTitle('T4 Project Tracker');
  const navigate = useNavigate();
  const theme = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', description: '', manager: '', budget_krw: '', phase: 'design', status: 'planning' });
  const [msDialog, setMsDialog] = useState(false);
  const [msForm, setMsForm] = useState({ title: '', due_date: '', status: 'pending' });
  const [editingMs, setEditingMs] = useState<Milestone | null>(null);

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    if (selectedProject) fetchMilestones(selectedProject);
  }, [selectedProject]);

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (data) {
      setProjects(data);
      if (data.length > 0 && !selectedProject) setSelectedProject(data[0].id);
    }
  };

  const fetchMilestones = async (projectId: string) => {
    const { data } = await supabase.from('project_milestones').select('*').eq('project_id', projectId).order('sort_order');
    if (data) setMilestones(data);
  };

  const handleSaveProject = async () => {
    const payload = {
      name: form.name,
      description: form.description,
      manager: form.manager,
      budget_krw: Number(form.budget_krw) || 0,
      phase: form.phase,
      status: form.status,
    };
    if (editingProject) {
      await supabase.from('projects').update(payload).eq('id', editingProject.id);
    } else {
      await supabase.from('projects').insert({
        ...payload,
        start_date: new Date().toISOString().split('T')[0],
        target_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      });
    }
    setDialogOpen(false);
    setEditingProject(null);
    setForm({ name: '', description: '', manager: '', budget_krw: '', phase: 'design', status: 'planning' });
    fetchProjects();
  };

  const handleDeleteProject = async (id: string) => {
    await supabase.from('project_milestones').delete().eq('project_id', id);
    await supabase.from('projects').delete().eq('id', id);
    setSelectedProject('');
    fetchProjects();
  };

  const openEditProject = (p: Project) => {
    setEditingProject(p);
    setForm({ name: p.name, description: p.description || '', manager: p.manager || '', budget_krw: String(p.budget_krw || ''), phase: p.phase, status: p.status });
    setDialogOpen(true);
  };

  const handleSaveMilestone = async () => {
    if (editingMs) {
      await supabase.from('project_milestones').update({ title: msForm.title, due_date: msForm.due_date, status: msForm.status, completed_at: msForm.status === 'completed' ? new Date().toISOString() : null }).eq('id', editingMs.id);
    } else {
      await supabase.from('project_milestones').insert({ project_id: selectedProject, title: msForm.title, due_date: msForm.due_date, status: msForm.status, sort_order: milestones.length + 1 });
    }
    setMsDialog(false);
    setEditingMs(null);
    setMsForm({ title: '', due_date: '', status: 'pending' });
    fetchMilestones(selectedProject);
  };

  const handleDeleteMilestone = async (id: string) => {
    await supabase.from('project_milestones').delete().eq('id', id);
    fetchMilestones(selectedProject);
  };

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget_krw || 0), 0);
  const activeProjects = projects.filter(p => p.status === 'in_progress').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const currentProject = projects.find(p => p.id === selectedProject);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <AccountTreeIcon sx={{ color: theme.palette.secondary.main, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>T4 Project Tracker</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            신규 설치 프로젝트 관리 및 진도 추적
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/contracts')}>계약 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/partners')}>파트너</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            프로젝트 추가
          </Button>
        </Box>
      </Box>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <FlagIcon sx={{ fontSize: 32, color: theme.palette.info.main, mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{activeProjects}</Typography>
              <Typography variant="caption" color="text.secondary">진행중</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 32, color: theme.palette.success.main, mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{completedProjects}</Typography>
              <Typography variant="caption" color="text.secondary">완료</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AttachMoneyIcon sx={{ fontSize: 32, color: theme.palette.warning.main, mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{(totalBudget / 100000000).toFixed(0)}</Typography>
              <Typography variant="caption" color="text.secondary">총 예산 (억원)</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CalendarTodayIcon sx={{ fontSize: 32, color: theme.palette.error.main, mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{projects.length}</Typography>
              <Typography variant="caption" color="text.secondary">전체 프로젝트</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Project Table */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>프로젝트 목록</Typography>
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>프로젝트명</TableCell>
                  <TableCell>단계</TableCell>
                  <TableCell align="center">상태</TableCell>
                  <TableCell>담당자</TableCell>
                  <TableCell>예산 집행률</TableCell>
                  <TableCell>목표일</TableCell>
                  <TableCell align="center">상세</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((project) => {
                  const spentRate = project.budget_krw > 0 ? (project.spent_krw / project.budget_krw) * 100 : 0;
                  return (
                    <TableRow
                      key={project.id}
                      hover
                      selected={project.id === selectedProject}
                      onClick={() => setSelectedProject(project.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{project.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={phaseLabels[project.phase] || project.phase} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={project.status} size="small" color={statusColors[project.status] || 'default'} />
                      </TableCell>
                      <TableCell>{project.manager}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(spentRate, 100)}
                            sx={{ flex: 1, borderRadius: 1, height: 6 }}
                            color={spentRate > 90 ? 'error' : spentRate > 70 ? 'warning' : 'info'}
                          />
                          <Typography variant="caption">{spentRate.toFixed(0)}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{project.target_date || '-'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditProject(project); }}><EditIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Milestones */}
      {currentProject && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                마일스톤 - {currentProject.name}
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => { setEditingMs(null); setMsForm({ title: '', due_date: '', status: 'pending' }); setMsDialog(true); }}>
                마일스톤 추가
              </Button>
            </Box>
            {milestones.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                등록된 마일스톤이 없습니다
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {milestones.map((ms, idx) => (
                  <Box
                    key={ms.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: ms.completed_at ? 'success.main' : 'divider',
                      bgcolor: ms.completed_at ? 'success.main' : 'transparent',
                      ...(ms.completed_at && { bgcolor: 'rgba(46,125,50,0.08)' }),
                    }}
                  >
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: ms.completed_at ? 'success.main' : 'action.hover' }}>
                      <Typography variant="caption" sx={{ color: ms.completed_at ? 'common.white' : 'text.secondary', fontWeight: 700 }}>
                        {idx + 1}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, textDecoration: ms.completed_at ? 'line-through' : 'none' }}>
                        {ms.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        기한: {ms.due_date}
                      </Typography>
                    </Box>
                    <Chip
                      label={ms.status}
                      size="small"
                      color={ms.status === 'completed' ? 'success' : ms.status === 'overdue' ? 'error' : ms.status === 'in_progress' ? 'info' : 'default'}
                    />
                    <IconButton size="small" onClick={() => { setEditingMs(ms); setMsForm({ title: ms.title, due_date: ms.due_date, status: ms.status }); setMsDialog(true); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project Dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingProject(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProject ? '프로젝트 수정' : '새 프로젝트 생성'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="프로젝트명" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="설명" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth />
          <TextField label="담당자" value={form.manager} onChange={e => setForm({ ...form, manager: e.target.value })} fullWidth />
          <TextField label="예산 (원)" type="number" value={form.budget_krw} onChange={e => setForm({ ...form, budget_krw: e.target.value })} fullWidth />
          <FormControl fullWidth>
            <InputLabel>단계</InputLabel>
            <Select value={form.phase} label="단계" onChange={e => setForm({ ...form, phase: e.target.value })}>
              <MenuItem value="design">설계</MenuItem>
              <MenuItem value="permit">인허가</MenuItem>
              <MenuItem value="construction">시공</MenuItem>
              <MenuItem value="testing">테스트</MenuItem>
              <MenuItem value="commissioning">커미셔닝</MenuItem>
            </Select>
          </FormControl>
          {editingProject && (
            <FormControl fullWidth>
              <InputLabel>상태</InputLabel>
              <Select value={form.status} label="상태" onChange={e => setForm({ ...form, status: e.target.value })}>
                <MenuItem value="planning">계획</MenuItem>
                <MenuItem value="in_progress">진행중</MenuItem>
                <MenuItem value="completed">완료</MenuItem>
                <MenuItem value="on_hold">보류</MenuItem>
                <MenuItem value="cancelled">취소</MenuItem>
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: editingProject ? 'space-between' : 'flex-end', px: 3, pb: 2 }}>
          {editingProject && (
            <Button color="error" onClick={() => { if (confirm('프로젝트를 삭제하시겠습니까?')) { handleDeleteProject(editingProject.id); setDialogOpen(false); setEditingProject(null); } }}>
              삭제
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => { setDialogOpen(false); setEditingProject(null); }}>취소</Button>
            <Button variant="contained" onClick={handleSaveProject} disabled={!form.name}>
              {editingProject ? '저장' : '생성'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Milestone Dialog */}
      <Dialog open={msDialog} onClose={() => { setMsDialog(false); setEditingMs(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMs ? '마일스톤 수정' : '마일스톤 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="마일스톤명" value={msForm.title} onChange={e => setMsForm({ ...msForm, title: e.target.value })} fullWidth />
          <TextField label="기한" type="date" value={msForm.due_date} onChange={e => setMsForm({ ...msForm, due_date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <FormControl fullWidth>
            <InputLabel>상태</InputLabel>
            <Select value={msForm.status} label="상태" onChange={e => setMsForm({ ...msForm, status: e.target.value })}>
              <MenuItem value="pending">대기</MenuItem>
              <MenuItem value="in_progress">진행중</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="overdue">지연</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ justifyContent: editingMs ? 'space-between' : 'flex-end', px: 3, pb: 2 }}>
          {editingMs && (
            <Button color="error" onClick={() => { handleDeleteMilestone(editingMs.id); setMsDialog(false); setEditingMs(null); }}>
              삭제
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => { setMsDialog(false); setEditingMs(null); }}>취소</Button>
            <Button variant="contained" onClick={handleSaveMilestone} disabled={!msForm.title || !msForm.due_date}>
              {editingMs ? '저장' : '추가'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
