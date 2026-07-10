import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import EvStationIcon from '@mui/icons-material/EvStation';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SensorsIcon from '@mui/icons-material/Sensors';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import {
  getAvailableSpots,
  buildFloorSummaries,
  subscribeSpotUpdates,
  type ParkingSpot,
  type FloorSummary,
} from '../services/bayAvailabilityService';

export default function SgpAvailableSpotsPage() {
  const { user } = useSgpAuth();
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [floors, setFloors] = useState<FloorSummary[]>([]);
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [complexId, setComplexId] = useState<string | null>(null);
  const [complexName, setComplexName] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sgp_complex_memberships')
      .select('complex_id, complex:complexes(id, name)')
      .eq('user_id', user.id)
      .eq('request_status', 'approved')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setComplexId(data.complex_id);
          setComplexName((data.complex as any)?.name || '');
        }
      });
  }, [user]);

  const fetchSpots = useCallback(async () => {
    if (!complexId) return;
    try {
      const data = await getAvailableSpots(complexId);
      setSpots(data);
      setFloors(buildFloorSummaries(data));
      setLastUpdated(new Date());
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [complexId]);

  useEffect(() => { fetchSpots(); }, [fetchSpots]);

  useEffect(() => {
    if (!complexId) return;
    return subscribeSpotUpdates(complexId, fetchSpots);
  }, [complexId, fetchSpots]);

  const currentFloor = floors[selectedFloor];
  const totalAvailable = spots.filter(s => !s.is_occupied).length;
  const totalSpots = spots.length;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ borderRadius: 2, bgcolor: 'rgba(0,212,170,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#00d4aa' } }} />
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mt: 2, textAlign: 'center' }}>
          주차면 정보를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  if (!complexId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <LocalParkingIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          등록된 단지가 없습니다
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', mt: 1 }}>
          프로필에서 단지를 등록해주세요
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 2 }}>
      {/* Header */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '-0.5px' }}>
              빈주차면
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              {complexName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SensorsIcon sx={{ fontSize: 12, color: '#00d4aa', animation: 'pulse 2s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem' }}>
              실시간
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Summary Card */}
      <Box sx={{ px: 2, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #1b3a52 0%, #0f2438 100%)',
          border: '1px solid rgba(0,212,170,0.15)',
          borderRadius: 3,
          p: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>전체 현황</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem' }}>
              {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
            <Typography variant="h3" sx={{ color: '#00d4aa', fontWeight: 900, letterSpacing: '-1px' }}>
              {totalAvailable}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              / {totalSpots}면 이용가능
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={totalSpots > 0 ? ((totalSpots - totalAvailable) / totalSpots) * 100 : 0}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor: totalAvailable > totalSpots * 0.3 ? '#00d4aa' : totalAvailable > totalSpots * 0.1 ? '#ff9800' : '#f44336',
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00d4aa' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>빈자리</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff5252' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>사용중</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EvStationIcon sx={{ fontSize: 12, color: '#66bb6a' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>EV충전</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Floor Tabs */}
      {floors.length > 0 && (
        <>
          <Box sx={{ px: 2, mb: 1.5 }}>
            <Tabs
              value={selectedFloor}
              onChange={(_, v) => setSelectedFloor(v)}
              variant="scrollable"
              scrollButtons={false}
              sx={{
                minHeight: 36,
                '& .MuiTabs-indicator': { bgcolor: '#00d4aa', height: 2 },
                '& .MuiTab-root': {
                  minHeight: 36,
                  minWidth: 0,
                  px: 1.5,
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  '&.Mui-selected': { color: '#00d4aa' },
                },
              }}
            >
              {floors.map(f => (
                <Tab
                  key={f.floor}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{f.floor < 0 ? `B${Math.abs(f.floor)}` : `${f.floor}F`}</span>
                      <Chip
                        label={f.available}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          bgcolor: f.available > 0 ? 'rgba(0,212,170,0.15)' : 'rgba(255,82,82,0.15)',
                          color: f.available > 0 ? '#00d4aa' : '#ff5252',
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </Box>

          {/* Floor Detail */}
          {currentFloor && (
            <Box sx={{ px: 2 }}>
              {/* Floor Stats */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <StatPill label="전체" value={currentFloor.total} color="rgba(255,255,255,0.6)" />
                <StatPill label="빈자리" value={currentFloor.available} color="#00d4aa" />
                <StatPill label="사용중" value={currentFloor.occupied} color="#ff5252" />
                {currentFloor.evAvailable > 0 && (
                  <StatPill label="EV" value={currentFloor.evAvailable} color="#66bb6a" />
                )}
              </Box>

              {/* Lines */}
              {currentFloor.lines.map(line => (
                <Box key={line.line} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.75rem' }}>
                      {line.line}라인
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>
                      {line.available}/{line.total} 이용가능
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 0.8 }}>
                    {line.spots.map(spot => (
                      <SpotCell key={spot.id} spot={spot} />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {floors.length === 0 && (
        <Box sx={{ px: 2, textAlign: 'center', py: 6 }}>
          <LocalParkingIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.15)', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            주차면 정보가 아직 등록되지 않았습니다
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{
      flex: 1,
      bgcolor: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 2,
      p: 1,
      textAlign: 'center',
    }}>
      <Typography variant="h6" sx={{ color, fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>
        {label}
      </Typography>
    </Box>
  );
}

function SpotCell({ spot }: { spot: ParkingSpot }) {
  const isAvailable = !spot.is_occupied;
  const isEv = spot.has_ev_charger;

  return (
    <Box sx={{
      position: 'relative',
      aspectRatio: '1',
      borderRadius: 1.5,
      bgcolor: isAvailable
        ? (isEv ? 'rgba(102,187,106,0.12)' : 'rgba(0,212,170,0.08)')
        : 'rgba(255,82,82,0.08)',
      border: '1px solid',
      borderColor: isAvailable
        ? (isEv ? 'rgba(102,187,106,0.3)' : 'rgba(0,212,170,0.2)')
        : 'rgba(255,82,82,0.2)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
    }}>
      {isAvailable ? (
        isEv ? (
          <EvStationIcon sx={{ fontSize: 14, color: '#66bb6a', mb: 0.2 }} />
        ) : (
          <LocalParkingIcon sx={{ fontSize: 14, color: '#00d4aa', mb: 0.2, opacity: 0.7 }} />
        )
      ) : (
        <DirectionsCarIcon sx={{ fontSize: 14, color: '#ff5252', mb: 0.2, opacity: 0.6 }} />
      )}
      <Typography sx={{
        fontSize: '0.58rem',
        fontWeight: 700,
        color: isAvailable ? (isEv ? '#66bb6a' : '#00d4aa') : 'rgba(255,82,82,0.7)',
        lineHeight: 1,
      }}>
        {spot.spot_number}
      </Typography>
    </Box>
  );
}
