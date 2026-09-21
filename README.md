# Agência Ímpar — Estoque & Cobrança

Sistema web com dois módulos independentes, sobre a mesma base e o mesmo login:

- **Estoque & Vendas:** produtos, vendas com baixa automática de estoque e histórico de movimentos.
- **Cobrança:** devedores, dívidas com juros configuráveis, recebimentos e uma página pública que o devedor abre por link.

Cada usuário só enxerga os próprios dados (RLS no banco).

## Tecnologia

| Camada | O que usa |
|---|---|
| Interface | React + Vite + TailwindCSS |
| Banco e API | Supabase (PostgreSQL) |
| Login | Supabase Auth (e-mail e senha) |
| Regras de negócio | Funções SQL (vendas, juros, pagamentos) |

Sistema publicado: **https://jurista-beta.vercel.app** · Guia de uso: [GUIA.md](GUIA.md)

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run dev
```

O app sobe em `http://localhost:5173`.

```bash
npm test          # testes automáticos (Vitest)
npm run build     # versão de produção
npm run lint      # análise do código
```

## Banco de dados

Os scripts ficam em `supabase/migrations`, para rodar em ordem no **SQL Editor** do Supabase:

| Arquivo | O que cria |
|---|---|
| `0001_schema_inicial.sql` | Tabelas, índices e segurança por usuário (RLS) |
| `0002_vendas.sql` | Registrar, editar e cancelar venda |
| `0003_dividas_juros.sql` | Dívidas, parcelas e cálculo de juros |
| `0004_visoes_cobranca.sql` | Visões com saldo e situação de cada dívida |
| `0005_pagamentos.sql` | Recebimentos, edição e estorno |
| `0006_area_devedor.sql` | Página pública do devedor (só leitura) |
| `0007_painel.sql` | Números do painel e produtos em alerta |
| `0008_relatorios.sql` | Lucro, produtos mais vendidos e resumo da cobrança |

Os testes do banco ficam em `supabase/tests` e rodam no mesmo SQL Editor. Cada um confere as regras
(isolamento entre usuários, estoque, juros, pagamentos e o link público) e **não deixa dados no banco**.

## Organização do código

```
src/
  app/          layout, menu e rotas
  lib/          cliente do Supabase
  modules/
    auth/       login, cadastro e recuperação de senha
    estoque/    produtos, vendas e movimentos
    cobranca/   devedores, dívidas, juros e recebimentos
    publico/    página do devedor (sem login)
    geral/      painel e formas de pagamento
  shared/       componentes, hooks e formatação (R$, datas, telefone)
```

## Planejamento

O plano de sprints e o que já foi entregue estão em [SPRINTS.md](SPRINTS.md).
