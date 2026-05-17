import { useState, useEffect, useCallback } from 'react';
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
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import TablePagination from '@mui/material/TablePagination';
import TimelineIcon from '@mui/icons-material/Timeline';
import SearchIcon from '@mui/icons-material/Search';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface EventEntry {
  id: string;
  event_type: string;
  source_tier: string;
  source_id: string;
  complex_id: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

const tierColors: Record<string, 'default' | 'error' | 'warning' | 'info' | 'success' | 'secondary'> = {
  T0: 'error',
  T1: 'warning',
  T2: 'info',
  T3: 'success',
  T4: 'secondary',
};

export default function EventLog() {
  useDocumentTitle('Event Log');
  const navigate = useNavigate();
  const theme = useTheme();
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const fetchEvents = useCallback(async () => {
    let query = supabase.from('event_log').select('*', { count: 'exact' });
    if (tierFilter !== 'all') query = query.eq('source_tier', tierFilter);
    query = query.order('created_at', { ascending: false }).range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

    const { data, count } = await query;
    if (data) setEvents(data);
    if (count !== null) setTotalCount(count);
  }, [page, rowsPerPage, tierFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const channel = supabase.channel('event-log-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_log' }, () => { fetchEvents(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents]);

  const filteredEvents = search
    ? events.filter(e => e.event_type.toLowerCase().includes(search.toLowerCase()) || e.source_id.toLowerCase().includes(search.toLowerCase()))
    : events;

  const consumeEvents = async () => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-engine?action=consume-events`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    fetchEvents();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <TimelineIcon sx={{ color: theme.palette.warning.main, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Event Log</Typography>
            <Chip label="실시간" size="small" color="success" sx={{ fontSize: '0.7rem' }} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            시스템 전체 이벤트 스트림 모니터링
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" size="small" onClick={consumeEvents}>이벤트 소비</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/observability')}>옵저버빌리티</Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {['T0', 'T1', 'T2', 'T3', 'T4'].map(tier => (
          <Grid key={tier} size={{ xs: 4, md: 2.4 }}>
            <Card sx={{ cursor: 'pointer', border: tierFilter === tier ? '2px solid' : 'none', borderColor: 'primary.main' }} onClick={() => setTierFilter(tierFilter === tier ? 'all' : tier)}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Chip label={tier} size="small" color={tierColors[tier]} sx={{ mb: 0.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {events.filter(e => e.source_tier === tier).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="이벤트 타입 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ minWidth: 250 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Tier</InputLabel>
          <Select value={tierFilter} label="Tier" onChange={e => setTierFilter(e.target.value)}>
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="T0">T0</MenuItem>
            <MenuItem value="T1">T1</MenuItem>
            <MenuItem value="T2">T2</MenuItem>
            <MenuItem value="T3">T3</MenuItem>
            <MenuItem value="T4">T4</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Event Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>시간</TableCell>
                  <TableCell align="center">Tier</TableCell>
                  <TableCell>이벤트 타입</TableCell>
                  <TableCell>소스 ID</TableCell>
                  <TableCell align="center">처리됨</TableCell>
                  <TableCell>Payload</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        기록된 이벤트가 없습니다
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map(event => (
                    <TableRow key={event.id} hover>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {new Date(event.created_at).toLocaleString('ko-KR')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={event.source_tier} size="small" color={tierColors[event.source_tier] || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {event.event_type}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{event.source_id || '-'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={event.processed ? 'Y' : 'N'} size="small" color={event.processed ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                          {JSON.stringify(event.payload).slice(0, 60)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </CardContent>
      </Card>
    </Container>
  );
}
