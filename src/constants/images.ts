export interface ImageAsset {
  src: string;
  alt: string;
  category: 'hero' | 'exterior' | 'parking' | 'interior' | 'amenity' | 'market';
}

// Hero background — large-scale apartment complex aerial/bird's-eye view
export const HERO_BG = 'https://images.unsplash.com/photo-1573108724029-4c46571d6490?w=1920&q=80';

// Parking garage / underground parking — for PainPoint section
export const PARKING_GARAGE = 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=1600&q=80';

// City skyline / mixed-use buildings — for MarketSection stats backdrop
export const CITY_SKYLINE = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&q=80';

// Market segment building type photos
export const MARKET_BUILDINGS = {
  apartment: 'https://images.unsplash.com/photo-1567684014761-b65e2e59b9eb?w=800&q=75',
  officetel: 'https://images.pexels.com/photos/2462015/pexels-photo-2462015.jpeg?w=800&q=75',
  mixedUse: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=75',
} as const;

// ATR technology section — car in parking structure
export const ATR_CAR = 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=1600&q=80';

// Local photos from public folder
export const LOCAL_IMAGES = {
  buildingExterior: '/image.png',
  buildingExteriorAlt: '/image copy.png',
} as const;

// Gallery images for building showcase
export const GALLERY_IMAGES: ImageAsset[] = [
  { src: LOCAL_IMAGES.buildingExterior, alt: '스카이게러지 적용 아파트 단지 외관', category: 'exterior' },
  { src: LOCAL_IMAGES.buildingExteriorAlt, alt: '스카이게러지 적용 주상복합 단지', category: 'exterior' },
  { src: MARKET_BUILDINGS.apartment, alt: '공동주택 적용 사례', category: 'market' },
  { src: MARKET_BUILDINGS.officetel, alt: '오피스텔 적용 사례', category: 'market' },
  { src: MARKET_BUILDINGS.mixedUse, alt: '주상복합 적용 사례', category: 'market' },
  { src: PARKING_GARAGE, alt: '지하주차장 내부', category: 'parking' },
];
