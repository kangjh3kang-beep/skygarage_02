import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ElevatorIcon from '@mui/icons-material/Elevator';
import PeopleIcon from '@mui/icons-material/People';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  useDocumentTitle('SkyGarage Admin - 대시보드');
  const [stats, setStats] = useState({ complexes: 0, atrUnits: 0, elevators: 0, residents: 0 });

  useEffect(() => {
    async function fetchStats() {
      const [c, a, e, r] = await Promise.all([
        supabase.from('complexes').select('id', { count: 'exact', head: true }),
        supabase.from('atr_units').select('id', { count: 'exact', head: true }),
        supabase.from('elevators').select('id', { count: 'exact', head: true }),
        supabase.from('resident_accounts').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        complexes: c.count ?? 0,
        atrUnits: a.count ?? 0,
        elevators: e.count ?? 0,
        residents: r.count ?? 0,
      });
    }
    fetchStats();
  }, []);

  const cards = [
    { label: '등록 단지', value: stats.complexes, icon: <DirectionsCarIcon />, color: '#0ea5e9' },
    { label: 'ATR 로봇', value: stats.atrUnits, icon: <SmartToyIcon />, color: '#06b6d4' },
    { label: '차량 엘리베이터', value: stats.elevators, icon: <ElevatorIcon />, color: '#f59e0b' },
    { label: '입주민', value: stats.residents, icon: <PeopleIcon />, color: '#10b981' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>대시보드</Typography>
        <Chip label="Live" size="small" color="success" sx={{ fontSize: '0.6rem', height: 20, animation: 'pulse 2s infinite' }} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map(card => (
          <Grid size={{ xs: 6, md: 3 }} key={card.label}>
            <Card sx={{ border: '1px solid', borderColor: 'divider', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: `${card.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                    {card.icon}
                  </Box>
                  <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>{card.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ border: '1px solid', borderColor: 'divider', p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>시스템 상태</Typography>
        <Typography variant="body2" color="text.secondary">
          모든 시스템 정상 운영 중입니다. 하드웨어 연동 현황은 좌측 메뉴의 "하드웨어 연동"에서 확인하세요.
        </Typography>
      </Card>
    </Box>
  );
}
