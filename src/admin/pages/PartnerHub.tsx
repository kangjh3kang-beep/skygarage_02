import { useState } from 'react';
import {
  Box, Paper, Typography, Grid, Chip, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Avatar, Button, LinearProgress,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AssessmentIcon from '@mui/icons-material/Assessment';

interface Partner {
  id: string;
  name: string;
  type: 'manufacturer' | 'maintenance' | 'energy' | 'logistics';
  status: 'active' | 'suspended' | 'pending';
  contractEnd: string;
  monthlyRevenue: number;
  settledAmount: number;
}

const MOCK_PARTNERS: Partner[] = [
  { id: 'p1', name: '현대엘리베이터', type: 'manufacturer', status: 'active', contractEnd: '2027-12-31', monthlyRevenue: 12500000, settledAmount: 10000000 },
  { id: 'p2', name: '삼성물산 서비스', type: 'maintenance', status: 'active', contractEnd: '2026-06-30', monthlyRevenue: 3200000, settledAmount: 3200000 },
  { id: 'p3', name: 'SK E&S', type: 'energy', status: 'active', contractEnd: '2028-03-15', monthlyRevenue: 8900000, settledAmount: 7100000 },
  { id: 'p4', name: 'CJ대한통운', type: 'logistics', status: 'pending', contractEnd: '2026-12-01', monthlyRevenue: 0, settledAmount: 0 },
];

const TYPE_LABELS: Record<string, string> = {
  manufacturer: '제조사',
  maintenance: '유지보수',
  energy: '에너지',
  logistics: '물류',
};

export default function PartnerHub() {
  const [tab, setTab] = useState(0);

  const activePartners = MOCK_PARTNERS.filter(p => p.status === 'active');
  const totalRevenue = activePartners.reduce((sum, p) => sum + p.monthlyRevenue, 0);
  const totalSettled = activePartners.reduce((sum, p) => sum + p.settledAmount, 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>파트너 허브</Typography>
        <Button variant="contained" startIcon={<BusinessIcon />}>파트너 추가</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">활성 파트너</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{activePartners.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">월간 매출</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {(totalRevenue / 1000000).toFixed(1)}M
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">정산 진행률</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {totalRevenue > 0 ? Math.round((totalSettled / totalRevenue) * 100) : 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<BusinessIcon />} label="파트너 목록" iconPosition="start" />
        <Tab icon={<ReceiptLongIcon />} label="정산 내역" iconPosition="start" />
        <Tab icon={<AssessmentIcon />} label="성과 리포트" iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>파트너</TableCell>
                <TableCell>유형</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>계약 종료</TableCell>
                <TableCell align="right">월 매출</TableCell>
                <TableCell>정산률</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {MOCK_PARTNERS.map(partner => (
                <TableRow key={partner.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main' }}>
                        {partner.name[0]}
                      </Avatar>
                      {partner.name}
                    </Box>
                  </TableCell>
                  <TableCell>{TYPE_LABELS[partner.type]}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={partner.status === 'active' ? '활성' : partner.status === 'pending' ? '대기' : '정지'}
                      color={partner.status === 'active' ? 'success' : partner.status === 'pending' ? 'warning' : 'error'}
                    />
                  </TableCell>
                  <TableCell>{partner.contractEnd}</TableCell>
                  <TableCell align="right">
                    {partner.monthlyRevenue > 0 ? `${(partner.monthlyRevenue / 10000).toLocaleString()}만원` : '-'}
                  </TableCell>
                  <TableCell>
                    {partner.monthlyRevenue > 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={(partner.settledAmount / partner.monthlyRevenue) * 100}
                          sx={{ flex: 1, height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption">
                          {Math.round((partner.settledAmount / partner.monthlyRevenue) * 100)}%
                        </Typography>
                      </Box>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <ReceiptLongIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">정산 데이터를 불러오는 중...</Typography>
        </Paper>
      )}

      {tab === 2 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <AssessmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">리포트를 생성하는 중...</Typography>
        </Paper>
      )}
    </Box>
  );
}
