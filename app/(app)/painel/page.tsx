'use client';
import { useEffect, useState } from 'react';
import ImportPanel from '@/components/ImportPanel';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { useRefreshListener } from '@/lib/refresh';

type Summary = {
  empresas: number;
  consultores: number;
  pendentes: number;
  aprovados: number;
  planoCount: number;
  empresaNome: string;
};

export default function PainelPage() {
  const empresaAtivaId = useEmpresaAtiva();
  const [sum, setSum] = useState<Summary>({ empresas: 0, consultores: 0, pendentes: 0, aprovados: 0, planoCount: 0, empresaNome: '' });

  async function loadSummary() {
    const [empresasRes, consRes] = await Promise.all([
      fetch('/api/empresas').then((r) => r.json()),
      fetch('/api/consultores').then((r) => r.json()),
    ]);
    let pendentes = 0,
      aprovados = 0,
      planoCount = 0,
      empresaNome = '';
    if (empresaAtivaId) {
      const ativaRes = await fetch(`/api/empresas/${empresaAtivaId}`).then((r) => r.json());
      const ativa = ativaRes.empresa;
      if (ativa) {
        planoCount = ativa._count.plano;
        empresaNome = ativa.fantasia || ativa.nome;
        const [pendRes, apvRes] = await Promise.all([
          fetch(`/api/empresas/${empresaAtivaId}/transactions?status=pending`).then((r) => r.json()),
          fetch(`/api/empresas/${empresaAtivaId}/transactions?status=approved`).then((r) => r.json()),
        ]);
        pendentes = pendRes.transactions?.length || 0;
        aprovados = apvRes.transactions?.length || 0;
      }
    }
    setSum({
      empresas: empresasRes.empresas?.length || 0,
      consultores: consRes.consultores?.length || 0,
      pendentes,
      aprovados,
      planoCount,
      empresaNome,
    });
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtivaId]);
  useRefreshListener(['empresas', 'consultores', 'plano', 'transactions', 'dados', 'all'], loadSummary);

  return (
    <>
      {!empresaAtivaId && sum.empresas === 0 && (
        <div className="empty-banner">
          <h3>Comece cadastrando uma empresa</h3>
          <p>Vá em "Empresas" no menu superior e clique em "+ Nova empresa". Cada empresa tem plano de contas, regras e conciliação independentes.</p>
        </div>
      )}
      {!empresaAtivaId && sum.empresas > 0 && (
        <div className="empty-banner">
          <h3>Selecione uma empresa</h3>
          <p>Use o seletor no topo da página para escolher com qual empresa trabalhar.</p>
        </div>
      )}

      <div className="hero">
        <h1>Painel · {sum.empresaNome || 'Selecione uma empresa'}</h1>
        <p>Importe relatórios e plano de contas, ou baixe os modelos abaixo.</p>
      </div>

      <ImportPanel empresaAtivaId={empresaAtivaId} hasPlano={sum.planoCount > 0} />

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Empresas</div>
          <div className="kpi-value">{sum.empresas}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Consultores</div>
          <div className="kpi-value">{sum.consultores}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pendentes</div>
          <div className="kpi-value">{sum.pendentes}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Aprovados</div>
          <div className="kpi-value">{sum.aprovados}</div>
        </div>
      </div>
    </>
  );
}
