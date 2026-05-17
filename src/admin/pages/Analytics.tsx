import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  source: string;
  created_at: string;
}

interface PageView {
  id: string;
  page_path: string;
  referrer: string;
  user_agent: string;
  ip_address: string;
  session_id: string;
  created_at: string;
}

export default function Analytics() {
  useDocumentTitle('분석');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [tab, setTab] = useState(0);
  const [days, setDays] = useState('7');

  const loadData = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    const sinceStr = since.toISOString();
    const [inqRes, pvRes] = await Promise.all([
      supabase.from('inquiries').select('*').gte('created_at', sinceStr).order('created_at', { ascending: false }),
      supabase.from('page_views').select('*').gte('created_at', sinceStr).order('created_at', { ascending: false }).limit(500),
    ]);
    if (inqRes.data) setInquiries(inqRes.data);
    if (pvRes.data) setPageViews(pvRes.data);
    setLoading(false);
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch1 = supabase.channel('analytics-inq-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquiries' }, () => { loadData(); })
      .subscribe();
    const ch2 = supabase.channel('analytics-pv-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_views' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [loadData]);

  const handleStatusChange = useCallback(async (inq: Inquiry, newStatus: string) => {
    const { error } = await supabase.from('inquiries').update({ status: newStatus }).eq('id', inq.id);
    if (error) { showToast('변경 실패', 'error'); return; }
    logAction('UPDATE', 'inquiries', inq.id, { status_change: newStatus });
    loadData();
  }, [showToast, logAction, loadData]);

  const pageCounts = pageViews.reduce<Record<string, number>>((acc, pv) => {
    const path = pv.page_path || '/unknown';
    acc[path] = (acc[path] || 0) + 1;
    return acc;
  }, {});
  const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCount = topPages.length > 0 ? topPages[0][1] : 1;
  const uniqueSessions = new Set(pageViews.map(p => p.session_id).filter(Boolean)).size;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">분석</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/observability')}>관측성</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/noc')}>NOC</Button>
          <TextField select size="small" value={days} onChange={e => setDays(e.target.value)} sx={{ width: 140 }}>
            {['1', '7', '14', '30', '90'].map(d => <MenuItem key={d} value={d}>{d}일</MenuItem>)}
          </TextField>
        </Box>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><VisibilityIcon color="primary" /><Typography variant="caption" color="text.secondary">페이지 뷰</Typography><Typography variant="h2">{pageViews.length}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><TrendingUpIcon color="success" /><Typography variant="caption" color="text.secondary">세션</Typography><Typography variant="h2">{uniqueSessions}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">문의</Typography><Typography variant="h2">{inquiries.length}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">미처리 문의</Typography><Typography variant="h2" color="warning.main">{inquiries.filter(i => i.status === 'new' || !i.status).length}</Typography></CardContent></Card></Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="인기 페이지" /><Tab label={`문의 (${inquiries.length})`} /><Tab label="최근 방문" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            {topPages.map(([path, count]) => (
              <Box key={path} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ width: 200, flexShrink: 0, fontFamily: 'monospace' }}>{path}</Typography>
                <LinearProgress variant="determinate" value={(count / maxCount) * 100} sx={{ flex: 1, height: 10, borderRadius: 5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, width: 50, textAlign: 'right' }}>{count}</Typography>
              </Box>
            ))}
            {topPages.length === 0 && <Typography variant="body2" color="text.secondary">데이터가 없습니다.</Typography>}
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>이름</TableCell><TableCell>제목</TableCell><TableCell>상태</TableCell>
                <TableCell>소스</TableCell><TableCell>일시</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {inquiries.map(inq => (
                  <TableRow key={inq.id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{inq.name}</Typography><Typography variant="caption">{inq.email}</Typography></TableCell>
                    <TableCell>{inq.subject || '-'}</TableCell>
                    <TableCell>
                      <Chip label={inq.status || 'new'} size="small" color={inq.status === 'resolved' ? 'success' : inq.status === 'in_progress' ? 'primary' : 'default'}
                        onClick={() => handleStatusChange(inq, inq.status === 'new' || !inq.status ? 'in_progress' : 'resolved')} sx={{ cursor: 'pointer' }} />
                    </TableCell>
                    <TableCell><Typography variant="caption">{inq.source || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{inq.created_at ? new Date(inq.created_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>페이지</TableCell><TableCell>Referrer</TableCell><TableCell>일시</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {pageViews.slice(0, 50).map(pv => (
                  <TableRow key={pv.id} hover>
                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{pv.page_path}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{pv.referrer || 'direct'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{pv.created_at ? new Date(pv.created_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}
