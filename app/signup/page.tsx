'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', cargo: '', telefone: '' });
  const [error, setError] = useState('');
  const [pendingMsg, setPendingMsg] = useState('');
  const [loading, setLoading] = useState(false);

  function upd(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPendingMsg('');
    setLoading(true);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Erro no cadastro');
      return;
    }
    if (data.pending) {
      setPendingMsg(data.message || 'Aguardando aprovação do administrador.');
      return;
    }
    router.push('/painel');
    router.refresh();
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <img src="/assets/logo.png" alt="Secran Gestão" className="auth-logo" />
        <h1>Solicitar acesso</h1>
        <p className="muted">Novas contas precisam ser aprovadas pelo administrador. O primeiro usuário cadastrado vira admin automaticamente.</p>

        <label>
          <span>Nome completo *</span>
          <input required value={form.name} onChange={(e) => upd('name', e.target.value)} placeholder="Maria Silva" />
        </label>
        <label>
          <span>E-mail *</span>
          <input type="email" required value={form.email} onChange={(e) => upd('email', e.target.value)} placeholder="maria@secran.com.br" />
        </label>
        <label>
          <span>Senha *</span>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => upd('password', e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </label>
        <label>
          <span>Cargo</span>
          <input value={form.cargo} onChange={(e) => upd('cargo', e.target.value)} placeholder="Consultora Sênior" />
        </label>
        <label>
          <span>Telefone</span>
          <input value={form.telefone} onChange={(e) => upd('telefone', e.target.value)} placeholder="(85) 99999-0000" />
        </label>

        {error && <div className="auth-error">{error}</div>}
        {pendingMsg && (
          <div style={{ background: '#fef9ef', border: '1px solid var(--gold-300)', color: 'var(--gold-700)', padding: '12px 14px', borderRadius: 8, fontSize: 13 }}>
            ✓ {pendingMsg}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading || !!pendingMsg}>
          {loading ? 'Enviando…' : pendingMsg ? 'Solicitação enviada' : 'Solicitar acesso'}
        </button>

        <div className="auth-sep">
          Já tem conta? <Link href="/login">Entrar</Link>
        </div>
      </form>
    </div>
  );
}
