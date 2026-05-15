# Secran Gestão · Conciliação Financeira

Sistema web de conciliação financeira para a Secran Gestão, com identidade visual oficial e suporte multi-empresa.

## Funcionalidades

- **Cadastro de empresas** com vínculo de consultores
- **Cadastro de consultores** com cargo, e-mail e telefone
- **Plano de contas por empresa** (import via xlsx ou cadastro manual)
- **Regras de conciliação por empresa** (palavra-chave em descrição, fornecedor ou categoria do relatório)
- **Importação de relatórios** xlsx Nibo/Secran (contas pagas e recebidas) ou OFX bancário
- **Sugestões automáticas** baseadas em regras e categoria do relatório
- **Aprovação individual ou em lote** com filtros por status, fonte e busca
- **Histórico exportável** em xlsx por empresa

## Stack atual (v1 · client-side)

- Vanilla HTML + CSS + JavaScript
- [SheetJS](https://sheetjs.com/) via CDN para parsing/escrita de xlsx
- Parser OFX SGML inline
- Persistência via `localStorage`
- Identidade visual Secran (dourado `#BA7211` + carbono `#212123`)
- Fontes Montserrat + Outfit (Google Fonts)

## Rodando localmente

Basta abrir `index.html` no Chrome. Ou subir um servidor estático:

```bash
npx http-server -p 8080
```

Acesse `http://localhost:8080`.

## Estrutura

```
secran-conciliacao/
├── index.html         # Layout + 7 abas: Painel, Empresas, Consultores, Plano, Regras, Conciliar, Histórico
├── styles.css         # Identidade visual Secran
├── app.js             # Estado multi-empresa, parsers, sugestões, conciliação
└── assets/
    ├── logo.png       # Logo Secran transparente
    ├── logo-mark.svg  # Fallback SVG (símbolo)
    └── logo-full.svg  # Fallback SVG (símbolo + texto)
```

## Próximos passos (v2 · online)

- [ ] Migrar para Next.js 14 (App Router) + TypeScript
- [ ] Prisma + Postgres (Vercel Postgres)
- [ ] Auth e-mail/senha (bcrypt + JWT)
- [ ] API routes escopadas por empresa e consultor
- [ ] Deploy na Vercel
- [ ] Compartilhamento de dados entre consultores

## Templates xlsx aceitos

- **Plano de Contas**: `Grupo | Categoria | Subgrupo | nivel 1 | KEY | Tipo`
- **Contas Recebidas**: `Id | Vencimento | Competência | Previsto para | Data de pagamento | CPF/CNPJ | Nome | Descrição | Referência | Categoria | Detalhamento | Centro de Custo | Valor categoria/centro de custo | Identificador | Banco | Número NFS-e`
- **Contas Pagas**: idem ao recebidas, sem `Número NFS-e`

Os templates ficam disponíveis no botão "Modelo" de cada cartão no Painel.
