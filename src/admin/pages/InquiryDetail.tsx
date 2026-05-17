// FILE: src/admin/pages/InquiryDetail.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import CategoryIcon from '@mui/icons-material/Category';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { InquiryStatus, Inquiry, InquiryNote, StatusHistoryEntry } from '../../lib/types';
import { projectTypeLabels } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.25 }}>
      <Box sx={{ color: '#b0b8c8', mt: 0.1, flexShrink: 0 }}>{icon}</Box>
      <Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#b0b8c8', mb: 0.25, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#ffffff' }}>{value}</Typography>
      </Box>
    </Box>
  );
}

export default function InquiryDetail() {
  useDocumentTitle('문의 상세');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<InquiryStatus>('접수대기');
  const [newNote, setNewNote] = useState('');
  const [replyText, setReplyText] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    const fetchInquiry = async () => {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        const inq = data as Inquiry;
        setInquiry(inq);
        setStatus(inq.status);
        setReplyText(inq.reply_content ?? '');
      }
      setLoading(false);
    };
    fetchInquiry();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#00d4ff' }} />
      </Box>
    );
  }

  if (!inquiry) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h2" sx={{ mb: 2 }}>문의를 찾을 수 없습니다</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/inquiries')}>
          목록으로 돌아가기
        </Button>
      </Box>
    );
  }

  const handleStatusSave = async () => {
    const prevStatus = inquiry.status;
    const newHistory = [
      ...(inquiry.status_history ?? []),
      { from: prevStatus, to: status, changed_by: '관리자', changed_at: new Date().toISOString() },
    ];
    const { error } = await supabase
      .from('inquiries')
      .update({ status, status_history: newHistory })
      .eq('id', inquiry.id);
    if (!error) {
      setInquiry((prev: Inquiry | null) => prev ? { ...prev, status, status_history: newHistory } : prev);
      setSnackbar({ open: true, message: `상태가 "${status}"로 변경되었습니다.`, severity: 'success' });
    } else {
      setSnackbar({ open: true, message: '상태 변경 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  const handleNoteSave = async () => {
    if (!newNote.trim()) return;
    const note: InquiryNote = {
      id: crypto.randomUUID(),
      author: '관리자',
      content: newNote.trim(),
      created_at: new Date().toISOString(),
    };
    const newNotes = [...(inquiry.admin_notes ?? []), note];
    const { error } = await supabase
      .from('inquiries')
      .update({ admin_notes: newNotes })
      .eq('id', inquiry.id);
    if (!error) {
      setInquiry((prev: Inquiry | null) => prev ? { ...prev, admin_notes: newNotes } : prev);
      setSnackbar({ open: true, message: '메모가 저장되었습니다.', severity: 'success' });
      setNewNote('');
    } else {
      setSnackbar({ open: true, message: '메모 저장 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  const handleReplySend = async () => {
    if (!replyText.trim()) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('inquiries')
      .update({ reply_content: replyText.trim(), replied_at: now, status: '답변완료' })
      .eq('id', inquiry.id);
    if (!error) {
      setInquiry((prev: Inquiry | null) => prev ? { ...prev, reply_content: replyText.trim(), replied_at: now, status: '답변완료' as InquiryStatus } : prev);
      setStatus('답변완료');
      setSnackbar({ open: true, message: '답변이 저장되었습니다.', severity: 'success' });
    } else {
      setSnackbar({ open: true, message: '답변 저장 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/inquiries')}
          sx={{ color: '#b0b8c8', '&:hover': { color: '#ffffff' } }}
        >
          목록으로
        </Button>
        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <Typography sx={{ fontSize: '0.875rem', color: '#00d4ff', fontWeight: 700, fontFamily: '"Montserrat", sans-serif' }}>
          {inquiry.id}
        </Typography>
        <Typography variant="h2" sx={{ fontSize: '1.125rem', flex: 1 }}>{inquiry.company}</Typography>
        <Chip
          label={inquiry.status}
          size="medium"
          sx={{
            fontWeight: 700,
            fontSize: '0.8125rem',
            bgcolor: {
              '접수대기': 'rgba(255,193,7,0.15)',
              '검토중': 'rgba(96,165,250,0.15)',
              '답변완료': 'rgba(0,230,118,0.15)',
              '보류': 'rgba(176,184,200,0.15)',
            }[inquiry.status],
            color: {
              '접수대기': '#ffc107',
              '검토중': '#60a5fa',
              '답변완료': '#00e676',
              '보류': '#b0b8c8',
            }[inquiry.status],
            border: `1px solid ${{
              '접수대기': 'rgba(255,193,7,0.3)',
              '검토중': 'rgba(96,165,250,0.3)',
              '답변완료': 'rgba(0,230,118,0.3)',
              '보류': 'rgba(176,184,200,0.3)',
            }[inquiry.status]}`,
          }}
        />
      </Box>

      <Grid container spacing={2.5}>
        {/* Left: Inquiry Info */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {/* Basic info */}
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>문의 정보</Typography>
              <Grid container spacing={0}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <InfoRow icon={<BusinessIcon sx={{ fontSize: 18 }} />} label="회사명" value={inquiry.company} />
                  <InfoRow icon={<PersonIcon sx={{ fontSize: 18 }} />} label="담당자명" value={inquiry.name} />
                  <InfoRow icon={<PhoneIcon sx={{ fontSize: 18 }} />} label="연락처" value={inquiry.phone} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <InfoRow icon={<EmailIcon sx={{ fontSize: 18 }} />} label="이메일" value={inquiry.email} />
                  <InfoRow icon={<CategoryIcon sx={{ fontSize: 18 }} />} label="문의 유형" value={projectTypeLabels[inquiry.project_type]} />
                  <InfoRow icon={<AccessTimeIcon sx={{ fontSize: 18 }} />} label="접수일시" value={formatDateTime(inquiry.created_at)} />
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#b0b8c8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                문의 내용
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                }}
              >
                <Typography sx={{ fontSize: '0.9375rem', color: '#e0e6f0', lineHeight: 1.8 }}>
                  {inquiry.message}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Reply composition */}
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SendIcon sx={{ fontSize: 18, color: '#00d4ff' }} />
                <Typography variant="h3">답변 작성</Typography>
                {inquiry.replied_at && (
                  <Chip
                    label={`최종 답변: ${formatDateTime(inquiry.replied_at)}`}
                    size="small"
                    icon={<CheckCircleIcon sx={{ fontSize: 14, color: '#00e676 !important' }} />}
                    sx={{ ml: 'auto', bgcolor: 'rgba(0,230,118,0.1)', color: '#00e676', fontSize: '0.75rem', border: '1px solid rgba(0,230,118,0.2)' }}
                  />
                )}
              </Box>
              <TextField
                multiline
                rows={6}
                fullWidth
                placeholder={`${inquiry.name}님께 보낼 답변을 입력해 주세요...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                <Button
                  variant="contained"
                  endIcon={<SendIcon />}
                  onClick={handleReplySend}
                  disabled={!replyText.trim()}
                >
                  답변 저장
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Status, Notes, Timeline */}
        <Grid size={{ xs: 12, lg: 4 }}>
          {/* Status change */}
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SwapHorizIcon sx={{ fontSize: 18, color: '#00d4ff' }} />
                <Typography variant="h3">상태 변경</Typography>
              </Box>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>상태 선택</InputLabel>
                <Select value={status} label="상태 선택" onChange={(e) => setStatus(e.target.value as InquiryStatus)}>
                  <MenuItem value="접수대기">접수대기</MenuItem>
                  <MenuItem value="검토중">검토중</MenuItem>
                  <MenuItem value="답변완료">답변완료</MenuItem>
                  <MenuItem value="보류">보류</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<SaveIcon />}
                onClick={handleStatusSave}
                sx={{ borderColor: '#00d4ff', color: '#00d4ff', '&:hover': { bgcolor: 'rgba(0,212,255,0.08)' } }}
              >
                상태 저장
              </Button>
            </CardContent>
          </Card>

          {/* Admin notes */}
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NoteAddIcon sx={{ fontSize: 18, color: '#c9a84c' }} />
                <Typography variant="h3">내부 메모</Typography>
              </Box>
              {(inquiry.admin_notes ?? []).length > 0 ? (
                <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {(inquiry.admin_notes ?? []).map((note: InquiryNote) => (
                    <Box
                      key={note.id}
                      sx={{
                        p: 1.5,
                        bgcolor: 'rgba(201,168,76,0.06)',
                        border: '1px solid rgba(201,168,76,0.15)',
                        borderRadius: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#c9a84c', fontWeight: 700 }}>{note.author}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#b0b8c8' }}>
                          {formatDateTime(note.created_at)}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.875rem', color: '#e0e6f0', lineHeight: 1.6 }}>{note.content}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.875rem', color: '#b0b8c8', mb: 2 }}>등록된 메모가 없습니다.</Typography>
              )}
              <TextField
                multiline
                rows={3}
                fullWidth
                placeholder="내부 메모 입력 (외부 공개 안됨)"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                sx={{ mb: 1.5 }}
              />
              <Button
                variant="outlined"
                fullWidth
                size="small"
                startIcon={<NoteAddIcon />}
                onClick={handleNoteSave}
                disabled={!newNote.trim()}
                sx={{ borderColor: 'rgba(201,168,76,0.4)', color: '#c9a84c', '&:hover': { bgcolor: 'rgba(201,168,76,0.08)' } }}
              >
                메모 저장
              </Button>
            </CardContent>
          </Card>

          {/* Status timeline */}
          <Card>
            <CardContent sx={{ p: '20px 24px !important' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>처리 이력</Typography>
              {(inquiry.status_history ?? []).length === 0 ? (
                <Typography sx={{ fontSize: '0.875rem', color: '#b0b8c8' }}>처리 이력이 없습니다.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(inquiry.status_history ?? []).map((change: StatusHistoryEntry, i: number) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 10, height: 10, borderRadius: '50%',
                            bgcolor: '#00d4ff', flexShrink: 0, mt: 0.5,
                          }}
                        />
                        {i < (inquiry.status_history ?? []).length - 1 && (
                          <Box sx={{ width: 2, flex: 1, bgcolor: 'rgba(255,255,255,0.08)', minHeight: 32, my: 0.5 }} />
                        )}
                      </Box>
                      <Box sx={{ pb: i < (inquiry.status_history ?? []).length - 1 ? 2.5 : 0 }}>
                        <Box sx={{ display: 'flex', gap: 1, mb: 0.25 }}>
                          <Chip label={change.from} size="small" sx={{ height: 18, fontSize: '0.68rem', bgcolor: 'rgba(255,255,255,0.08)', color: '#b0b8c8', '& .MuiChip-label': { px: 0.75 } }} />
                          <Typography sx={{ fontSize: '0.7rem', color: '#b0b8c8', alignSelf: 'center' }}>→</Typography>
                          <Chip label={change.to} size="small" sx={{ height: 18, fontSize: '0.68rem', bgcolor: 'rgba(0,212,255,0.12)', color: '#00d4ff', '& .MuiChip-label': { px: 0.75 } }} />
                        </Box>
                        <Typography sx={{ fontSize: '0.75rem', color: '#b0b8c8' }}>
                          {change.changed_by} · {formatDateTime(change.changed_at)}
                        </Typography>
                        {change.note && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#e0e6f0', mt: 0.25 }}>{change.note}</Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ fontSize: '0.875rem' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
