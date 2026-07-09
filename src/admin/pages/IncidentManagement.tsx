import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  timeline: { time: string; action: string; actor: string }[];
  evidenceBundleId?: string;
}

const SEVERITY_COLORS: Record<IncidentSeverity, 'error' | 'warning' | 'info' | 'default'> = {
  P0: 'error', P1: 'warning', P2: 'info', P3: 'default',
};

const STATUS_COLORS: Record<IncidentStatus, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  open: 'error', investigating: 'warning', mitigating: 'info', resolved: 'success', closed: 'default',
};

export default function IncidentManagement() {
  useDocumentTitle('인시던트 관리');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setIncidents([
      {
        id: 'INC-001',
        title: '엘리베이터 A 도어 센서 불일치',
        severity: 'P1',
        status: 'investigating',
        source: 'CommandGuard 거절',
        assignedTo: '시설관리팀',
        createdAt: '2026-07-09T08:15:00Z',
        updatedAt: '2026-07-09T08:32:00Z',
        timeline: [
          { time: '08:15', action: 'CommandRejected: doorZoneClear=false', actor: 'System' },
          { time: '08:16', action: '인시던트 자동 생성', actor: 'AlertRouter' },
          { time: '08:20', action: '시설관리팀 배정', actor: 'OPERATOR' },
          { time: '08:32', action: '현장 점검 시작', actor: 'FACILITY_ADMIN' },
        ],
        evidenceBundleId: 'EVD-2026-0709-001',
      },
      {
        id: 'INC-002',
        title: 'ATR-03 비상정지 발동 (장애물 감지)',
        severity: 'P0',
        status: 'mitigating',
        source: 'EmergencyStop',
        assignedTo: '보안관리팀',
        createdAt: '2026-07-09T07:45:00Z',
        updatedAt: '2026-07-09T08:10:00Z',
        timeline: [
          { time: '07:45', action: 'EmergencyStop 발동 (ATR-03 전방 장애물)', actor: 'System' },
          { time: '07:46', action: '안전체인 활성화 (B1 구역)', actor: 'SafetyGate' },
          { time: '07:48', action: '보안관리팀 에스컬레이션', actor: 'AlertRouter' },
          { time: '08:10', action: '장애물 제거 확인, 재개 대기', actor: 'SECURITY_ADMIN' },
        ],
      },
      {
        id: 'INC-003',
        title: 'Adapter timeout: 게이트 [120] 응답없음',
        severity: 'P2',
        status: 'resolved',
        source: 'CommandFailed',
        assignedTo: '시설관리팀',
        createdAt: '2026-07-09T06:30:00Z',
        updatedAt: '2026-07-09T07:15:00Z',
        timeline: [
          { time: '06:30', action: 'CommandFailed: Adapter timeout (3회)', actor: 'System' },
          { time: '06:31', action: 'DLQ 적재, 인시던트 승격', actor: 'CommandGuard' },
          { time: '06:45', action: '게이트 컨트롤러 재부팅', actor: 'FACILITY_ADMIN' },
          { time: '07:15', action: '정상 복구 확인', actor: 'FACILITY_ADMIN' },
        ],
      },
    ]);
  }, []);

  const openDetail = (incident: Incident) => {
    setSelectedIncident(incident);
    setDetailOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>인시던트 관리</Typography>
          <Typography variant="body2" color="text.secondary">
            CommandRejected, EmergencyStop, DeviceFault 기반 인시던트 타임라인
          </Typography>
        </Box>
        <Chip
          label={`활성 ${incidents.filter(i => i.status !== 'resolved' && i.status !== 'closed').length}건`}
          color="error"
          size="small"
        />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>심각도</TableCell>
              <TableCell>제목</TableCell>
              <TableCell>소스</TableCell>
              <TableCell>담당</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>발생</TableCell>
              <TableCell>동작</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {incidents.map((inc) => (
              <TableRow key={inc.id} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{inc.id}</Typography></TableCell>
                <TableCell>
                  <Chip label={inc.severity} size="small" color={SEVERITY_COLORS[inc.severity]} sx={{ fontWeight: 700, minWidth: 36 }} />
                </TableCell>
                <TableCell>{inc.title}</TableCell>
                <TableCell><Typography variant="caption" color="text.secondary">{inc.source}</Typography></TableCell>
                <TableCell>{inc.assignedTo}</TableCell>
                <TableCell>
                  <Chip label={inc.status} size="small" color={STATUS_COLORS[inc.status]} variant="outlined" />
                </TableCell>
                <TableCell><Typography variant="caption">{new Date(inc.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</Typography></TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openDetail(inc)}>상세</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        {selectedIncident && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={selectedIncident.severity} size="small" color={SEVERITY_COLORS[selectedIncident.severity]} />
              {selectedIncident.title}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">소스: {selectedIncident.source}</Typography>
                {selectedIncident.evidenceBundleId && (
                  <Typography variant="caption" sx={{ display: 'block' }} color="primary">
                    Evidence Bundle: {selectedIncident.evidenceBundleId}
                  </Typography>
                )}
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>타임라인</Typography>
              <Box sx={{ pl: 1 }}>
                {selectedIncident.timeline.map((entry, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 2, mb: 1.5, alignItems: 'flex-start' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40, pt: 0.3 }}>
                      {entry.time}
                    </Typography>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: idx === 0 ? 'error.main' : 'primary.main', mt: 0.7, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="body2">{entry.action}</Typography>
                      <Typography variant="caption" color="text.secondary">{entry.actor}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailOpen(false)}>닫기</Button>
              {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                <Button variant="contained" color="success">해결 완료</Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
