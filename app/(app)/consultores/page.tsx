'use client';
import { useEffect, useState, FormEvent } from 'react';
import { toast } from '@/components/Toast';

type Consultor = {
  id: string;
  email: string;
  name: string;
  cargo: string | null;
  telefone: string | null;
  isAdmin: boolean;
  empresasMembro: { empresa: { nome: string; fantasia: string | null } }[];
};

export default function ConsultoresPage() {
  const [consultores, setConsultores] = useState<Consultor[]>([]);
  const [me, setMe] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', cargo: '', telefone: '' });

  async function reload() {
    const [c, m] = await Promise.all([
      fetch('/api/consultores').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ]);
    setConsultores(c.consultores || []);
    setMe(m.user);
  }
  useEffect(() => { reload(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ name: '', email: '', password: '', cargo: '', telefone: '' });
    setShowForm(true);
  }
  function openEdit(c: Consultor) {
    setEditingId(c.id);
    setForm({ name: c.name, email: c.email, password: '', cargo: c.cargo || '', telefone: c.telefone || '' });
    setShowForm(true);
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const url = editingId ? `/api/consultores/${editingId}` : '/api/consultores';
    const method = editingId ? 'PATCH' : 'POST';
    const payload: any = { name: form.name, cargo: form.cargo, telefone: form.telefone };
    if (!editingId) { payload.email = form.email; payload.password = form.password; }
    else if (form.password) payload.password = form.password;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Erro', 'error');
    toast(editingId ? 'Consultor atualizado' : 'Consultor cadastrado', 'success');
    setShowForm(false);
    reload();
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    const res = await fetch(`/api/consultores/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Erro ao excluir', 'error');
    toast('Consultor excluído');
    reload();
  }

  const podeAdicionar = me?.isAdmin;

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Consultores</h2>
          <p className="muted">{podeAdicionar ? 'Vincule consultores às empresas para controlar quem responde por cada conta.' : 'Apenas administradores podem cadastrar novos consultores.'}</p>
        </div>
        {podeAdicionar && <button className="btn btn-primary" onClick={openCreate}>+ Novo consultor</button>}
      </div>

      {showForm && (
        <form className="entity-form" onSubmit={onSubmit}>
          <div className="form-grid cols-3">
            <label className="full">
              <span>Nome *</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              <span>E-mail {editingId ? '(não editável)' : '*'}</span>
              <input type="email" required={!editingId} disabled={!!editingId} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              <span>Senha {editingId ? '(deixe vazio pra manter)' : '*'}</span>
              <input type="password" required={!editingId} minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <label>
              <span>Cargo</span>
              <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </label>
            <label>
              <span>Telefone</span>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </label>
          </div>
          <div className="row-gap">
            <button type="submit" className="btn btn-primary">Salvar</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>Telefone</th><th>Cargo</th><th>Empresas vinculadas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {consultores.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>Nenhum consultor cadastrado.</td></tr>
            )}
            {consultores.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong>{c.isAdmin && <span className="tag-pill" style={{ marginLeft: 6 }}>admin</span>}</td>
                <td>{c.email}</td>
                <td>{c.telefone || '—'}</td>
                <td>{c.cargo || '—'}</td>
                <td>{c.empresasMembro.length ? c.empresasMembro.map((e, i) => <span key={i} className="tag-pill" style={{ marginRight: 4 }}>{e.empresa.fantasia || e.empresa.nome}</span>) : <span className="tag-pill muted">nenhuma</span>}</td>
                <td>
                  {(me?.isAdmin || me?.id === c.id) && <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => openEdit(c)}>Editar</button>}{' '}
                  {me?.isAdmin && me.id !== c.id && <button className="row-action" onClick={() => onDelete(c.id, c.name)}>×</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
