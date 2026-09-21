-- =====================================================================
-- Agência Ímpar — Schema inicial (Sprint 1)
-- Rodar uma única vez no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.tipo_movimento as enum ('entrada', 'saida', 'ajuste');
create type public.status_venda   as enum ('ativa', 'cancelada');
create type public.tipo_divida    as enum ('a_vista', 'parcelada', 'recorrente');
create type public.status_divida  as enum ('aberta', 'parcial', 'quitada', 'cancelada');
create type public.modo_juros     as enum ('sem_juros', 'percentual_dia', 'percentual_mes', 'multa_mais_dia', 'manual');

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Token aleatório de 64 caracteres (256 bits) para o link público do devedor
create or replace function public.gerar_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Formas de pagamento (compartilhadas por vendas e recebimentos)
-- ---------------------------------------------------------------------
create table public.formas_pagamento (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create unique index formas_pagamento_nome_unico on public.formas_pagamento (user_id, lower(nome));

-- =====================================================================
-- MÓDULO ESTOQUE & VENDAS
-- =====================================================================
create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome            text not null check (length(trim(nome)) > 0),
  sku             text,
  preco_venda     numeric(12,2) not null default 0 check (preco_venda >= 0),
  preco_custo     numeric(12,2) not null default 0 check (preco_custo >= 0),
  -- estoque_atual é mantido automaticamente pelos movimentos (não editar direto)
  estoque_atual   numeric(12,3) not null default 0,
  estoque_minimo  numeric(12,3) not null default 0 check (estoque_minimo >= 0),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id)
);
create unique index produtos_sku_unico on public.produtos (user_id, lower(sku)) where sku is not null and sku <> '';
create index produtos_user_nome on public.produtos (user_id, nome);

create table public.vendas (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data                timestamptz not null default now(),
  cliente_nome        text,
  cliente_telefone    text,
  forma_pagamento_id  uuid,
  subtotal            numeric(12,2) not null default 0 check (subtotal >= 0),
  desconto            numeric(12,2) not null default 0 check (desconto >= 0),
  total               numeric(12,2) not null default 0 check (total >= 0),
  status              public.status_venda not null default 'ativa',
  observacao          text,
  cancelada_em        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id),
  foreign key (forma_pagamento_id, user_id)
    references public.formas_pagamento (id, user_id) on delete set null (forma_pagamento_id)
);
create index vendas_user_data on public.vendas (user_id, data desc);

create table public.venda_itens (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venda_id          uuid not null,
  produto_id        uuid not null,
  quantidade        numeric(12,3) not null check (quantidade > 0),
  preco_unit        numeric(12,2) not null check (preco_unit >= 0),
  -- custo no momento da venda, para o relatório de lucro não mudar se o custo do produto mudar
  preco_custo_unit  numeric(12,2) not null default 0 check (preco_custo_unit >= 0),
  subtotal          numeric(12,2) generated always as (round(quantidade * preco_unit, 2)) stored,
  created_at        timestamptz not null default now(),
  foreign key (venda_id, user_id)   references public.vendas (id, user_id) on delete cascade,
  foreign key (produto_id, user_id) references public.produtos (id, user_id) on delete restrict
);
create index venda_itens_venda on public.venda_itens (venda_id);
create index venda_itens_produto on public.venda_itens (produto_id);

create table public.movimentos_estoque (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produto_id  uuid not null,
  tipo        public.tipo_movimento not null,
  -- quantidade com sinal: positiva soma ao estoque, negativa subtrai
  quantidade  numeric(12,3) not null,
  origem      text not null default 'manual' check (origem in ('manual', 'venda', 'edicao_venda', 'cancelamento_venda')),
  venda_id    uuid,
  observacao  text,
  data        timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  check (
    (tipo = 'entrada' and quantidade > 0) or
    (tipo = 'saida'   and quantidade < 0) or
    (tipo = 'ajuste'  and quantidade <> 0)
  ),
  foreign key (produto_id, user_id) references public.produtos (id, user_id) on delete cascade,
  foreign key (venda_id, user_id)   references public.vendas (id, user_id) on delete set null (venda_id)
);
create index movimentos_produto_data on public.movimentos_estoque (produto_id, data desc);
create index movimentos_venda on public.movimentos_estoque (venda_id);

-- Mantém produtos.estoque_atual sincronizado com os movimentos (inserir, editar ou apagar)
create or replace function public.tg_movimento_atualiza_estoque()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.produtos
       set estoque_atual = estoque_atual - old.quantidade
     where id = old.produto_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update public.produtos
       set estoque_atual = estoque_atual + new.quantidade
     where id = new.produto_id;
    return new;
  end if;

  return old;
end;
$$;

create trigger movimento_atualiza_estoque
after insert or update of quantidade, produto_id or delete on public.movimentos_estoque
for each row execute function public.tg_movimento_atualiza_estoque();

-- =====================================================================
-- MÓDULO COBRANÇA
-- =====================================================================
create table public.devedores (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome                  text not null check (length(trim(nome)) > 0),
  telefone              text,
  observacao            text,           -- interna: nunca aparece na área pública
  instrucoes_pagamento  text,           -- aparece na área pública (ex.: chave Pix)
  link_token            text not null unique default public.gerar_token(),
  link_ativo            boolean not null default true,
  ativo                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, user_id)
);
create index devedores_user_nome on public.devedores (user_id, nome);

create table public.dividas (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  devedor_id          uuid not null,
  descricao           text,
  tipo                public.tipo_divida not null,
  valor_original      numeric(12,2) not null check (valor_original > 0),
  dia_pagamento       smallint check (dia_pagamento between 1 and 31),
  data_vencimento     date not null,        -- primeiro vencimento
  num_parcelas        integer check (num_parcelas > 0),
  recorrencia_ativa   boolean not null default false,
  status              public.status_divida not null default 'aberta',
  observacao          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id),
  foreign key (devedor_id, user_id) references public.devedores (id, user_id) on delete cascade,
  check (tipo <> 'parcelada' or num_parcelas is not null),
  check (tipo <> 'recorrente' or dia_pagamento is not null)
);
create index dividas_devedor on public.dividas (devedor_id);
create index dividas_user_status on public.dividas (user_id, status);

create table public.divida_juros (
  divida_id      uuid primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modo           public.modo_juros not null default 'sem_juros',
  taxa_percent   numeric(8,4) not null default 0 check (taxa_percent >= 0),
  multa_fixa     numeric(12,2) not null default 0 check (multa_fixa >= 0),
  valor_manual   numeric(12,2) not null default 0 check (valor_manual >= 0),
  carencia_dias  integer not null default 0 check (carencia_dias >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (divida_id, user_id) references public.dividas (id, user_id) on delete cascade
);

-- À vista = 1 parcela; parcelada = N parcelas; recorrente = 1 parcela por mês
create table public.parcelas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  divida_id       uuid not null,
  numero          integer not null check (numero > 0),
  valor           numeric(12,2) not null check (valor > 0),
  vencimento      date not null,
  pago            boolean not null default false,
  data_pagamento  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id),
  unique (divida_id, numero),
  foreign key (divida_id, user_id) references public.dividas (id, user_id) on delete cascade
);
create index parcelas_user_vencimento on public.parcelas (user_id, vencimento) where not pago;

create table public.pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  divida_id           uuid not null,
  parcela_id          uuid,
  forma_pagamento_id  uuid,
  data                date not null default current_date,
  valor_principal     numeric(12,2) not null default 0 check (valor_principal >= 0),
  valor_juros         numeric(12,2) not null default 0 check (valor_juros >= 0),
  valor_pago          numeric(12,2) generated always as (valor_principal + valor_juros) stored,
  observacao          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (valor_principal + valor_juros > 0),
  foreign key (divida_id, user_id)          references public.dividas (id, user_id) on delete cascade,
  foreign key (parcela_id, user_id)         references public.parcelas (id, user_id) on delete set null (parcela_id),
  foreign key (forma_pagamento_id, user_id) references public.formas_pagamento (id, user_id) on delete set null (forma_pagamento_id)
);
create index pagamentos_divida on public.pagamentos (divida_id);
create index pagamentos_user_data on public.pagamentos (user_id, data desc);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'perfis', 'formas_pagamento', 'produtos', 'vendas', 'devedores',
    'dividas', 'divida_juros', 'parcelas', 'pagamentos'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.tg_set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Segurança por linha (RLS): cada usuário só enxerga e altera o que é seu
-- ---------------------------------------------------------------------
alter table public.perfis enable row level security;

create policy "perfil proprio: ler" on public.perfis
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil proprio: alterar" on public.perfis
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'formas_pagamento', 'produtos', 'vendas', 'venda_itens', 'movimentos_estoque',
    'devedores', 'dividas', 'divida_juros', 'parcelas', 'pagamentos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono: acesso total" on public.%I
         for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Visitantes sem login não acessam nenhuma tabela diretamente
-- (a área pública do devedor usará uma função própria na Sprint 6)
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- Novo usuário: cria o perfil e as formas de pagamento padrão
-- ---------------------------------------------------------------------
create or replace function public.tg_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''));

  insert into public.formas_pagamento (user_id, nome)
  values (new.id, 'Dinheiro'), (new.id, 'Pix'), (new.id, 'Cartão');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.tg_novo_usuario();

-- Funções internas não devem ser chamadas pela API
revoke execute on function public.tg_novo_usuario() from public, anon, authenticated;
revoke execute on function public.tg_movimento_atualiza_estoque() from public, anon, authenticated;
revoke execute on function public.tg_set_updated_at() from public, anon, authenticated;
revoke execute on function public.gerar_token() from public, anon;
grant execute on function public.gerar_token() to authenticated;
