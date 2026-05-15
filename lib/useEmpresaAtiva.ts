'use client';
import { useEffect, useState } from 'react';

export function useEmpresaAtiva(): string {
  const [id, setId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('secran-empresa-ativa') || '';
  });
  useEffect(() => {
    function handler(e: any) {
      setId(e.detail || '');
    }
    window.addEventListener('empresa-changed', handler);
    return () => window.removeEventListener('empresa-changed', handler);
  }, []);
  return id;
}
