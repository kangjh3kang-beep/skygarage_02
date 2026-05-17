export type ColumnLayout = '1col' | '2col' | '3col';

interface LayoutConfig {
  height: { xs: number; md: number };
  aspectRatio: string;
}

export const LAYOUT_CONFIGS: Record<ColumnLayout, LayoutConfig> = {
  '1col': {
    height: { xs: 280, md: 460 },
    aspectRatio: '2.6/1',
  },
  '2col': {
    height: { xs: 200, md: 300 },
    aspectRatio: '1.97/1',
  },
  '3col': {
    height: { xs: 200, md: 300 },
    aspectRatio: '1.3/1',
  },
};

export type SiteImageSlot =
  | 'hero-background'
  | 'painpoint-visual'
  | 'solution-visual'
  | 'technology-visual'
  | 'technology-detail'
  | 'process-visual'
  | 'benefits-visual'
  | 'market-background'
  | 'market-apartment'
  | 'market-officetel'
  | 'market-mixed'
  | 'trust-visual'
  | 'contact-background'
  | 'brand-hero';

export const SITE_IMAGE_ASPECT_RATIOS: Record<string, string> = {
  'hero-background': '16/9',
  'painpoint-visual': '4/1',
  'solution-visual': '16/9',
  'technology-visual': '4/3',
  'technology-detail': '16/9',
  'process-visual': '16/9',
  'benefits-visual': '16/9',
  'market-background': '3/1',
  'market-apartment': '16/9',
  'market-officetel': '16/9',
  'market-mixed': '16/9',
  'trust-visual': '16/9',
  'contact-background': '3/1',
  'brand-hero': '16/9',
};

export const DEFAULT_ASPECT_RATIO = '16/9';
