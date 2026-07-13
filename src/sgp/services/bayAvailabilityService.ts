import { supabase } from '../../lib/supabase';

export interface ParkingSpot {
  id: string;
  spot_number: number;
  zone: string;
  floor: number;
  line: string;
  spot_label: string;
  spot_type: string;
  is_occupied: boolean;
  has_ev_charger: boolean;
  current_vehicle_id: string | null;
}

export interface LineSummary {
  line: string;
  total: number;
  available: number;
  spots: ParkingSpot[];
}

export interface FloorSummary {
  floor: number;
  total: number;
  available: number;
  lines: LineSummary[];
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
    .order('line', { ascending: true })
    .order('spot_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export function buildFloorSummaries(spots: ParkingSpot[]): FloorSummary[] {
  const floorMap = new Map<number, ParkingSpot[]>();

  for (const spot of spots) {
    const floor = spot.floor || 1;
    if (!floorMap.has(floor)) floorMap.set(floor, []);
    floorMap.get(floor)!.push(spot);
  }

  const summaries: FloorSummary[] = [];

  for (const [floor, floorSpots] of Array.from(floorMap.entries()).sort((a, b) => a[0] - b[0])) {
    const lineMap = new Map<string, ParkingSpot[]>();
    for (const spot of floorSpots) {
      const line = spot.line || 'A';
      if (!lineMap.has(line)) lineMap.set(line, []);
      lineMap.get(line)!.push(spot);
    }

    const lines: LineSummary[] = [];
    for (const [line, lineSpots] of Array.from(lineMap.entries()).sort()) {
      lines.push({
        line,
        total: lineSpots.length,
        available: lineSpots.filter(s => !s.is_occupied).length,
        spots: lineSpots,
      });
    }

    summaries.push({
      floor,
      total: floorSpots.length,
      available: floorSpots.filter(s => !s.is_occupied).length,
      lines,
    });
  }

  return summaries;
}

export function subscribeSpotUpdates(
  complexId: string,
  onUpdate: (spot: ParkingSpot) => void
) {
  const channel = supabase
    .channel(`spots-${complexId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'parking_spots',
        filter: `complex_id=eq.${complexId}`,
      },
      (payload) => {
        onUpdate(payload.new as ParkingSpot);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
