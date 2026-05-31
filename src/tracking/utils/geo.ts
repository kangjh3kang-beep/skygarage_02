import type { LatLng } from '../types';

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

export function haversineDistance(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function calculateETA(distanceKm: number, speedKmh: number): number {
  if (speedKmh <= 0) return distanceKm * 3;
  return (distanceKm / speedKmh) * 60;
}

export function calculateProgress(
  origin: LatLng,
  destination: LatLng,
  current: LatLng
): number {
  const totalDist = haversineDistance(origin, destination);
  if (totalDist === 0) return 100;
  const remainingDist = haversineDistance(current, destination);
  const progress = ((totalDist - remainingDist) / totalDist) * 100;
  return Math.max(0, Math.min(100, progress));
}

export function getBearing(from: LatLng, to: LatLng): number {
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRadians(to.lat));
  const x =
    Math.cos(toRadians(from.lat)) * Math.sin(toRadians(to.lat)) -
    Math.sin(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return '1분 미만';
  if (minutes < 60) return `${Math.round(minutes)}분`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}시간 ${m}분`;
}

export function isWithinRadius(from: LatLng, to: LatLng, radiusKm: number): boolean {
  return haversineDistance(from, to) <= radiusKm;
}
