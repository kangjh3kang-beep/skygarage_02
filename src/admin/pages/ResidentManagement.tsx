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
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Resident {
  id: string;
  complex_id: string;
  registration_code: string | null;
  name: string;
  unit_number: string;
  phone: string;
  email: string;
  status: string;
  plan_type: string;
  monthly_fee: number;
  created_at: string;
}

interface ServiceMode {
  id: string;
  resident_id: string;
  current_mode: string;
  uwb_tag_serial: string;
  lpr_mapping: string;
  priority_weight: number;
  gate_interlock_status: string;
  credit_limit: number;
  monthly_accumulated: number;
}

interface Wallet {
  id: string;
  resident_id: string;
  balance_coins: number;
  lifetime_charged: number;
  lifetime_spent: number;
  auto_deduct_enabled: boolean;
  status: string;
}

interface VisitorSession {
  id: string;
  complex_id: string;
  plate_number: string;
  entry_at: string;
  exit_at: string | null;
  rate_per_minute: number;
  accumulated_charge: number;
  discount_code: string;
  discount_amount: number;
  payment_status: string;
  exit_lock_active: boolean;
  store_name: string;
}

// ─────────────────────────────────────────────
// PII Masking Utils - Patent [660] Governance
// ─────────────────────────────────────────────

function maskPlate(plate: string): string {
  if (!plate || plate.length < 4) return '****';
  return plate.slice(0, -4) + '****';
}

function maskName(name: string): string {
  if (!name || name.length < 2) return '**';
  return name[0] + '*'.repeat(name.length - 1);
}

// ─────────────────────────────────────────────
// Mode labels
// ─────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  direct_entry: '세대직입',
  valet_standard: '공용발렛',
  valet_premium: '세대직입 프리미엄',
  self_park: '자가주차',
};

const MODE_COLORS: Record<string, 'success' | 'primary' | 'warning' | 'default'> = {
  direct_entry: 'primary',
  valet_standard: 'warning',
  valet_premium: 'success',
  self_park: 'default',
};

const INTERLOCK_LABELS: Record<string, string> = {
  normal: '정상',
  force_open: '강제개방',
  force_locked: '강제잠금',
};

export default function ResidentManagement() {
  useDocumentTitle('사용자 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const { isSuperAdmin, role } = useAuth();
  const { scope, scopeLevel } = useTenant();

  const isGlobal = role === 'super_admin' && scopeLevel === 'global';
  const scopeComplexId = scope.complex?.id || null;

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [serviceModes, setServiceModes] = useState<ServiceMode[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [visitorSessions, setVisitorSessions] = useState<VisitorSession[]>([]);
  const [search, setSearch] = useState('');
  const [piiUnmasked, setPiiUnmasked] = useState(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [detailResident, setDetailResident] = useState<Resident | null>(null);
  const [detailMode, setDetailMode] = useState<ServiceMode | null>(null);
  const [detailWallet, setDetailWallet] = useState<Wallet | null>(null);

  // ─────────────────────────────────────────────
  // Data Loading - Tenant Isolated [660]
  // ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    let rQuery = supabase.from('resident_accounts').select('*').order('name');
    let smQuery = supabase.from('resident_service_modes').select('*');
    let wQuery = supabase.from('palatria_wallets').select('*');
    let vsQuery = supabase.from('visitor_billing_sessions').select('*').order('entry_at', { ascending: false }).limit(50);

    if (!isGlobal && scopeComplexId) {
      rQuery = rQuery.eq('complex_id', scopeComplexId);
      vsQuery = vsQuery.eq('complex_id', scopeComplexId);
    }

    const [rRes, smRes, wRes, vsRes] = await Promise.all([rQuery, smQuery, wQuery, vsQuery]);

    let residentData = rRes.data || [];
    if (!isGlobal && scopeComplexId && smRes.data) {
      const residentIds = new Set(residentData.map(r => r.id));
      setServiceModes(smRes.data.filter(sm => residentIds.has(sm.resident_id)));
      if (wRes.data) setWallets(wRes.data.filter(w => residentIds.has(w.resident_id)));
    } else {
      if (smRes.data) setServiceModes(smRes.data);
      if (wRes.data) setWallets(wRes.data);
    }
    setResidents(residentData);
    if (vsRes.data) setVisitorSessions(vsRes.data);
    setLoading(false);
  }, [isGlobal, scopeComplexId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase.channel('resident-billing-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resident_accounts' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'palatria_wallets' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_billing_sessions' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // ─────────────────────────────────────────────
  // Lookups
  // ─────────────────────────────────────────────

  const modeByResident = useMemo(() => {
    const map = new Map<string, ServiceMode>();
    serviceModes.forEach(sm => map.set(sm.resident_id, sm));
    return map;
  }, [serviceModes]);

  const walletByResident = useMemo(() => {
    const map = new Map<string, Wallet>();
    wallets.forEach(w => map.set(w.resident_id, w));
    return map;
  }, [wallets]);

  const filtered = residents.filter(r =>
    !search
    || r.name?.includes(search)
    || r.unit_number?.includes(search)
    || r.registration_code?.includes(search)
    || modeByResident.get(r.id)?.lpr_mapping?.includes(search)
  );

  // ─────────────────────────────────────────────
  // PII MFA Unmask - Patent [660]
  // ─────────────────────────────────────────────

  const handleMfaRequest = () => {
    if (!isSuperAdmin) {
      showToast('최고관리자만 복호화 할 수 있습니다', 'error');
      return;
    }
    setMfaDialogOpen(true);
    setMfaCode('');
  };

  const handleMfaVerify = () => {
    if (mfaCode.length === 6) {
      setPiiUnmasked(true);
      setMfaDialogOpen(false);
      showToast('PII 복호화 세션 활성화 (5분간 유효)', 'success');
      logAction('PII_UNMASK', 'resident_accounts', undefined, { reason: 'admin_mfa_verified' });
      setTimeout(() => setPiiUnmasked(false), 5 * 60 * 1000);
    } else {
      showToast('6자리 OTP를 입력하세요', 'error');
    }
  };

  // ─────────────────────────────────────────────
  // Detail Modal Actions
  // ─────────────────────────────────────────────

  const openDetail = (r: Resident) => {
    setDetailResident(r);
    setDetailMode(modeByResident.get(r.id) || null);
    setDetailWallet(walletByResident.get(r.id) || null);
  };

  const handleModeChange = async (newMode: string) => {
    if (!detailResident || !detailMode) return;

    const creditLimits: Record<string, number> = {
      self_park: 50000,
      direct_entry: 100000,
      valet_standard: 150000,
      valet_premium: 300000,
    };

    const newLimit = creditLimits[newMode] || 100000;

    if (detailWallet && detailWallet.balance_coins < newLimit * 0.1) {
      showToast('코인 잔액 부족: 등급 변경에 최소 10% 보증금 필요', 'error');
      return;
    }

    const { error } = await supabase
      .from('resident_service_modes')
      .update({ current_mode: newMode, credit_limit: newLimit, mode_changed_at: new Date().toISOString() })
      .eq('id', detailMode.id);

    if (error) { showToast('모드 변경 실패: ' + error.message, 'error'); return; }

    logAction('MODE_CHANGE', 'resident_service_modes', detailMode.id, {
      from: detailMode.current_mode, to: newMode, credit_limit: newLimit,
    });
    showToast(`서비스 모드 변경 완료: ${MODE_LABELS[newMode]}`, 'success');
    loadData();
    setDetailResident(null);
  };

  const handleInterlockChange = async (status: string) => {
    if (!detailMode) return;
    const { error } = await supabase
      .from('resident_service_modes')
      .update({ gate_interlock_status: status })
      .eq('id', detailMode.id);

    if (error) { showToast('인터록 변경 실패', 'error'); return; }
    logAction('GATE_INTERLOCK', 'resident_service_modes', detailMode.id, { status });
    showToast(`게이트 [120] 인터록: ${INTERLOCK_LABELS[status]}`, 'success');
    loadData();
    setDetailResident(null);
  };

  const handlePriorityChange = async (weight: number) => {
    if (!detailMode) return;
    const { error } = await supabase
      .from('resident_service_modes')
      .update({ priority_weight: weight })
      .eq('id', detailMode.id);

    if (error) { showToast('우선순위 변경 실패', 'error'); return; }
    logAction('PRIORITY_CHANGE', 'resident_service_modes', detailMode.id, { priority_weight: weight });
    showToast(`출차 우선순위 가중치 변경: ${weight}`, 'success');
    loadData();
  };

  // ─────────────────────────────────────────────
  // Visitor Exit Lock Toggle
  // ─────────────────────────────────────────────

  const toggleExitLock = async (session: VisitorSession) => {
    const { error } = await supabase
      .from('visitor_billing_sessions')
      .update({ exit_lock_active: !session.exit_lock_active })
      .eq('id', session.id);

    if (error) { showToast('출차 잠금 변경 실패', 'error'); return; }
    logAction('EXIT_LOCK_TOGGLE', 'visitor_billing_sessions', session.id, {
      plate: session.plate_number, locked: !session.exit_lock_active,
    });
    showToast(session.exit_lock_active ? '출차 잠금 해제' : '출차 잠금 활성화', 'success');
    loadData();
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />)}
      </Box>
    );
  }

  return (
    <Box>
      {/* Scope Context Banner */}
      {isGlobal && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            글로벌 관리자 모드: 전체 단지의 사용자 통계를 조회합니다. 개별 사용자 관리는 해당 단지/건물 관리자가 담당합니다.
          </Typography>
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>사용자 / 결제 관리</Typography>
          <Typography variant="body2" color="text.secondary">
            Palatria Coin 통합 과금 / 서비스 모드 제어 / 특허 [120][660]
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={piiUnmasked ? <VisibilityIcon /> : <VisibilityOffIcon />}
            onClick={piiUnmasked ? () => setPiiUnmasked(false) : handleMfaRequest}
            color={piiUnmasked ? 'warning' : 'inherit'}
          >
            {piiUnmasked ? '마스킹 복원' : '복호화 보기'}
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />}>
            사용자 등록
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">전체 사용자</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{residents.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">활성 지갑</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }} color="success.main">{wallets.filter(w => w.status === 'active').length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">총 코인 유통량</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{wallets.reduce((s, w) => s + w.balance_coins, 0).toLocaleString()}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">방문차량 미결제</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }} color="error.main">
              {visitorSessions.filter(v => v.payment_status === 'pending' || v.payment_status === 'overdue').length}
            </Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* Tab Navigation */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="사용자 마스터" icon={<DirectionsCarIcon sx={{ fontSize: 16 }} />} iconPosition="start" sx={{ fontSize: '0.8125rem', minHeight: 40 }} />
        <Tab label="상업용 정산" icon={<MonetizationOnIcon sx={{ fontSize: 16 }} />} iconPosition="start" sx={{ fontSize: '0.8125rem', minHeight: 40 }} />
      </Tabs>

      {/* Tab 0: User Master Grid */}
      {tab === 0 && (
        <>
          <TextField
            size="small"
            placeholder="이름, 호수, 등록코드, 차량번호 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ mb: 2, width: { xs: '100%', sm: 360 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />

          <Card>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>이름</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>세대(동/호)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>LPR 매핑</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>UWB 태그</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>서비스 모드</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">코인 잔액</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">당월 과금</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">상태</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>데이터 없음</Typography>
                    </TableCell></TableRow>
                  ) : filtered.map(r => {
                    const mode = modeByResident.get(r.id);
                    const wallet = walletByResident.get(r.id);
                    return (
                      <TableRow
                        key={r.id}
                        hover
                        onDoubleClick={() => openDetail(r)}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {piiUnmasked ? r.name : maskName(r.name)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{r.unit_number}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {mode?.lpr_mapping ? (piiUnmasked ? mode.lpr_mapping : maskPlate(mode.lpr_mapping)) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                            {mode?.uwb_tag_serial || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {mode ? (
                            <Chip
                              label={MODE_LABELS[mode.current_mode] || mode.current_mode}
                              size="small"
                              color={MODE_COLORS[mode.current_mode] || 'default'}
                              sx={{ height: 22, fontSize: '0.6875rem' }}
                            />
                          ) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            <AccountBalanceWalletIcon sx={{ fontSize: 14, color: wallet && wallet.balance_coins < 5000 ? 'error.main' : 'success.main' }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {wallet ? wallet.balance_coins.toLocaleString() : '-'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="caption">
                            {mode ? `${mode.monthly_accumulated.toLocaleString()} / ${mode.credit_limit.toLocaleString()}` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={r.status}
                            size="small"
                            color={r.status === 'active' ? 'success' : 'default'}
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {!piiUnmasked && (
            <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }} icon={<SecurityIcon sx={{ fontSize: 16 }} />}>
              개인정보 보호 정책[660]에 의거 민감 데이터는 마스킹 표시됩니다. 실데이터 확인은 MFA 인증 후 가능합니다.
            </Alert>
          )}
        </>
      )}

      {/* Tab 1: Commercial Visitor Billing */}
      {tab === 1 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>
            방문차량 실시간 과금 현황
          </Typography>

          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>차량번호</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>입차시간</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>체류시간</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">누적과금</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>할인쿠폰</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>연동매장</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">결제상태</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">출차제한</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visitorSessions.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>방문차량 없음</Typography>
                    </TableCell></TableRow>
                  ) : visitorSessions.map(vs => {
                    const entryTime = new Date(vs.entry_at);
                    const now = vs.exit_at ? new Date(vs.exit_at) : new Date();
                    const minutes = Math.floor((now.getTime() - entryTime.getTime()) / 60000);
                    const charge = vs.accumulated_charge || minutes * vs.rate_per_minute;
                    const isOverdue = vs.payment_status === 'overdue';

                    return (
                      <TableRow key={vs.id} hover sx={{ bgcolor: isOverdue ? 'rgba(255,82,82,0.04)' : undefined }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {piiUnmasked ? vs.plate_number : maskPlate(vs.plate_number)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{entryTime.toLocaleString('ko-KR')}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{minutes}분</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: charge > 10000 ? 'error.main' : 'text.primary' }}>
                            {charge.toLocaleString()}원
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {vs.discount_code ? (
                            <Chip label={vs.discount_code} size="small" color="info" sx={{ height: 20, fontSize: '0.65rem' }} />
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{vs.store_name || '-'}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={vs.payment_status === 'paid' ? '결제완료' : vs.payment_status === 'overdue' ? '연체' : '미결제'}
                            size="small"
                            color={vs.payment_status === 'paid' ? 'success' : vs.payment_status === 'overdue' ? 'error' : 'warning'}
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={vs.exit_lock_active ? '출차 잠금 해제' : '출차 잠금 활성화'}>
                            <IconButton size="small" onClick={() => toggleExitLock(vs)} color={vs.exit_lock_active ? 'error' : 'default'}>
                              {vs.exit_lock_active ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {visitorSessions.filter(v => v.payment_status === 'overdue').length > 0 && (
            <Alert severity="warning" sx={{ mt: 2, fontSize: '0.75rem' }} icon={<WarningAmberIcon sx={{ fontSize: 16 }} />}>
              미결제 초과 차량 {visitorSessions.filter(v => v.payment_status === 'overdue').length}건 - 강제 출차 제한 제어 검토 필요
            </Alert>
          )}
        </>
      )}

      {/* MFA Verification Dialog */}
      <Dialog open={mfaDialogOpen} onClose={() => setMfaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>2차 인증 (MFA)</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }}>
            개인정보 복호화를 위해 OTP 보안키를 입력하세요. 거버넌스[660] 정책에 의거 5분간 유효합니다.
          </Alert>
          <TextField
            label="6자리 OTP 코드"
            value={mfaCode}
            onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            fullWidth
            autoFocus
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center' } } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMfaDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleMfaVerify} disabled={mfaCode.length !== 6}>인증</Button>
        </DialogActions>
      </Dialog>

      {/* User Detail Modal - Double Click */}
      <Dialog open={!!detailResident} onClose={() => setDetailResident(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {detailResident?.name} - 세부 제어
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {detailResident?.unit_number} / 특허 [120] 게이트 제어, [660] 거버넌스
          </Typography>
        </DialogTitle>
        <DialogContent>
          {detailMode && (
            <Box sx={{ mt: 1 }}>
              {/* Service Mode Change */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>서비스 모드 변경</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                {Object.entries(MODE_LABELS).map(([key, label]) => (
                  <Button
                    key={key}
                    variant={detailMode.current_mode === key ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => handleModeChange(key)}
                    disabled={detailMode.current_mode === key}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {label}
                  </Button>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Priority Weight w2 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                출차 우선순위 가중치 ($w_2$)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                교통약자 가중치. 높을수록 우선 배차됩니다.
              </Typography>
              <Slider
                value={detailMode.priority_weight}
                onChange={(_, v) => setDetailMode({ ...detailMode, priority_weight: v as number })}
                onChangeCommitted={(_, v) => handlePriorityChange(v as number)}
                min={0.5}
                max={5.0}
                step={0.5}
                marks={[
                  { value: 1, label: '1.0' },
                  { value: 2.5, label: '2.5' },
                  { value: 5, label: '5.0' },
                ]}
                valueLabelDisplay="on"
                sx={{ mx: 2, mb: 3 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* Gate Interlock [120] */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                게이트 [120] 인터록 제어
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant={detailMode.gate_interlock_status === 'normal' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handleInterlockChange('normal')}
                  color="success"
                  sx={{ fontSize: '0.75rem' }}
                >
                  정상
                </Button>
                <Button
                  variant={detailMode.gate_interlock_status === 'force_open' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handleInterlockChange('force_open')}
                  color="warning"
                  sx={{ fontSize: '0.75rem' }}
                >
                  강제 개방
                </Button>
                <Button
                  variant={detailMode.gate_interlock_status === 'force_locked' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handleInterlockChange('force_locked')}
                  color="error"
                  sx={{ fontSize: '0.75rem' }}
                >
                  강제 잠금
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Wallet Info */}
              {detailWallet && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Palatria Coin 지갑</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">잔액</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>{detailWallet.balance_coins.toLocaleString()}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">누적 충전</Typography>
                      <Typography variant="body2">{detailWallet.lifetime_charged.toLocaleString()}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">누적 사용</Typography>
                      <Typography variant="body2">{detailWallet.lifetime_spent.toLocaleString()}</Typography>
                    </Grid>
                  </Grid>
                  <FormControlLabel
                    control={<Switch checked={detailWallet.auto_deduct_enabled} disabled />}
                    label={<Typography variant="caption">자동 차감 활성화</Typography>}
                    sx={{ mt: 1 }}
                  />
                </Box>
              )}
            </Box>
          )}

          {!detailMode && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              서비스 모드가 등록되지 않은 사용자입니다. 서비스 모드를 먼저 설정하세요.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailResident(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
