'use client';
import { useEffect } from 'react';

/**
 * Event bus minimalista pra forçar reload de páginas/componentes client-side
 * quando dados mudam em qualquer lugar do app.
 *
 * Uso típico:
 *   - Quem MUTA chama `notifyRefresh('empresas')` ou `notifyRefresh('all')`
 *   - Quem EXIBE usa `useRefreshListener(['empresas','dados'], reload)`
 */

export type RefreshKey =
  | 'empresas'
  | 'consultores'
  | 'plano'
  | 'regras'
  | 'transactions'
  | 'dados' // shortcut: plano + transactions
  | 'all';

const EVENT_PREFIX = 'secran:refresh:';

export function notifyRefresh(...keys: RefreshKey[]) {
  if (typeof window === 'undefined') return;
  for (const k of keys) {
    window.dispatchEvent(new CustomEvent(EVENT_PREFIX + k));
  }
  // emite 'all' também pra ouvintes globais
  window.dispatchEvent(new CustomEvent(EVENT_PREFIX + 'all'));
}

export function useRefreshListener(keys: RefreshKey[], handler: () => void) {
  useEffect(() => {
    const listeners: Array<{ key: string; fn: () => void }> = [];
    for (const k of keys) {
      const fn = () => handler();
      listeners.push({ key: EVENT_PREFIX + k, fn });
      window.addEventListener(EVENT_PREFIX + k, fn);
    }
    return () => {
      for (const l of listeners) window.removeEventListener(l.key, l.fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(',')]);
}
