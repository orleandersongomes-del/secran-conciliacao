'use client';
import { useEffect, useState } from 'react';

let pushToast: (msg: string, kind?: 'success' | 'error' | '') => void = () => {};

export function toast(msg: string, kind: 'success' | 'error' | '' = '') {
  pushToast(msg, kind);
}

export default function ToastContainer() {
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'success' | 'error' | ''>('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    pushToast = (m, k = '') => {
      setMsg(m);
      setKind(k);
      setShow(true);
      window.clearTimeout((window as any).__toastT);
      (window as any).__toastT = window.setTimeout(() => setShow(false), 2800);
    };
  }, []);

  return (
    <div id="toast" className={`toast ${kind} ${show ? 'show' : ''}`}>
      {msg}
    </div>
  );
}
