import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | SkyGarage` : 'SkyGarage Admin';
  }, [title]);
}
