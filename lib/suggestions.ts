import type { Rule, ChartAccount } from '@prisma/client';
import { normalizeStr } from './ofx';

export type TxLike = {
  descricao: string | null;
  fornecedor: string | null;
  categoriaOriginal: string | null;
  tipo: string;
};

export type Suggestion = {
  sugCategoria: string;
  sugReason: string;
  sugTipo: string;
};

const fieldMap: Record<string, keyof TxLike> = {
  descricao: 'descricao',
  nome: 'fornecedor',
  categoriaOriginal: 'categoriaOriginal',
};

function findCategoriaInPlano(needle: string, plano: ChartAccount[]): string {
  const n = normalizeStr(needle);
  if (!n) return '';
  const exact = plano.find((p) => normalizeStr(p.categoria) === n);
  if (exact) return exact.categoria;
  const inc = plano.find(
    (p) => n.includes(normalizeStr(p.categoria)) || normalizeStr(p.categoria).includes(n),
  );
  return inc ? inc.categoria : '';
}

export function suggestForTx(tx: TxLike, regras: Rule[], plano: ChartAccount[]): Suggestion {
  let sugCategoria = '';
  let sugReason = '';
  let sugTipo = tx.tipo;

  for (const r of regras) {
    const prop = fieldMap[r.field] || (r.field as keyof TxLike);
    const target = normalizeStr(tx[prop] || '');
    if (target && target.includes(normalizeStr(r.keyword))) {
      sugCategoria = r.categoria;
      sugReason = `Regra: "${r.keyword}" em ${
        ({ descricao: 'descrição', nome: 'nome', categoriaOriginal: 'categoria do relatório' } as Record<string, string>)[
          r.field
        ] || r.field
      }`;
      if (r.tipo) sugTipo = r.tipo;
      break;
    }
  }

  if (!sugCategoria && tx.categoriaOriginal) {
    const head = tx.categoriaOriginal.split('/')[0].trim();
    const m = findCategoriaInPlano(head, plano);
    if (m) {
      sugCategoria = m;
      sugReason = 'Casado pela categoria do relatório';
    }
  }

  return { sugCategoria, sugReason, sugTipo };
}
