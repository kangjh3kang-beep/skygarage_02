import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

function getSessionId(): string {
  const key = 'skygarage_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function usePageTracking(pagePath: string) {
  useEffect(() => {
    const sessionId = getSessionId();

    supabase.from('page_views').insert({
      page_path: pagePath,
      referrer: document.referrer || '',
      user_agent: navigator.userAgent,
      screen_width: window.innerWidth,
      session_id: sessionId,
    }).then(({ error }) => {
      if (error) console.error('[PageTracking]', error.message);
    });
  }, [pagePath]);
}
