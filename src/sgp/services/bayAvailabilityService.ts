import { supabase } from '../../lib/supabase';

export interface ParkingSpot {
  id: string;
  spot_number: string;
  zone: string;
  floor: number;
  line: string;
  spot_label: string | null;
  spot_type: string;
  is_occupied: boolean;
  has_ev_charger: boolean;
  current_vehicle_id: string | null;
}

export interface FloorSummary {
  floor: number;
  total: number;
  available: number;
  occupied: number;
  evAvailable: number;
  lines: LineSummary[];
}

export interface LineSummary {
  line: string;
  spots: ParkingSpot[];
  available: number;
  total: number;
}

export async function getAvailableSpots(complexId: string): Promise<ParkingSpot[]> {
  const { data, error } = await supabase
    .from('parking_spots')
    .select('id, spot_number, zone, floor, line, spot_label, spot_type, is_occupied, has_ev_charger, current_vehicle_id')
    .eq('complex_id', complexId)
    .order('floor', { ascending: true })
    .order('line', { ascending: true })
    .order('spot_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getAvailableSpotsByFloor(complexId: string, floor: number): Promise<ParkingSpot[]> {
  const { data, error } = await supabase
    .from('parking_spots')
    .select('id, spot_number, zone, floor, line, spot_label, spot_type, is_occupied, has_ev_charger, current_vehicle_id')
    .eq('complex_id', complexId)
    .eq('floor', floor)
    .eq('is_occupied', false)
    .order('line', { ascending: true })
    .order('spot_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export function buildFloorSummaries(spots: ParkingSpot[]): FloorSummary[] {
  const floorMap = new Map<number, ParkingSpot[]>();
  for (const spot of spots) {
    const arr = floorMap.get(spot.floor) || [];
    arr.push(spot);
    floorMap.set(spot.floor, arr);
  }

  const summaries: FloorSummary[] = [];
  for (const [floor, floorSpots] of floorMap) {
    const lineMap = new Map<string, ParkingSpot[]>();
    for (const s of floorSpots) {
      const arr = lineMap.get(s.line) || [];
      arr.push(s);
      lineMap.set(s.line, arr);
    }

    const lines: LineSummary[] = [];
    for (const [line, lineSpots] of lineMap) {
      lines.push({
        line,
        spots: lineSpots,
        available: lineSpots.filter(s => !s.is_occupied).length,
        total: lineSpots.length,
      });
    }
    lines.sort((a, b) => a.line.localeCompare(b.line));

    summaries.push({
      floor,
      total: floorSpots.length,
      available: floorSpots.filter(s => !s.is_occupied).length,
      occupied: floorSpots.filter(s => s.is_occupied).length,
      evAvailable: floorSpots.filter(s => !s.is_occupied && s.has_ev_charger).length,
      lines,
    });
  }

  summaries.sort((a, b) => a.floor - b.floor);
  return summaries;
}

export function subscribeSpotUpdates(complexId: string, onUpdate: () => void) {
  const channel = supabase
    .channel(`spots_${complexId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'parking_spots',
      filter: `complex_id=eq.${complexId}`,
    }, () => onUpdate())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
