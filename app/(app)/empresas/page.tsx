'use client';
import { useEffect, useState, FormEvent } from 'react';
import { toast } from '@/components/Toast';
import { notifyRefresh, useRefreshListener } from '@/lib/refresh';

type Consultor = { id: string; name: string; cargo: string | null };
type Empresa = {
  id: string;
  nome: string;
  fantasia: string | null;
  cnpj: string | null;
  consultores: { user: { id: string; name: string } }[];
  _count: { transactions: number; plano: number; regras: number };
};

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [consultores, setConsultores] = useState<Consultor[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', fantasia: '', cnpj: '', consultorIds: [] as string[] });

  async function reload() {
    const [e, c] = await Promise.all([
      fetch('/api/empresas').then((r) => r.json()),
      fetch('/api/consultores').then((r) => r.json()),
    ]);
    setEmpresas(e.empresas || []);
    setConsultores(c.consultores || []);
  }
  useEffect(() => { reload(); }, []);
  useRefreshListener(['empresas', 'consultores', 'all'], reload);

  function openCreate() {
    setEditingId(null);
    setForm({ nome: '', fantasia: '', cnpj: '', consultorIds: [] });
    setShowForm(true);
  }
  function openEdit(e: Empresa) {
    setEditingId(e.id);
    setForm({
      nome: e.nome,
      fantasia: e.fantasia || '',
      cnpj: e.cnpj || '',
      consultorIds: e.consultores.map((c) => c.user.id),
    });
    setShowForm(true);
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const url = editingId ? `/api/empresas/${editingId}` : '/api/empresas';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Erro', 'error');
    toast(editingId ? 'Empresa atualizada' : 'Empresa cadastrada', 'success');
    setShowForm(false);
    notifyRefresh('empresas');
    reload();
  }

  async function onDelete(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}" e TODOS os dados (plano, regras, lançamentos)?`)) return;
    const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('Erro ao excluir', 'error');
    toast('Empresa excluída');
    notifyRefresh('empresas');
    reload();
  }

  function ativar(id: string) {
    localStorage.setItem('secran-empresa-ativa', id);
    window.dispatchEvent(new CustomEvent('empresa-changed', { detail: id }));
    toast('Empresa ativa', 'success');
  }

  function toggleCons(userId: string) {
    setForm((f) => ({
      ...f,
      consultorIds: f.consultorIds.includes(userId) ? f.consultorIds.filter((x) => x !== userId) : [...f.consultorIds, userId],
    }));
  }

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Empresas</h2>
          <p className="muted">Cada empresa tem plano de contas, regras e conciliação independentes.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nova empresa</button>
      </div>

      {showForm && (
        <form className="entity-form" onSubmit={onSubmit}>
          <div className="form-grid cols-2">
            <label className="full">
              <span>Razão social *</span>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </label>
            <label><span>CNPJ</span><input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></label>
            <label><span>Nome fantasia</span><input value={form.fantasia} onChange={(e) => setForm({ ...form, fantasia: e.target.value })} /></label>
            <label className="full">
              <span>Consultores responsáveis</span>
              <div className="checkboxes-stack">
                {consultores.length ? consultores.map((c) => (
                  <label key={c.id}>
                    <input type="checkbox" checked={form.consultorIds.includes(c.id)} onChange={() => toggleCons(c.id)} />
                    <span>{c.name}{c.cargo ? <em style={{ color: 'var(--gray-600)' }}> — {c.cargo}</em> : null}</span>
                  </label>
                )) : <div style={{ color: 'var(--gray-600)', fontSize: 12, padding: 6 }}>Cadastre consultores primeiro.</div>}
              </div>
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
              <th>Razão social</th><th>Fantasia</th><th>CNPJ</th><th>Consultores</th><th>Lançamentos</th><th>Plano</th><th></th>
            </tr>
          </thead>
          <tbody>
            {empresas.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>Nenhuma empresa cadastrada.</td></tr>
            )}
            {empresas.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.nome}</strong></td>
                <td>{e.fantasia || '—'}</td>
                <td>{e.cnpj || '—'}</td>
                <td>{e.consultores.length ? e.consultores.map((c) => <span key={c.user.id} className="tag-pill" style={{ marginRight: 4 }}>{c.user.name}</span>) : <span className="tag-pill muted">nenhum</span>}</td>
                <td>{e._count.transactions}</td>
                <td>{e._count.plano}</td>
                <td>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => ativar(e.id)}>Ativar</button>{' '}
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => openEdit(e)}>Editar</button>{' '}
                  <button className="row-action" onClick={() => onDelete(e.id, e.nome)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
