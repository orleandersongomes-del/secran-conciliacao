'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { toast } from '@/components/Toast';

type Rule = { id: string; field: string; keyword: string; categoria: string; tipo: string | null };
type Cat = { id: string; categoria: string };

export default function RegrasPage() {
  const empresaId = useEmpresaAtiva();
  const [regras, setRegras] = useState<Rule[]>([]);
  const [plano, setPlano] = useState<Cat[]>([]);
  const [empresaNome, setEmpresaNome] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ field: 'descricao', keyword: '', categoria: '', tipo: '' });

  async function reload() {
    if (!empresaId) return;
    const [r, p, e] = await Promise.all([
      fetch(`/api/empresas/${empresaId}/regras`).then((r) => r.json()),
      fetch(`/api/empresas/${empresaId}/plano`).then((r) => r.json()),
      fetch(`/api/empresas/${empresaId}`).then((r) => r.json()),
    ]);
    setRegras(r.regras || []);
    setPlano(p.plano || []);
    setEmpresaNome(e.empresa?.fantasia || e.empresa?.nome || '');
    if (p.plano?.length && !form.categoria) setForm((f) => ({ ...f, categoria: p.plano[0].categoria }));
  }
  useEffect(() => { reload(); }, [empresaId]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!form.keyword.trim() || !form.categoria) return toast('Preencha palavra e categoria', 'error');
    const res = await fetch(`/api/empresas/${empresaId}/regras`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Erro', 'error');
    toast('Regra criada', 'success');
    setShowForm(false);
    setForm({ field: 'descricao', keyword: '', categoria: plano[0]?.categoria || '', tipo: '' });
    reload();
  }

  async function del(id: string) {
    const res = await fetch(`/api/empresas/${empresaId}/regras/${id}`, { method: 'DELETE' });
    if (res.ok) reload();
  }

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa.</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Regras de conciliação <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">Vincule palavras-chave a uma categoria. Aplicam-se apenas a esta empresa.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { if (!plano.length) return toast('Importe o plano primeiro', 'error'); setShowForm(true); }}>+ Nova regra</button>
      </div>

      {showForm && (
        <form className="entity-form" onSubmit={onSubmit}>
          <div className="form-grid cols-4">
            <label>
              <span>Quando o campo</span>
              <select value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                <option value="descricao">Descrição</option>
                <option value="nome">Nome / Fornecedor</option>
                <option value="categoriaOriginal">Categoria do relatório</option>
              </select>
            </label>
            <label>
              <span>Contiver</span>
              <input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="ex.: internet" />
            </label>
            <label>
              <span>Alocar na categoria</span>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {plano.map((p) => <option key={p.id} value={p.categoria}>{p.categoria}</option>)}
              </select>
            </label>
            <label>
              <span>Tipo sugerido</span>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="">— automático —</option>
                <option value="recebimento">Recebimento</option>
                <option value="pagamento">Pagamento</option>
                <option value="transferencia">Transferência</option>
              </select>
            </label>
          </div>
          <div className="row-gap">
            <button className="btn btn-primary" type="submit">Salvar</button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Campo</th><th>Palavra-chave</th><th>Categoria</th><th>Tipo</th><th></th></tr></thead>
          <tbody>
            {regras.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>Nenhuma regra cadastrada.</td></tr>}
            {regras.map((r) => (
              <tr key={r.id}>
                <td>{({ descricao: 'Descrição', nome: 'Nome / Fornecedor', categoriaOriginal: 'Categoria do relatório' } as any)[r.field] || r.field}</td>
                <td><strong>{r.keyword}</strong></td>
                <td>{r.categoria}</td>
                <td>{r.tipo || '—'}</td>
                <td><button className="row-action" onClick={() => del(r.id)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
