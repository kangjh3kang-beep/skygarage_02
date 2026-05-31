import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface FocalData {
  x: number;
  y: number;
  scale?: number;
}

interface SiteImage {
  id: string;
  slot: string;
  url: string;
  alt: string;
  focal_point: FocalData | null;
}

export interface SiteImagesContextValue {
  images: SiteImage[];
  loading: boolean;
  getImageUrl: (slot: string, fallback: string) => string;
  getObjectPosition: (slot: string) => string;
  getImageScale: (slot: string) => number;
  refetch: () => void;
}

export const SiteImagesContext = createContext<SiteImagesContextValue | null>(null);

export function useSiteImagesProvider(): SiteImagesContextValue {
  const [images, setImages] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImages = useCallback(async () => {
    const { data, error } = await supabase
      .from('site_images')
      .select('id, slot, url, alt, focal_point')
      .eq('active', true);
    if (error) {
      console.error('[SiteImages]', error.message);
    }
    setImages(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const getImageUrl = useCallback(
    (slot: string, fallback: string): string => {
      const match = images.find((img) => img.slot === slot);
      return match?.url ?? fallback;
    },
    [images],
  );

  const getObjectPosition = useCallback(
    (slot: string): string => {
      const match = images.find((img) => img.slot === slot);
      if (match?.focal_point) return `${match.focal_point.x}% ${match.focal_point.y}%`;
      return '50% 50%';
    },
    [images],
  );

  const getImageScale = useCallback(
    (slot: string): number => {
      const match = images.find((img) => img.slot === slot);
      return match?.focal_point?.scale ?? 100;
    },
    [images],
  );

  return { images, loading, getImageUrl, getObjectPosition, getImageScale, refetch: fetchImages };
}

export function useSiteImages(): SiteImagesContextValue {
  const ctx = useContext(SiteImagesContext);

  const [images, setImages] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(true);
  const hasContext = !!ctx;

  const fetchImages = useCallback(async () => {
    if (hasContext) return;
    const { data, error } = await supabase
      .from('site_images')
      .select('id, slot, url, alt, focal_point')
      .eq('active', true);
    if (error) {
      console.error('[SiteImages]', error.message);
    }
    setImages(data ?? []);
    setLoading(false);
  }, [hasContext]);

  useEffect(() => {
    if (!hasContext) {
      fetchImages();
    }
  }, [hasContext, fetchImages]);

  const getImageUrl = useCallback(
    (slot: string, fallback: string): string => {
      const source = hasContext ? ctx!.images : images;
      const match = source.find((img) => img.slot === slot);
      return match?.url ?? fallback;
    },
    [hasContext, ctx, images],
  );

  const getObjectPosition = useCallback(
    (slot: string): string => {
      const source = hasContext ? ctx!.images : images;
      const match = source.find((img) => img.slot === slot);
      if (match?.focal_point) return `${match.focal_point.x}% ${match.focal_point.y}%`;
      return '50% 50%';
    },
    [hasContext, ctx, images],
  );

  const getImageScale = useCallback(
    (slot: string): number => {
      const source = hasContext ? ctx!.images : images;
      const match = source.find((img) => img.slot === slot);
      return match?.focal_point?.scale ?? 100;
    },
    [hasContext, ctx, images],
  );

  if (hasContext) {
    return ctx!;
  }

  return { images, loading, getImageUrl, getObjectPosition, getImageScale, refetch: fetchImages };
}
