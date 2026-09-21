-- =====================================================================
-- Agência Ímpar — Vendas (Sprint 3)
-- Funções que registram, editam e cancelam vendas dando baixa no estoque.
-- Tudo dentro de uma transação: ou grava inteiro, ou não grava nada.
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

-- Itens chegam como JSON: [{"produto_id": "...", "quantidade": 2, "preco_unit": 10.50}]
create or replace function public.aplicar_itens_venda(p_venda_id uuid, p_itens jsonb, p_origem text)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  item        jsonb;
  v_produto   public.produtos%rowtype;
  v_qtd       numeric(12,3);
  v_preco     numeric(12,2);
  v_subtotal  numeric(12,2) := 0;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Inclua pelo menos um produto na venda.' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(p_itens) loop
    v_qtd   := (item ->> 'quantidade')::numeric;
    v_preco := (item ->> 'preco_unit')::numeric;

    if v_qtd is null or v_qtd <= 0 then
      raise exception 'A quantidade precisa ser maior que zero.' using errcode = 'P0001';
    end if;
    if v_preco is null or v_preco < 0 then
      raise exception 'O preço não pode ser negativo.' using errcode = 'P0001';
    end if;

    -- O RLS garante que só produtos do próprio usuário aparecem aqui
    select * into v_produto from public.produtos where id = (item ->> 'produto_id')::uuid;
    if not found then
      raise exception 'Produto não encontrado.' using errcode = 'P0001';
    end if;

    insert into public.venda_itens (venda_id, produto_id, quantidade, preco_unit, preco_custo_unit)
    values (p_venda_id, v_produto.id, v_qtd, v_preco, v_produto.preco_custo);

    -- Baixa no estoque (quantidade negativa); o estoque do produto é atualizado por trigger
    insert into public.movimentos_estoque (produto_id, tipo, quantidade, origem, venda_id)
    values (v_produto.id, 'saida', -v_qtd, p_origem, p_venda_id);

    v_subtotal := v_subtotal + round(v_qtd * v_preco, 2);
  end loop;

  return v_subtotal;
end;
$$;

-- ---------------------------------------------------------------------
create or replace function public.registrar_venda(
  p_itens               jsonb,
  p_data                timestamptz default now(),
  p_cliente_nome        text default null,
  p_cliente_telefone    text default null,
  p_forma_pagamento_id  uuid default null,
  p_desconto            numeric default 0,
  p_observacao          text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_venda_id  uuid;
  v_subtotal  numeric(12,2);
  v_desconto  numeric(12,2) := coalesce(p_desconto, 0);
begin
  if auth.uid() is null then
    raise exception 'Faça login para registrar vendas.' using errcode = '42501';
  end if;

  insert into public.vendas (data, cliente_nome, cliente_telefone, forma_pagamento_id, desconto, observacao)
  values (coalesce(p_data, now()), nullif(trim(p_cliente_nome), ''), nullif(trim(p_cliente_telefone), ''),
          p_forma_pagamento_id, v_desconto, nullif(trim(p_observacao), ''))
  returning id into v_venda_id;

  v_subtotal := public.aplicar_itens_venda(v_venda_id, p_itens, 'venda');

  if v_desconto > v_subtotal then
    raise exception 'O desconto não pode ser maior que o total dos produtos.' using errcode = 'P0001';
  end if;

  update public.vendas
     set subtotal = v_subtotal,
         total    = v_subtotal - v_desconto
   where id = v_venda_id;

  return v_venda_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Editar troca os itens antigos pelos novos e o estoque se acerta sozinho:
-- apagar os movimentos antigos devolve as quantidades, e os novos dão baixa de novo.
create or replace function public.editar_venda(
  p_venda_id            uuid,
  p_itens               jsonb,
  p_data                timestamptz default null,
  p_cliente_nome        text default null,
  p_cliente_telefone    text default null,
  p_forma_pagamento_id  uuid default null,
  p_desconto            numeric default 0,
  p_observacao          text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_venda     public.vendas%rowtype;
  v_subtotal  numeric(12,2);
  v_desconto  numeric(12,2) := coalesce(p_desconto, 0);
begin
  select * into v_venda from public.vendas where id = p_venda_id;
  if not found then
    raise exception 'Venda não encontrada.' using errcode = 'P0001';
  end if;
  if v_venda.status = 'cancelada' then
    raise exception 'Esta venda está cancelada e não pode ser editada.' using errcode = 'P0001';
  end if;

  delete from public.movimentos_estoque where venda_id = p_venda_id;
  delete from public.venda_itens where venda_id = p_venda_id;

  v_subtotal := public.aplicar_itens_venda(p_venda_id, p_itens, 'edicao_venda');

  if v_desconto > v_subtotal then
    raise exception 'O desconto não pode ser maior que o total dos produtos.' using errcode = 'P0001';
  end if;

  update public.vendas
     set data               = coalesce(p_data, data),
         cliente_nome       = nullif(trim(p_cliente_nome), ''),
         cliente_telefone   = nullif(trim(p_cliente_telefone), ''),
         forma_pagamento_id = p_forma_pagamento_id,
         desconto           = v_desconto,
         observacao         = nullif(trim(p_observacao), ''),
         subtotal           = v_subtotal,
         total              = v_subtotal - v_desconto
   where id = p_venda_id;

  return p_venda_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Cancelar devolve os itens ao estoque com movimentos de entrada,
-- para o histórico mostrar o que aconteceu.
create or replace function public.cancelar_venda(p_venda_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_venda  public.vendas%rowtype;
  v_item   public.venda_itens%rowtype;
begin
  select * into v_venda from public.vendas where id = p_venda_id;
  if not found then
    raise exception 'Venda não encontrada.' using errcode = 'P0001';
  end if;
  if v_venda.status = 'cancelada' then
    raise exception 'Esta venda já está cancelada.' using errcode = 'P0001';
  end if;

  for v_item in select * from public.venda_itens where venda_id = p_venda_id loop
    insert into public.movimentos_estoque (produto_id, tipo, quantidade, origem, venda_id, observacao)
    values (v_item.produto_id, 'entrada', v_item.quantidade, 'cancelamento_venda', p_venda_id, 'Cancelamento de venda');
  end loop;

  update public.vendas
     set status = 'cancelada',
         cancelada_em = now()
   where id = p_venda_id;

  return p_venda_id;
end;
$$;

-- ---------------------------------------------------------------------
revoke execute on function public.aplicar_itens_venda(uuid, jsonb, text) from public, anon;
grant execute on function public.aplicar_itens_venda(uuid, jsonb, text) to authenticated;
revoke execute on function public.registrar_venda(jsonb, timestamptz, text, text, uuid, numeric, text) from public, anon;
revoke execute on function public.editar_venda(uuid, jsonb, timestamptz, text, text, uuid, numeric, text) from public, anon;
revoke execute on function public.cancelar_venda(uuid) from public, anon;
grant execute on function public.registrar_venda(jsonb, timestamptz, text, text, uuid, numeric, text) to authenticated;
grant execute on function public.editar_venda(uuid, jsonb, timestamptz, text, text, uuid, numeric, text) to authenticated;
grant execute on function public.cancelar_venda(uuid) to authenticated;
