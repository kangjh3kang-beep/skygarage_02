import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import EvStationIcon from '@mui/icons-material/EvStation';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import {
  getAvailableSpots,
  buildFloorSummaries,
  subscribeSpotUpdates,
} from '../services/bayAvailabilityService';
import type { ParkingSpot, FloorSummary } from '../services/bayAvailabilityService';

export default function SgpAvailableSpotsPage() {
  const { user } = useSgpAuth();
  const navigate = useNavigate();
  const [floors, setFloors] = useState<FloorSummary[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [complexId, setComplexId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sgp_complex_memberships')
      .select('complex_id')
      .eq('user_id', user.id)
      .eq('request_status', 'approved')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.complex_id) setComplexId(data.complex_id);
      });
  }, [user]);

  const loadSpots = useCallback(async () => {
    if (!complexId) return;
    try {
      const spots = await getAvailableSpots(complexId);
      const summaries = buildFloorSummaries(spots);
      setFloors(summaries);
      if (summaries.length > 0 && selectedFloor === null) {
        setSelectedFloor(summaries[0].floor);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [complexId, selectedFloor]);

  useEffect(() => {
    loadSpots();
  }, [loadSpots]);

  useEffect(() => {
    if (!complexId) return;
    const unsubscribe = subscribeSpotUpdates(complexId, (updatedSpot: ParkingSpot) => {
      setFloors(prev => {
        const newFloors = [...prev];
        for (const floor of newFloors) {
          for (const line of floor.lines) {
            const idx = line.spots.findIndex(s => s.id === updatedSpot.id);
            if (idx !== -1) {
              line.spots[idx] = updatedSpot;
              line.available = line.spots.filter(s => !s.is_occupied).length;
              floor.available = floor.lines.reduce((sum, l) => sum + l.available, 0);
              return newFloors;
            }
          }
        }
        return prev;
      });
    });
    return unsubscribe;
  }, [complexId]);

  const currentFloor = floors.find(f => f.floor === selectedFloor);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1.5, pb: 1 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ color: '#fff', mr: 1 }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
          빈 주차면 현황
        </Typography>
      </Box>

      {/* Floor Tabs */}
      <Box sx={{ px: 2, mb: 2, display: 'flex', gap: 1, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
        {floors.map(f => (
          <Chip
            key={f.floor}
            label={`${f.floor}F (${f.available})`}
            onClick={() => setSelectedFloor(f.floor)}
            sx={{
              bgcolor: selectedFloor === f.floor ? '#00d4aa' : 'rgba(255,255,255,0.06)',
              color: selectedFloor === f.floor ? '#0d1b2a' : 'rgba(255,255,255,0.7)',
              fontWeight: 700,
              fontSize: '0.75rem',
              '&:hover': { bgcolor: selectedFloor === f.floor ? '#00d4aa' : 'rgba(255,255,255,0.1)' },
            }}
          />
        ))}
      </Box>

      {/* Summary */}
      {currentFloor && (
        <Box sx={{ px: 2, mb: 2 }}>
          <Box sx={{
            p: 2, borderRadius: 3,
            bgcolor: 'rgba(0,212,170,0.06)',
            border: '1px solid rgba(0,212,170,0.15)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  {currentFloor.floor}층 전체
                </Typography>
                <Typography variant="h5" sx={{ color: '#00d4aa', fontWeight: 800 }}>
                  {currentFloor.available}<Typography component="span" variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', ml: 0.5 }}>/ {currentFloor.total}</Typography>
                </Typography>
              </Box>
              <LocalParkingIcon sx={{ fontSize: 32, color: 'rgba(0,212,170,0.3)' }} />
            </Box>
          </Box>
        </Box>
      )}

      {/* Lines with spot grid */}
      {currentFloor?.lines.map(line => (
        <Box key={line.line} sx={{ px: 2, mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
              {line.line}라인
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(0,212,170,0.8)', fontWeight: 600 }}>
              {line.available}/{line.total} 가능
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 0.8 }}>
            {line.spots.map(spot => (
              <Box
                key={spot.id}
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: spot.is_occupied
                    ? 'rgba(244,67,54,0.12)'
                    : spot.has_ev_charger
                      ? 'rgba(76,175,80,0.15)'
                      : 'rgba(0,212,170,0.08)',
                  border: `1px solid ${
                    spot.is_occupied
                      ? 'rgba(244,67,54,0.3)'
                      : spot.has_ev_charger
                        ? 'rgba(76,175,80,0.3)'
                        : 'rgba(0,212,170,0.2)'
                  }`,
                  transition: 'all 0.3s',
                }}
              >
                <Typography sx={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: spot.is_occupied ? 'rgba(244,67,54,0.8)' : '#00d4aa',
                }}>
                  {spot.spot_label || spot.spot_number}
                </Typography>
                {spot.has_ev_charger && !spot.is_occupied && (
                  <EvStationIcon sx={{ fontSize: 12, color: '#66bb6a', mt: 0.2 }} />
                )}
              </Box>
            ))}
          </Box>
        </Box>
      ))}

      {floors.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            주차면 정보가 없습니다
          </Typography>
        </Box>
      )}
    </Box>
  );
}
