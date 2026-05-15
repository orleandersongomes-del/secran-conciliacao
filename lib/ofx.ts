// Parser OFX SGML mínimo (extrai blocos STMTTRN)
export type OfxTransaction = {
  tipo: string;
  data: string; // dd/mm/yyyy
  valor: number;
  memo: string;
  name: string;
  fitid: string;
};

export function parseOFX(text: string): OfxTransaction[] {
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

export function normalizeStr(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}
