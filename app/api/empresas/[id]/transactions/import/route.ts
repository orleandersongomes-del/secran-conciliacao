import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';
import { suggestForTx } from '@/lib/suggestions';

export const runtime = 'nodejs';

type RawTx = {
  source: 'recebidas' | 'pagas' | 'ofx';
  extId?: string;
  data?: string;
  fornecedor?: string;
  descricao?: string;
  valor: number;
  categoriaOriginal?: string;
  centroCusto?: string;
  banco?: string;
  cpfCnpj?: string;
  tipo?: string;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const { transactions } = await req.json();
    if (!Array.isArray(transactions) || !transactions.length) {
      return NextResponse.json({ error: 'transactions vazias' }, { status: 400 });
    }

    const [plano, regras] = await Promise.all([
      prisma.chartAccount.findMany({ where: { empresaId: params.id } }),
      prisma.rule.findMany({ where: { empresaId: params.id }, orderBy: { createdAt: 'desc' } }),
    ]);

    const rows = (transactions as RawTx[]).map((t) => {
      const valor = Number(t.valor) || 0;
      const tipo =
        t.tipo ||
        (t.source === 'recebidas' ? 'recebimento' : t.source === 'pagas' ? 'pagamento' : valor >= 0 ? 'recebimento' : 'pagamento');
      const sug = suggestForTx(
        {
          descricao: t.descricao || '',
          fornecedor: t.fornecedor || '',
          categoriaOriginal: t.categoriaOriginal || '',
          tipo,
        },
        regras,
        plano,
      );
      return {
        empresaId: params.id,
        source: t.source,
        extId: t.extId || null,
        data: t.data || null,
        fornecedor: t.fornecedor || null,
        descricao: t.descricao || null,
        valor,
        categoriaOriginal: t.categoriaOriginal || null,
        centroCusto: t.centroCusto || null,
        banco: t.banco || null,
        cpfCnpj: t.cpfCnpj || null,
        tipo,
        status: 'pending',
        sugCategoria: sug.sugCategoria || null,
        sugFornecedor: t.fornecedor || null,
        sugCentro: t.centroCusto || null,
        sugTipo: sug.sugTipo,
        sugReason: sug.sugReason || null,
      };
    });

    await prisma.transaction.createMany({ data: rows });
    return NextResponse.json({ ok: true, imported: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
