import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import PauseIcon from '@mui/icons-material/Pause';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { MISSION_STATUS_LABELS, MISSION_STATUS_COLORS, BOTTLENECK_CONTROL_POINTS } from '../../domain';
import type { MissionStatus } from '../../domain';

interface ActiveMission {
  id: string;
  vehiclePlate: string;
  status: MissionStatus;
  atrId: string;
  elevatorId: string;
  requestedAt: string;
  priority: number;
  household: string;
}

const PIPELINE_STEPS: MissionStatus[] = [
  'REQUESTED', 'AUTH_CHECKING', 'SMOOTHING', 'ALLOCATING', 'ALLOCATED',
  'DT_VERIFYING', 'SAFETY_GATING', 'APPROVED', 'IN_TRANSIT', 'ALIGNING',
  'DOCKING', 'AT_PICKUP', 'COMPLETED',
];

export default function MissionControl() {
  useDocumentTitle('미션 관제');
  const [missions, setMissions] = useState<ActiveMission[]>([]);

  useEffect(() => {
    setMissions([
      { id: 'MSN-001', vehiclePlate: '12가 3456', status: 'IN_TRANSIT', atrId: 'ATR-01', elevatorId: 'EV-A', requestedAt: '08:12', priority: 1, household: '101동 1502호' },
      { id: 'MSN-002', vehiclePlate: '34나 7890', status: 'SAFETY_GATING', atrId: 'ATR-02', elevatorId: 'EV-B', requestedAt: '08:15', priority: 2, household: '102동 803호' },
      { id: 'MSN-003', vehiclePlate: '56다 1234', status: 'ALLOCATING', atrId: '-', elevatorId: '-', requestedAt: '08:18', priority: 3, household: '103동 201호' },
      { id: 'MSN-004', vehiclePlate: '78라 5678', status: 'SMOOTHING', atrId: '-', elevatorId: '-', requestedAt: '08:20', priority: 1, household: '101동 502호' },
      { id: 'MSN-005', vehiclePlate: '90마 9012', status: 'AT_PICKUP', atrId: 'ATR-03', elevatorId: 'EV-A', requestedAt: '08:05', priority: 2, household: '104동 1201호' },
    ]);
  }, []);

  const statusCounts = missions.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>미션 관제</Typography>
          <Typography variant="body2" color="text.secondary">
            실시간 미션 파이프라인 상태 및 수동 개입
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip icon={<LocalShippingIcon />} label={`활성 ${missions.length}건`} color="primary" size="small" />
          <IconButton size="small"><RefreshIcon /></IconButton>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(['IN_TRANSIT', 'SAFETY_GATING', 'ALLOCATING', 'COMPLETED'] as MissionStatus[]).map(status => (
          <Grid size={{ xs: 6, md: 3 }} key={status}>
            <Card sx={{ borderTop: `3px solid ${MISSION_STATUS_COLORS[status]}` }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">{MISSION_STATUS_LABELS[status]}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{statusCounts[status] || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>파이프라인 단계별 현황</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', pb: 1 }}>
          {PIPELINE_STEPS.map((step) => (
            <Box key={step} sx={{
              minWidth: 80,
              p: 1,
              borderRadius: 1,
              textAlign: 'center',
              bgcolor: statusCounts[step] ? `${MISSION_STATUS_COLORS[step]}22` : 'action.hover',
              border: BOTTLENECK_CONTROL_POINTS.includes(step) ? '2px solid' : '1px solid',
              borderColor: BOTTLENECK_CONTROL_POINTS.includes(step) ? 'warning.main' : 'divider',
            }}>
              <Typography variant="caption" sx={{ fontSize: '0.6rem', display: 'block', lineHeight: 1.2 }}>
                {MISSION_STATUS_LABELS[step]}
              </Typography>
              {BOTTLENECK_CONTROL_POINTS.includes(step) && (
                <Typography variant="caption" sx={{ color: 'warning.main', fontSize: '0.55rem' }}>★</Typography>
              )}
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {statusCounts[step] || 0}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>미션 ID</TableCell>
              <TableCell>차량</TableCell>
              <TableCell>세대</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>ATR</TableCell>
              <TableCell>엘리베이터</TableCell>
              <TableCell>우선순위</TableCell>
              <TableCell>요청시간</TableCell>
              <TableCell>동작</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {missions.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{m.id}</Typography></TableCell>
                <TableCell><Typography variant="body2">{m.vehiclePlate}</Typography></TableCell>
                <TableCell><Typography variant="caption">{m.household}</Typography></TableCell>
                <TableCell>
                  <Chip
                    label={MISSION_STATUS_LABELS[m.status]}
                    size="small"
                    sx={{ bgcolor: MISSION_STATUS_COLORS[m.status], color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell>{m.atrId}</TableCell>
                <TableCell>{m.elevatorId}</TableCell>
                <TableCell>
                  <Chip label={`P${m.priority}`} size="small" variant="outlined" sx={{ height: 20 }} />
                </TableCell>
                <TableCell><Typography variant="caption">{m.requestedAt}</Typography></TableCell>
                <TableCell>
                  <Tooltip title="재배차">
                    <IconButton size="small"><RefreshIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="일시정지">
                    <IconButton size="small"><PauseIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
