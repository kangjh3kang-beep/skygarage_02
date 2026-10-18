// Static imports are checked at build time and receive content-hashed production URLs.
import homeSmall from './photography/home-800.webp';
import homeFull from './photography/home-full.webp';
import homeFallback from './photography/home-fallback.jpg';
import callSmall from './photography/call-800.webp';
import callFull from './photography/call-full.webp';
import callFallback from './photography/call-fallback.jpg';
import garageSmall from './photography/garage-800.webp';
import garageFull from './photography/garage-full.webp';
import garageFallback from './photography/garage-fallback.jpg';
import accessSmall from './photography/access-800.webp';
import accessFull from './photography/access-full.webp';
import accessFallback from './photography/access-fallback.jpg';
import profileSmall from './photography/profile-800.webp';
import profileFull from './photography/profile-full.webp';
import profileFallback from './photography/profile-fallback.jpg';
import requestsSmall from './photography/requests-800.webp';
import requestsFull from './photography/requests-full.webp';
import requestsFallback from './photography/requests-fallback.jpg';
import walletSmall from './photography/wallet-800.webp';
import walletFull from './photography/wallet-full.webp';
import walletFallback from './photography/wallet-fallback.jpg';

export const photography = {
  home: { small: homeSmall, full: homeFull, fallback: homeFallback, width: 1672, height: 941 },
  call: { small: callSmall, full: callFull, fallback: callFallback, width: 1672, height: 941 },
  garage: { small: garageSmall, full: garageFull, fallback: garageFallback, width: 1672, height: 941 },
  access: { small: accessSmall, full: accessFull, fallback: accessFallback, width: 1672, height: 941 },
  profile: { small: profileSmall, full: profileFull, fallback: profileFallback, width: 1672, height: 941 },
  requests: { small: requestsSmall, full: requestsFull, fallback: requestsFallback, width: 1672, height: 941 },
  wallet: { small: walletSmall, full: walletFull, fallback: walletFallback, width: 1672, height: 941 }
} as const;
