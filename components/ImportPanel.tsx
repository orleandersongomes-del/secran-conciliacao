'use client';
import { useState } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { notifyRefresh } from '@/lib/refresh';
import { toast } from './Toast';
import * as XLSX from 'xlsx';

const TPL_PLANO = [
  { Grupo: 'Receitas operacionais', Categoria: 'Receita com serviços', Subgrupo: 1, 'nivel 1': '(+) Receitas operacionais', KEY: 1, Tipo: 'Entrada' },
  { Grupo: 'Receitas operacionais', Categoria: 'Multas Recebidas', Subgrupo: 2, 'nivel 1': '(+) Receitas operacionais', KEY: 1, Tipo: 'Entrada' },
  { Grupo: 'Custos operacionais', Categoria: 'Salários, encargos e benefícios', Subgrupo: 16, 'nivel 1': '(-) Despesas com Pessoal', KEY: 5, Tipo: 'Saída' },
  { Grupo: 'Despesas operacionais e outras receitas', Categoria: 'Telefone e Internet', Subgrupo: 27, 'nivel 1': '(-) Despesas de Ocupação', KEY: 7, Tipo: 'Saída' },
  { Grupo: 'Despesas operacionais e outras receitas', Categoria: 'Tarifa bancária', Subgrupo: 26, 'nivel 1': '(-/-) Resultado Financeiro', KEY: 10, Tipo: 'Saída' },
];
const TPL_RECEBIDAS = [{ Id: 1, Vencimento: '01/04/2026', Competência: '01/04/2026', 'Previsto para': '01/04/2026', 'Data de pagamento': '01/04/2026', 'CPF/CNPJ': '', Nome: 'EXEMPLO CLIENTE LTDA', 'Descrição': 'Pix recebido referente serviço prestado', 'Referência': '', Categoria: 'Receita com serviços / Service Revenue', Detalhamento: '', 'Centro de Custo': 'OPERAÇÃO', 'Valor categoria/centro de custo': 1500.0, Identificador: 'Sem identificador', Banco: 'Banco C6', 'Número NFS-e': '' }];
const TPL_PAGAS = [{ Id: 1, Vencimento: '01/04/2026', Competência: '01/04/2026', 'Previsto para': '01/04/2026', 'Data de pagamento': '01/04/2026', 'CPF/CNPJ': '', Nome: 'CLARO S.A', 'Descrição': 'Internet fibra empresarial', 'Referência': '', Categoria: 'Telefone e Internet / Telecommunications Expense', Detalhamento: '', 'Centro de Custo': 'OPERAÇÃO', 'Valor categoria/centro de custo': -249.9, Identificador: 'Sem identificador', Banco: 'Banco C6' }];

function downloadModelo(kind: 'plano' | 'recebidas' | 'pagas') {
  const map = {
    plano: { rows: TPL_PLANO, name: 'modelo_plano_de_contas.xlsx' },
    recebidas: { rows: TPL_RECEBIDAS, name: 'modelo_contas_recebidas.xlsx' },
    pagas: { rows: TPL_PAGAS, name: 'modelo_contas_pagas.xlsx' },
  };
  const { rows, name } = map[kind];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  XLSX.writeFile(wb, name);
  toast('Modelo baixado: ' + name, 'success');
}

function parseDateExcel(v: any): string {
  if (!v) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
  }
  return String(v);
}

function readSheet(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'array' });
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }));
      } catch (err) {
        reject(err);
      }
    };
    r.onerror = () => reject(new Error('Falha ao ler'));
    r.readAsArrayBuffer(file);
  });
}
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target!.result as string);
    r.onerror = () => reject(new Error('Falha ao ler OFX'));
    r.readAsText(file, 'ISO-8859-1');
  });
}

function parseOFX(text: string) {
  const body = text.replace(/^[\s\S]*?<OFX>/i, '<OFX>');
  const blocks = body.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const get = (b: string, tag: string) => {
    const m = b.match(new RegExp('<' + tag + '>([^<\\r\\n]+)', 'i'));
    return m ? m[1].trim() : '';
  };
  return blocks.map((b) => {
    const dt = get(b, 'DTPOSTED').slice(0, 8);
    const data = dt.length >= 8 ? `${dt.slice(6, 8)}/${dt.slice(4, 6)}/${dt.slice(0, 4)}` : '';
    return {
      tipo: get(b, 'TRNTYPE'),
      data,
      valor: Number(get(b, 'TRNAMT').replace(',', '.')) || 0,
      memo: get(b, 'MEMO'),
      name: get(b, 'NAME'),
      fitid: get(b, 'FITID'),
    };
  });
}

export default function ImportPanel({
  empresaAtivaId,
  hasPlano,
}: {
  empresaAtivaId: string;
  hasPlano: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function handlePlano(file: File) {
    if (!empresaAtivaId) return toast('Selecione uma empresa', 'error');
    setBusy(true);
    try {
      const rows = await readSheet(file);
      const plano = rows.map((r: any) => ({
        grupo: r['Grupo'] || '',
        categoria: r['Categoria'] || '',
        subgrupo: r['Subgrupo'] || '',
        nivel1: r['nivel 1'] || r['Nível 1'] || r['nível 1'] || '',
        key: r['KEY'] || r['Key'] || '',
        tipo: r['Tipo'] || 'Saída',
      })).filter((p) => p.categoria);
      const res = await fetch(`/api/empresas/${empresaAtivaId}/plano`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, mode: 'replace' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Plano: ${data.plano.length} categorias importadas`, 'success');
      notifyRefresh('plano', 'transactions', 'dados');
    } catch (e: any) {
      toast('Erro: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRelatorio(file: File, source: 'recebidas' | 'pagas') {
    if (!empresaAtivaId) return toast('Selecione uma empresa', 'error');
    setBusy(true);
    try {
      const rows = await readSheet(file);
      const transactions = rows.map((r: any, idx: number) => ({
        source,
        extId: String(r['Id'] || r['Identificador'] || `${source}-${idx}`),
        data: parseDateExcel(r['Data de pagamento'] || r['Vencimento'] || r['Competência']),
        fornecedor: String(r['Nome'] || ''),
        descricao: String(r['Descrição'] || r['Descricao'] || ''),
        valor: Number(r['Valor categoria/centro de custo'] ?? r['Valor'] ?? 0) || 0,
        categoriaOriginal: String(r['Categoria'] || ''),
        centroCusto: String(r['Centro de Custo'] || ''),
        banco: String(r['Banco'] || ''),
        cpfCnpj: String(r['CPF/CNPJ'] || ''),
        tipo: source === 'recebidas' ? 'recebimento' : 'pagamento',
      }));
      const res = await fetch(`/api/empresas/${empresaAtivaId}/transactions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${source}: ${data.imported} lançamentos`, 'success');
      notifyRefresh('plano', 'transactions', 'dados');
    } catch (e: any) {
      toast('Erro: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleOFX(file: File) {
    if (!empresaAtivaId) return toast('Selecione uma empresa', 'error');
    setBusy(true);
    try {
      const text = await readText(file);
      const parsed = parseOFX(text);
      if (!parsed.length) throw new Error('OFX vazio ou inválido');
      const transactions = parsed.map((p, idx) => ({
        source: 'ofx',
        extId: p.fitid || `ofx-${idx}`,
        data: p.data,
        fornecedor: p.name || '',
        descricao: p.memo || p.name || '',
        valor: p.valor,
        categoriaOriginal: '',
        centroCusto: '',
        banco: '',
        cpfCnpj: '',
        tipo: p.valor >= 0 ? 'recebimento' : 'pagamento',
      }));
      const res = await fetch(`/api/empresas/${empresaAtivaId}/transactions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`OFX: ${data.imported} lançamentos`, 'success');
      notifyRefresh('plano', 'transactions', 'dados');
    } catch (e: any) {
      toast('Erro: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid-3">
        <div className="card">
          <div className="card-icon">▦</div>
          <h3>Plano de Contas</h3>
          <p>Defina grupos, categorias e tipos. Base da conciliação por empresa.</p>
          <div className="card-actions">
            <button className="btn btn-ghost" onClick={() => downloadModelo('plano')}>Modelo</button>
            <label className="btn btn-primary">
              Importar
              <input type="file" hidden accept=".xlsx,.xls" disabled={busy} onChange={(e) => e.target.files?.[0] && handlePlano(e.target.files[0])} />
            </label>
          </div>
          <div className={`card-status ${hasPlano ? 'ok' : ''}`}>{hasPlano ? '✓ Plano carregado' : '— nenhum carregado —'}</div>
        </div>

        <div className="card">
          <div className="card-icon">▼</div>
          <h3>Contas Recebidas</h3>
          <p>Relatório de entradas. Modelo padrão Nibo/Secran.</p>
          <div className="card-actions">
            <button className="btn btn-ghost" onClick={() => downloadModelo('recebidas')}>Modelo</button>
            <label className="btn btn-primary">
              Importar
              <input type="file" hidden accept=".xlsx,.xls" disabled={busy} onChange={(e) => e.target.files?.[0] && handleRelatorio(e.target.files[0], 'recebidas')} />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">▲</div>
          <h3>Contas Pagas</h3>
          <p>Relatório de saídas. Modelo padrão Nibo/Secran.</p>
          <div className="card-actions">
            <button className="btn btn-ghost" onClick={() => downloadModelo('pagas')}>Modelo</button>
            <label className="btn btn-primary">
              Importar
              <input type="file" hidden accept=".xlsx,.xls" disabled={busy} onChange={(e) => e.target.files?.[0] && handleRelatorio(e.target.files[0], 'pagas')} />
            </label>
          </div>
        </div>
      </div>

      <div className="card alt">
        <div className="row-between">
          <div>
            <h3>Sem relatório? Importe o OFX do banco</h3>
            <p>Cada lançamento será conciliado individualmente.</p>
          </div>
          <label className="btn btn-secondary">
            Importar OFX
            <input type="file" hidden accept=".ofx,.OFX" disabled={busy} onChange={(e) => e.target.files?.[0] && handleOFX(e.target.files[0])} />
          </label>
        </div>
      </div>
    </>
  );
}
