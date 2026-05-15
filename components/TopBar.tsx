'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useRefreshListener } from '@/lib/refresh';

type Empresa = { id: string; nome: string; fantasia: string | null };

export default function TopBar({ userName }: { userName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaAtivaId, setEmpresaAtivaId] = useState('');

  const loadEmpresas = useCallback(() => {
    fetch('/api/empresas')
      .then((r) => r.json())
      .then((d) => {
        const list: Empresa[] = d.empresas || [];
        setEmpresas(list);
        const saved = localStorage.getItem('secran-empresa-ativa') || '';
        if (saved && list.some((e) => e.id === saved)) {
          setEmpresaAtivaId(saved);
        } else if (list[0]) {
          setEmpresaAtivaId(list[0].id);
          localStorage.setItem('secran-empresa-ativa', list[0].id);
          window.dispatchEvent(new CustomEvent('empresa-changed', { detail: list[0].id }));
        } else {
          setEmpresaAtivaId('');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadEmpresas();
  }, [loadEmpresas]);

  useRefreshListener(['empresas', 'all'], loadEmpresas);

  function onChangeEmpresa(id: string) {
    setEmpresaAtivaId(id);
    localStorage.setItem('secran-empresa-ativa', id);
    window.dispatchEvent(new CustomEvent('empresa-changed', { detail: id }));
    router.refresh();
  }

  async function onLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('secran-empresa-ativa');
    router.push('/login');
    router.refresh();
  }

  const needsEmpresa = ['/plano', '/regras', '/conciliar', '/historico'];
  const has = !!empresaAtivaId;

  const tabs: { href: string; label: string; needsEmp?: boolean }[] = [
    { href: '/painel', label: 'Painel' },
    { href: '/empresas', label: 'Empresas' },
    { href: '/consultores', label: 'Consultores' },
    { href: '/plano', label: 'Plano', needsEmp: true },
    { href: '/regras', label: 'Regras', needsEmp: true },
    { href: '/conciliar', label: 'Conciliar', needsEmp: true },
    { href: '/relatorios', label: 'Relatórios', needsEmp: true },
    { href: '/historico', label: 'Histórico', needsEmp: true },
    { href: '/importacoes', label: 'Importações', needsEmp: true },
  ];

  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand-mark" src="/assets/logo.png" alt="Secran Gestão" />
        <div className="brand-text">
          <div className="brand-name">
            SECRAN <span>GESTÃO</span>
          </div>
          <div className="brand-sub">Conciliação Financeira</div>
        </div>
      </div>

      <div className="empresa-selector">
        <label>Empresa</label>
        <select value={empresaAtivaId} onChange={(e) => onChangeEmpresa(e.target.value)}>
          <option value="">— selecione —</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fantasia || e.nome}
            </option>
          ))}
        </select>
      </div>

      <nav className="topnav">
        {tabs.map((t) => {
          const active = pathname === t.href;
          const disabled = t.needsEmp && !has;
          return disabled ? (
            <span key={t.href} className="nav-btn" style={{ opacity: 0.35, cursor: 'not-allowed' }}>
              {t.label}
            </span>
          ) : (
            <Link key={t.href} href={t.href} className={`nav-btn${active ? ' active' : ''}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="row-gap" style={{ marginLeft: 'auto' }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{userName}</span>
        <button className="btn btn-ghost" onClick={onLogout} style={{ padding: '6px 12px', fontSize: 11 }}>
          Sair
        </button>
      </div>
    </header>
  );
}
