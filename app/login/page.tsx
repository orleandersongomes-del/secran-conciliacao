'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Erro no login');
      return;
    }
    router.push('/painel');
    router.refresh();
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <img src="/assets/logo.png" alt="Secran Gestão" className="auth-logo" />
        <h1>Entrar</h1>
        <p className="muted">Conciliação Financeira · Secran Gestão</p>

        <label>
          <span>E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@secran.com.br"
            autoComplete="email"
          />
        </label>
        <label>
          <span>Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="auth-sep">
          Primeiro acesso? <Link href="/signup">Criar conta</Link>
        </div>
      </form>
    </div>
  );
}
