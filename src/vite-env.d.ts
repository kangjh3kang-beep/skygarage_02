/// <reference types="vite/client" />

interface DaumPostcodeData {
  address: string;
  addressEnglish: string;
  addressType: string;
  roadAddress: string;
  roadAddressEnglish: string;
  jibunAddress: string;
  jibunAddressEnglish: string;
  zonecode: string;
  buildingName: string;
  bname: string;
  sido: string;
  sigungu: string;
  bname1: string;
  bname2: string;
  roadname: string;
  autoRoadAddress: string;
  autoJibunAddress: string;
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void;
  onclose?: () => void;
  width?: string | number;
  height?: string | number;
  animation?: boolean;
  theme?: Record<string, string>;
}

declare namespace daum {
  class Postcode {
    constructor(options: DaumPostcodeOptions);
    open(): void;
    embed(element: HTMLElement): void;
  }
}
