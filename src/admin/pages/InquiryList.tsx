// FILE: src/admin/pages/InquiryList.tsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Pagination from '@mui/material/Pagination';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import type { InquiryStatus, Inquiry } from '../../lib/types';
import { projectTypeLabels } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

export default function InquiryList() {
  useDocumentTitle('문의 관리');
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setInquiries(data as Inquiry[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  useEffect(() => {
    setSelected([]);
  }, [search, statusFilter, typeFilter]);

  const filtered = useMemo(() => {
    return inquiries.filter((inq) => {
      const matchSearch =
        search === '' ||
        inq.company.toLowerCase().includes(search.toLowerCase()) ||
        inq.name.toLowerCase().includes(search.toLowerCase()) ||
        inq.id.toLowerCase().includes(search.toLowerCase()) ||
        inq.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || inq.status === statusFilter;
      const matchType = typeFilter === 'all' || inq.project_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [inquiries, search, statusFilter, typeFilter]);

  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const pageCount = Math.ceil(filtered.length / rowsPerPage);

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? paginated.map((i) => i.id) : []);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelected((prev) => checked ? [...prev, id] : prev.filter((s) => s !== id));
  };

  const handleBulkDelete = async () => {
    const { error } = await supabase.from('inquiries').delete().in('id', selected);
    if (!error) {
      setSnackbar({ open: true, message: `${selected.length}건이 삭제되었습니다.`, severity: 'success' });
      setSelected([]);
      fetchInquiries();
    } else {
      setSnackbar({ open: true, message: '삭제 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID', '회사명', '담당자명', '연락처', '이메일', '문의유형', '접수일시', '상태'];
    const rows = filtered.map((i) => [
      i.id, i.company, i.name, i.phone, i.email,
      projectTypeLabels[i.project_type], i.created_at, i.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inquiries_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: 'CSV 내보내기 완료', severity: 'success' });
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">문의 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/crm')}>CRM</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/residents')}>입주민</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/contracts')}>계약 관리</Button>
        </Box>
      </Box>
      {/* Summary row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {(['접수대기', '검토중', '답변완료', '보류'] as InquiryStatus[]).map((status) => {
          const count = inquiries.filter((i) => i.status === status).length;
          const colors: Record<InquiryStatus, string> = { '접수대기': '#ffc107', '검토중': '#60a5fa', '답변완료': '#00e676', '보류': '#b0b8c8' };
          return (
            <Box
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              sx={{
                px: 2, py: 1.25, borderRadius: 2, cursor: 'pointer',
                bgcolor: statusFilter === status ? `${colors[status]}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${statusFilter === status ? colors[status] + '40' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: `${colors[status]}12` },
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color: colors[status], fontWeight: 700 }}>{status}</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>{count}</Typography>
            </Box>
          );
        })}
      </Box>

      <Card>
        {/* Filter bar */}
        <CardContent sx={{ p: '16px 20px !important', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="회사명, 담당자, 문의ID 검색..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              sx={{ flex: '1 1 220px', minWidth: 180 }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#b0b8c8' }} /></InputAdornment>,
                },
              }}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>상태 필터</InputLabel>
              <Select value={statusFilter} label="상태 필터" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <MenuItem value="all">전체 상태</MenuItem>
                <MenuItem value="접수대기">접수대기</MenuItem>
                <MenuItem value="검토중">검토중</MenuItem>
                <MenuItem value="답변완료">답변완료</MenuItem>
                <MenuItem value="보류">보류</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>문의 유형</InputLabel>
              <Select value={typeFilter} label="문의 유형" onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                <MenuItem value="all">전체 유형</MenuItem>
                {Object.entries(projectTypeLabels).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="새로고침">
              <IconButton size="small" onClick={fetchInquiries} sx={{ color: '#b0b8c8', '&:hover': { color: '#ffffff' } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              size="small"
              onClick={handleExportCsv}
              sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#b0b8c8', '&:hover': { borderColor: '#00d4ff', color: '#00d4ff' } }}
            >
              CSV 내보내기
            </Button>
          </Box>
        </CardContent>

        {/* Bulk actions toolbar */}
        {selected.length > 0 && (
          <Box
            sx={{
              px: 2.5, py: 1.25,
              bgcolor: 'rgba(0,212,255,0.08)',
              borderBottom: '1px solid rgba(0,212,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#00d4ff' }}>
              {selected.length}건 선택됨
            </Typography>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
              sx={{ fontSize: '0.8125rem' }}
            >
              선택 삭제
            </Button>
          </Box>
        )}

        {/* Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} sx={{ color: '#00d4ff' }} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < paginated.length}
                      checked={paginated.length > 0 && selected.length === paginated.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      sx={{ color: '#b0b8c8' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#b0b8c8', fontWeight: 700, fontSize: '0.75rem' }}>회사명</TableCell>
                  <TableCell sx={{ color: '#b0b8c8', fontWeight: 700, fontSize: '0.75rem' }}>담당자</TableCell>
                  <TableCell sx={{ color: '#b0b8c8', fontWeight: 700, fontSize: '0.75rem' }}>연락처</TableCell>
                  <TableCell sx={{ color: '#b0b8c8', fontWeight: 700, fontSize: '0.75rem' }}>유형</TableCell>
                  <TableCell sx={{ color: '#b0b8c8', fontWeight: 700, fontSize: '0.75rem' }}>상태</TableCell>
                  <TableCell sx={{ color: '#b0b8c8', fontWeight: 700, fontSize: '0.75rem' }}>접수일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: '#b0b8c8' }}>
                      문의가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((inq: Inquiry) => {
                    const statusColors: Record<InquiryStatus, string> = {
                      '접수대기': '#ffc107',
                      '검토중': '#60a5fa',
                      '답변완료': '#00e676',
                      '보류': '#b0b8c8',
                    };
                    return (
                      <TableRow
                        key={inq.id}
                        hover
                        onClick={() => navigate(`/admin/inquiries/${inq.id}`)}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
                      >
                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.includes(inq.id)}
                            onChange={(e) => handleSelectOne(inq.id, e.target.checked)}
                            sx={{ color: '#b0b8c8' }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#ffffff', fontSize: '0.875rem' }}>{inq.company}</TableCell>
                        <TableCell sx={{ color: '#e0e6f0', fontSize: '0.875rem' }}>{inq.name}</TableCell>
                        <TableCell sx={{ color: '#e0e6f0', fontSize: '0.875rem' }}>{inq.phone}</TableCell>
                        <TableCell sx={{ color: '#e0e6f0', fontSize: '0.875rem' }}>{projectTypeLabels[inq.project_type] ?? inq.project_type}</TableCell>
                        <TableCell>
                          <Chip
                            label={inq.status}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              bgcolor: `${statusColors[inq.status]}18`,
                              color: statusColors[inq.status],
                              border: `1px solid ${statusColors[inq.status]}40`,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#b0b8c8', fontSize: '0.8125rem' }}>
                          {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        <Divider />
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
              총 <strong style={{ color: '#ffffff' }}>{filtered.length}</strong>건
            </Typography>
            <FormControl size="small">
              <Select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                sx={{ fontSize: '0.8125rem', '& .MuiSelect-select': { py: 0.5 } }}
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <MenuItem key={n} value={n}>{n}개씩 보기</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            shape="rounded"
          />
        </Box>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ fontSize: '0.875rem' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
