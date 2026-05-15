# Secran Gestão · Conciliação Financeira

Aplicação web multi-usuário para conciliação financeira da Secran Gestão. Cada consultor faz login, gerencia múltiplas empresas e cada empresa tem seu próprio plano de contas, regras e histórico de conciliações.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma ORM** + **PostgreSQL** (Vercel Postgres / Neon)
- Auth e-mail/senha (**bcrypt** + **JWT** em cookie httpOnly via **jose**)
- **SheetJS** (`xlsx`) para parsing/escrita de planilhas
- Parser OFX SGML inline
- Identidade visual oficial: dourado `#BA7211` + carbono `#212123` + Montserrat/Outfit
- Deploy: **Vercel**

## Rodando localmente

```bash
npm install
cp .env.example .env
# preencha DATABASE_URL e JWT_SECRET no .env
npm run db:push    # cria as tabelas no banco
npm run dev        # http://localhost:3000
```

## Variáveis de ambiente

```env
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
JWT_SECRET="32+ caracteres aleatórios"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Gere um JWT_SECRET seguro com `openssl rand -base64 32`.

## Schema

- **User**: consultor (login). Primeiro cadastro vira admin.
- **Empresa**: cliente da Secran. Tem um `owner` (User) e vários `consultores` vinculados.
- **EmpresaConsultor**: tabela de junção User × Empresa.
- **ChartAccount**: plano de contas escopado por empresa.
- **Rule**: regras de conciliação escopadas por empresa.
- **Transaction**: lançamentos importados (xlsx/OFX) com sugestões e workflow `pending → approved/rejected`.

## Rotas

| Página | Acesso |
|---|---|
| `/login`, `/signup` | público |
| `/painel` | usuário logado |
| `/empresas`, `/consultores` | usuário logado (cadastros) |
| `/plano`, `/regras`, `/conciliar`, `/historico` | logado + empresa ativa |

## API

| Rota | Método | Função |
|---|---|---|
| `/api/auth/login` | POST | Login |
| `/api/auth/signup` | POST | Cadastro (1º é admin) |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Sessão atual |
| `/api/empresas` | GET/POST | Lista/cria empresas |
| `/api/empresas/[id]` | GET/PATCH/DELETE | CRUD empresa |
| `/api/empresas/[id]/plano` | GET/POST/PATCH | Plano (POST substitui tudo no import) |
| `/api/empresas/[id]/plano/[entryId]` | PATCH/DELETE | Linha do plano |
| `/api/empresas/[id]/regras` | GET/POST | Regras |
| `/api/empresas/[id]/regras/[ruleId]` | DELETE | Remove regra |
| `/api/empresas/[id]/transactions` | GET | Lista (filtros: status, source, q) |
| `/api/empresas/[id]/transactions/import` | POST | Importa lote |
| `/api/empresas/[id]/transactions/[txId]` | PATCH | Atualiza/aprova/rejeita 1 |
| `/api/empresas/[id]/transactions/batch` | POST | Aprova/rejeita em lote |
| `/api/consultores` | GET/POST | Lista/cria consultores (POST: só admin) |
| `/api/consultores/[id]` | PATCH/DELETE | Editar/excluir |

## Templates xlsx aceitos

- **Plano**: `Grupo | Categoria | Subgrupo | nivel 1 | KEY | Tipo`
- **Recebidas**: `Id | Vencimento | Competência | Previsto para | Data de pagamento | CPF/CNPJ | Nome | Descrição | Referência | Categoria | Detalhamento | Centro de Custo | Valor categoria/centro de custo | Identificador | Banco | Número NFS-e`
- **Pagas**: igual a recebidas, sem `Número NFS-e`

Templates disponíveis no botão "Modelo" de cada cartão no Painel.
