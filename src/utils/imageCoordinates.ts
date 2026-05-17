import { LAYOUT_CONFIGS, SITE_IMAGE_ASPECT_RATIOS, DEFAULT_ASPECT_RATIO } from '../constants/imageLayout';
import type { ColumnLayout } from '../constants/imageLayout';

export interface FocalData {
  x: number;
  y: number;
  scale?: number;
}

export function clampFocalPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(100, Math.round(x))),
    y: Math.max(0, Math.min(100, Math.round(y))),
  };
}

export function clampScale(scale: number): number {
  return Math.max(100, Math.min(300, Math.round(scale)));
}

export function toObjectPosition(focal: FocalData | null | undefined): string {
  if (!focal) return '50% 50%';
  return `${focal.x}% ${focal.y}%`;
}

export function toTransformScale(focal: FocalData | null | undefined): string | undefined {
  if (!focal?.scale || focal.scale <= 100) return undefined;
  return `scale(${focal.scale / 100})`;
}

export function toTransformOrigin(focal: FocalData | null | undefined): string {
  if (!focal) return '50% 50%';
  return `${focal.x}% ${focal.y}%`;
}

export function getAspectRatioForLayout(layout: ColumnLayout): string {
  return LAYOUT_CONFIGS[layout]?.aspectRatio ?? LAYOUT_CONFIGS['1col'].aspectRatio;
}

export function getAspectRatioForSlot(slot: string): string {
  return SITE_IMAGE_ASPECT_RATIOS[slot] ?? DEFAULT_ASPECT_RATIO;
}

export function getHeightForLayout(layout: ColumnLayout): { xs: number; md: number } {
  return LAYOUT_CONFIGS[layout]?.height ?? LAYOUT_CONFIGS['1col'].height;
}

export function createDefaultFocalData(): FocalData {
  return { x: 50, y: 50, scale: 100 };
}

export function normalizeFocalData(data: Partial<FocalData> | null | undefined): FocalData {
  return {
    x: data?.x ?? 50,
    y: data?.y ?? 50,
    scale: data?.scale ?? 100,
  };
}
