import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';

interface AgentConfig {
  id: string;
  tier: string;
  agent_name: string;
  display_name: string;
  description: string;
  model: string;
  active: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  messages: Message[];
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AIAgentChat() {
  useDocumentTitle('AI Agent Chat');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadAgents = useCallback(async () => {
    const { data } = await supabase
      .from('ai_agent_configs')
      .select('id, tier, agent_name, display_name, description, model, active')
      .eq('active', true)
      .order('tier');
    if (data) {
      setAgents(data);
      if (data.length > 0 && !selectedAgent) setSelectedAgent(data[0]);
    }
    setLoading(false);
  }, [selectedAgent]);

  const loadConversations = useCallback(async (agentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, agent_id, title, messages, status, created_at, updated_at')
      .eq('agent_id', agentId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (data) {
      setConversations(data as Conversation[]);
      if (data.length > 0 && !selectedConversation) {
        setSelectedConversation(data[0] as Conversation);
      }
    }
  }, [selectedConversation]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  useEffect(() => {
    if (selectedAgent) {
      setSelectedConversation(null);
      loadConversations(selectedAgent.id);
    }
  }, [selectedAgent?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const handleNewConversation = () => {
    setSelectedConversation(null);
  };

  const handleSend = useCallback(async () => {
    if (!message.trim() || !selectedAgent || sending) return;

    const trimmedMsg = message.trim();
    setMessage('');
    setSending(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showToast('인증 세션이 없습니다.', 'error');
      setSending(false);
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const endpoint = `${supabaseUrl}/functions/v1/ai-agent`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          message: trimmedMsg,
          conversation_id: selectedConversation?.id || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        showToast('응답 실패: ' + (errData.error || res.statusText), 'error');
        setSending(false);
        return;
      }

      const result = await res.json();
      const convId = result.conversation_id;

      // Reload the updated conversation
      if (convId) {
        const { data } = await supabase
          .from('ai_conversations')
          .select('id, agent_id, title, messages, status, created_at, updated_at')
          .eq('id', convId)
          .maybeSingle();
        if (data) {
          setSelectedConversation(data as Conversation);
          setConversations(prev => {
            const filtered = prev.filter(c => c.id !== convId);
            return [data as Conversation, ...filtered];
          });
        }
      }
    } catch (err) {
      showToast('네트워크 오류: ' + String(err), 'error');
    } finally {
      setSending(false);
    }
  }, [message, selectedAgent, selectedConversation, sending, showToast]);

  const handleDeleteConversation = useCallback(async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from('ai_conversations')
      .update({ status: 'archived' })
      .eq('id', conv.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    showToast('대화가 삭제되었습니다.', 'success');
    setConversations(prev => prev.filter(c => c.id !== conv.id));
    if (selectedConversation?.id === conv.id) setSelectedConversation(null);
  }, [selectedConversation, showToast]);

  const displayedMessages: Message[] = selectedConversation?.messages || [];
  const tierColors: Record<string, string> = {
    T0: '#ff5252', T1: '#ff9800', T2: '#00d4ff', T3: '#00e676', T4: '#c9a84c',
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">AI Agent Chat</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/tickets')}>지원 티켓</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ height: 'calc(100vh - 200px)', minHeight: 600 }}>
        {/* Agent + Conversation List */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 1.5, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle2" sx={{ px: 0.5, mb: 1 }}>AI Agents</Typography>
              <List dense disablePadding sx={{ mb: 1 }}>
                {agents.map(a => (
                  <ListItemButton
                    key={a.id}
                    selected={selectedAgent?.id === a.id}
                    onClick={() => setSelectedAgent(a)}
                    sx={{ borderRadius: 1, mb: 0.25, py: 0.75 }}
                  >
                    <SmartToyIcon fontSize="small" sx={{ mr: 1, color: tierColors[a.tier] || 'primary.main', flexShrink: 0 }} />
                    <ListItemText
                      primary={a.display_name}
                      secondary={a.tier + ' · ' + a.agent_name}
                      slotProps={{
                        primary: { variant: 'body2', sx: { fontWeight: 600 } },
                        secondary: { variant: 'caption' },
                      }}
                    />
                  </ListItemButton>
                ))}
                {agents.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                    등록된 에이전트가 없습니다.
                  </Typography>
                )}
              </List>

              <Divider sx={{ my: 1 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5, mb: 0.5 }}>
                <Typography variant="subtitle2">대화 기록</Typography>
                <IconButton size="small" onClick={handleNewConversation} title="새 대화">
                  <AddCommentIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {conversations.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                    대화 기록이 없습니다.
                  </Typography>
                )}
                {conversations.map(conv => (
                  <ListItemButton
                    key={conv.id}
                    selected={selectedConversation?.id === conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    sx={{ borderRadius: 1, mb: 0.25, py: 0.5, pr: 0.5 }}
                  >
                    <ListItemText
                      primary={conv.title || '(제목 없음)'}
                      secondary={new Date(conv.updated_at).toLocaleDateString('ko-KR')}
                      slotProps={{
                        primary: { variant: 'caption', sx: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                        secondary: { variant: 'caption' },
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteConversation(conv, e)}
                      sx={{ color: 'error.main', opacity: 0.6, '&:hover': { opacity: 1 } }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </ListItemButton>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Chat Area */}
        <Grid size={{ xs: 12, md: 9 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedAgent ? (
              <>
                {/* Header */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <SmartToyIcon sx={{ color: tierColors[selectedAgent.tier] || 'primary.main' }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {selectedAgent.display_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedAgent.description}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip
                      label={selectedAgent.tier}
                      size="small"
                      sx={{ bgcolor: tierColors[selectedAgent.tier], color: '#000', fontWeight: 700, fontSize: '0.7rem' }}
                    />
                    <Chip label="Active" size="small" color="success" />
                  </Box>
                </Box>

                {/* Messages */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  {!selectedConversation && displayedMessages.length === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                      <SmartToyIcon sx={{ fontSize: 48, color: tierColors[selectedAgent.tier], opacity: 0.5 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                        {selectedAgent.display_name}에게 질문해 보세요.
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {selectedAgent.agent_name === 'aegis' && '"보안 현황" / "감사 로그" / "정책 확인"'}
                          {selectedAgent.agent_name === 'aurora' && '"리전 현황" / "자원 배분" / "리포트 생성"'}
                          {selectedAgent.agent_name === 'atlas' && '"스케줄 조회" / "SLA 현황" / "워크오더 생성"'}
                          {selectedAgent.agent_name === 'argus' && '"ATR 상태" / "센서 조회" / "알림 생성"'}
                          {selectedAgent.agent_name === 'athena' && '"프로젝트 현황" / "ROI 계산" / "일정 최적화"'}
                        </Typography>
                      </Typography>
                    </Box>
                  )}

                  {displayedMessages.map((msg, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      {msg.role === 'assistant' && (
                        <SmartToyIcon sx={{ fontSize: 20, color: tierColors[selectedAgent.tier], mr: 1, mt: 0.5, flexShrink: 0 }} />
                      )}
                      <Box
                        sx={{
                          maxWidth: '75%',
                          p: 1.5,
                          borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          bgcolor: msg.role === 'user' ? 'primary.main' : 'rgba(255,255,255,0.06)',
                          color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                          border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {msg.content}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mt: 0.5, textAlign: 'right' }}>
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Typography>
                      </Box>
                    </Box>
                  ))}

                  {sending && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <SmartToyIcon sx={{ fontSize: 20, color: tierColors[selectedAgent.tier] }} />
                      <Box sx={{ p: 1.5, borderRadius: '16px 16px 16px 4px', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {[0, 1, 2].map(i => (
                            <Box key={i} sx={{
                              width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.secondary',
                              animation: 'pulse 1.2s ease-in-out infinite',
                              animationDelay: `${i * 0.2}s`,
                              '@keyframes pulse': { '0%, 80%, 100%': { opacity: 0.3 }, '40%': { opacity: 1 } },
                            }} />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Box>

                <Divider />

                {/* Input */}
                <Box sx={{ p: 2, display: 'flex', gap: 1, flexShrink: 0 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={`${selectedAgent.display_name}에게 메시지 보내기...`}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && !sending) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sending}
                    multiline
                    maxRows={3}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    sx={{ minWidth: 48, px: 1.5 }}
                  >
                    {sending ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <SendIcon />}
                  </Button>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <Typography color="text.secondary">좌측에서 에이전트를 선택하세요.</Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
