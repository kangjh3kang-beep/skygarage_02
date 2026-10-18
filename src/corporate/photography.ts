import towerSmall from './assets/tower-800.webp';
import towerFull from './assets/tower-full.webp';
import towerFallback from './assets/tower-fallback.jpg';
import citySmall from './assets/city-800.webp';
import cityFull from './assets/city-full.webp';
import cityFallback from './assets/city-fallback.jpg';
import villageSmall from './assets/village-800.webp';
import villageFull from './assets/village-full.webp';
import villageFallback from './assets/village-fallback.jpg';
import residenceSmall from './assets/residence-800.webp';
import residenceFull from './assets/residence-full.webp';
import residenceFallback from './assets/residence-fallback.jpg';
import valetSmall from './assets/valet-800.webp';
import valetFull from './assets/valet-full.webp';
import valetFallback from './assets/valet-fallback.jpg';
import elevatorSmall from './assets/elevator-800.webp';
import elevatorFull from './assets/elevator-full.webp';
import elevatorFallback from './assets/elevator-fallback.jpg';
import robotSmall from './assets/robot-800.webp';
import robotFull from './assets/robot-full.webp';
import robotFallback from './assets/robot-fallback.jpg';
import carrierSmall from './assets/carrier-800.webp';
import carrierFull from './assets/carrier-full.webp';
import carrierFallback from './assets/carrier-fallback.jpg';

export const corporatePhotography = {
  tower: {small: towerSmall, full: towerFull, fallback: towerFallback},
  city: {small: citySmall, full: cityFull, fallback: cityFallback},
  village: {small: villageSmall, full: villageFull, fallback: villageFallback},
  residence: {small: residenceSmall, full: residenceFull, fallback: residenceFallback},
  valet: {small: valetSmall, full: valetFull, fallback: valetFallback},
  elevator: {small: elevatorSmall, full: elevatorFull, fallback: elevatorFallback},
  robot: {small: robotSmall, full: robotFull, fallback: robotFallback},
  carrier: {small: carrierSmall, full: carrierFull, fallback: carrierFallback}
} as const;
export type CorporateScene = keyof typeof corporatePhotography;
