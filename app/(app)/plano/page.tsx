'use client';
import { useEffect, useState } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { toast } from '@/components/Toast';
import { notifyRefresh, useRefreshListener } from '@/lib/refresh';

type Entry = { id: string; grupo: string; categoria: string; subgrupo: string | null; nivel1: string | null; chaveKey: string | null; tipo: string };

export default function PlanoPage() {
  const empresaId = useEmpresaAtiva();
  const [plano, setPlano] = useState<Entry[]>([]);
  const [empresaNome, setEmpresaNome] = useState('');

  async function reload() {
    if (!empresaId) return;
    const [p, e] = await Promise.all([
      fetch(`/api/empresas/${empresaId}/plano`).then((r) => r.json()),
      fetch(`/api/empresas/${empresaId}`).then((r) => r.json()),
    ]);
    setPlano(p.plano || []);
    setEmpresaNome(e.empresa?.fantasia || e.empresa?.nome || '');
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [empresaId]);
  useRefreshListener(['plano', 'dados', 'all'], reload);

  async function add() {
    const res = await fetch(`/api/empresas/${empresaId}/plano`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupo: '', categoria: 'Nova categoria', tipo: 'Saída' }),
    });
    if (res.ok) { notifyRefresh('plano'); reload(); }
  }

  async function update(entry: Entry, field: keyof Entry, value: string) {
    setPlano((arr) => arr.map((p) => (p.id === entry.id ? { ...p, [field]: value } : p)));
    const payload: any = {};
    if (field === 'chaveKey') payload.key = value;
    else payload[field] = value;
    await fetch(`/api/empresas/${empresaId}/plano/${entry.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
  }

  async function del(id: string, cat: string) {
    if (!confirm(`Excluir "${cat}"?`)) return;
    const res = await fetch(`/api/empresas/${empresaId}/plano/${id}`, { method: 'DELETE' });
    if (res.ok) { notifyRefresh('plano'); reload(); toast('Excluído'); }
  }

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa no topo.</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Plano de Contas <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">As categorias aqui alimentam toda a conciliação desta empresa.</p>
        </div>
        <button className="btn btn-secondary" onClick={add}>+ Nova categoria</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Grupo</th><th>Categoria</th><th>Subgrupo</th><th>Nível 1</th><th>KEY</th><th>Tipo</th><th></th></tr>
          </thead>
          <tbody>
            {plano.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>Nenhuma categoria. Importe via planilha no Painel ou clique em "+ Nova categoria".</td></tr>}
            {plano.map((p) => (
              <tr key={p.id}>
                <td><input className="cell" defaultValue={p.grupo} onBlur={(e) => update(p, 'grupo', e.target.value)} /></td>
                <td><input className="cell" defaultValue={p.categoria} onBlur={(e) => update(p, 'categoria', e.target.value)} /></td>
                <td><input className="cell" defaultValue={p.subgrupo || ''} onBlur={(e) => update(p, 'subgrupo', e.target.value)} style={{ maxWidth: 80 }} /></td>
                <td><input className="cell" defaultValue={p.nivel1 || ''} onBlur={(e) => update(p, 'nivel1', e.target.value)} /></td>
                <td><input className="cell" defaultValue={p.chaveKey || ''} onBlur={(e) => update(p, 'chaveKey', e.target.value)} style={{ maxWidth: 60 }} /></td>
                <td>
                  <select className="cell" defaultValue={p.tipo} onChange={(e) => update(p, 'tipo', e.target.value)}>
                    <option>Entrada</option><option>Saída</option>
                  </select>
                </td>
                <td><button className="row-action" onClick={() => del(p.id, p.categoria)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
