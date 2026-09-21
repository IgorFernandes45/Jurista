-- =====================================================================
-- Agencia Impar -- Recebimentos (Sprint 5)
-- Lancar, editar e estornar pagamentos, com a divisao entre juros e principal
-- definida por quem lanca. O status da divida e recalculado a cada operacao.
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

-- Quanto de juros ja foi pago numa parcela
create or replace function public.juros_pago_parcela(p_parcela_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(pg.valor_juros) from public.pagamentos pg where pg.parcela_id = p_parcela_id), 0);
$$;

-- ---------------------------------------------------------------------
-- Visao das parcelas, agora com os juros ja pagos e o que falta de juros
-- ---------------------------------------------------------------------
drop view if exists public.parcelas_resumo;

create view public.parcelas_resumo
with (security_invoker = on) as
select
  p.id,
  p.user_id,
  p.divida_id,
  d.devedor_id,
  dev.nome                                        as devedor_nome,
  d.descricao                                     as divida_descricao,
  d.tipo                                          as divida_tipo,
  p.numero,
  p.valor,
  p.vencimento,
  p.pago,
  p.data_pagamento,
  public.principal_restante_parcela(p.id)         as principal_restante,
  public.juros_parcela(p.id)                      as juros_acumulado,
  public.juros_pago_parcela(p.id)                 as juros_pago,
  greatest(public.juros_parcela(p.id) - public.juros_pago_parcela(p.id), 0) as juros_em_aberto,
  public.principal_restante_parcela(p.id)
    + greatest(public.juros_parcela(p.id) - public.juros_pago_parcela(p.id), 0) as total_atualizado,
  public.dias_atraso_parcela(p.id)                as dias_atraso,
  case
    when public.principal_restante_parcela(p.id) <= 0 then 'paga'
    when public.dias_atraso_parcela(p.id) > 0         then 'atrasada'
    when p.vencimento = current_date                  then 'vence_hoje'
    when p.vencimento <= current_date + 3             then 'vence_em_breve'
    else 'em_dia'
  end as situacao
from public.parcelas p
join public.dividas d on d.id = p.divida_id
join public.devedores dev on dev.id = d.devedor_id
where d.status <> 'cancelada';

-- ---------------------------------------------------------------------
-- Registrar pagamento
-- ---------------------------------------------------------------------
create or replace function public.registrar_pagamento(
  p_divida_id           uuid,
  p_valor_principal     numeric,
  p_valor_juros         numeric default 0,
  p_parcela_id          uuid default null,
  p_data                date default current_date,
  p_forma_pagamento_id  uuid default null,
  p_observacao          text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_divida     public.dividas%rowtype;
  v_principal  numeric(12,2) := round(coalesce(p_valor_principal, 0), 2);
  v_juros      numeric(12,2) := round(coalesce(p_valor_juros, 0), 2);
  v_restante   numeric(12,2);
  v_pagamento  uuid;
begin
  select * into v_divida from public.dividas where id = p_divida_id;
  if not found then
    raise exception 'Divida nao encontrada.' using errcode = 'P0001';
  end if;
  if v_divida.status = 'cancelada' then
    raise exception 'Esta divida esta cancelada.' using errcode = 'P0001';
  end if;
  if v_principal < 0 or v_juros < 0 then
    raise exception 'Os valores nao podem ser negativos.' using errcode = 'P0001';
  end if;
  if v_principal + v_juros <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'P0001';
  end if;

  if p_parcela_id is not null then
    if not exists (select 1 from public.parcelas where id = p_parcela_id and divida_id = p_divida_id) then
      raise exception 'A parcela informada nao pertence a esta divida.' using errcode = 'P0001';
    end if;
    v_restante := public.principal_restante_parcela(p_parcela_id);
  else
    v_restante := public.principal_restante_divida(p_divida_id);
  end if;

  if v_principal > v_restante then
    raise exception 'O valor abatido do principal (%) e maior que o saldo em aberto (%).', v_principal, v_restante
      using errcode = 'P0001';
  end if;

  insert into public.pagamentos (divida_id, parcela_id, forma_pagamento_id, data, valor_principal, valor_juros, observacao)
  values (p_divida_id, p_parcela_id, p_forma_pagamento_id, coalesce(p_data, current_date),
          v_principal, v_juros, nullif(trim(p_observacao), ''))
  returning id into v_pagamento;

  -- marca a data de pagamento da parcela que acabou de ser quitada
  if p_parcela_id is not null and public.principal_restante_parcela(p_parcela_id) <= 0 then
    update public.parcelas set data_pagamento = coalesce(p_data, current_date) where id = p_parcela_id;
  end if;

  perform public.atualizar_status_divida(p_divida_id);
  return v_pagamento;
end;
$$;

-- ---------------------------------------------------------------------
-- Editar pagamento ja lancado
-- ---------------------------------------------------------------------
create or replace function public.editar_pagamento(
  p_pagamento_id        uuid,
  p_valor_principal     numeric,
  p_valor_juros         numeric default 0,
  p_data                date default null,
  p_forma_pagamento_id  uuid default null,
  p_observacao          text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pag        public.pagamentos%rowtype;
  v_principal  numeric(12,2) := round(coalesce(p_valor_principal, 0), 2);
  v_juros      numeric(12,2) := round(coalesce(p_valor_juros, 0), 2);
  v_restante   numeric(12,2);
begin
  select * into v_pag from public.pagamentos where id = p_pagamento_id;
  if not found then
    raise exception 'Pagamento nao encontrado.' using errcode = 'P0001';
  end if;
  if v_principal < 0 or v_juros < 0 then
    raise exception 'Os valores nao podem ser negativos.' using errcode = 'P0001';
  end if;
  if v_principal + v_juros <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'P0001';
  end if;

  -- saldo disponivel considerando que este pagamento sera substituido
  if v_pag.parcela_id is not null then
    v_restante := public.principal_restante_parcela(v_pag.parcela_id) + v_pag.valor_principal;
  else
    v_restante := public.principal_restante_divida(v_pag.divida_id) + v_pag.valor_principal;
  end if;

  if v_principal > v_restante then
    raise exception 'O valor abatido do principal (%) e maior que o saldo em aberto (%).', v_principal, v_restante
      using errcode = 'P0001';
  end if;

  update public.pagamentos
     set valor_principal    = v_principal,
         valor_juros        = v_juros,
         data               = coalesce(p_data, data),
         forma_pagamento_id = p_forma_pagamento_id,
         observacao         = nullif(trim(p_observacao), '')
   where id = p_pagamento_id;

  perform public.atualizar_status_divida(v_pag.divida_id);
  return p_pagamento_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Estornar (excluir) pagamento
-- ---------------------------------------------------------------------
create or replace function public.estornar_pagamento(p_pagamento_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pag public.pagamentos%rowtype;
begin
  select * into v_pag from public.pagamentos where id = p_pagamento_id;
  if not found then
    raise exception 'Pagamento nao encontrado.' using errcode = 'P0001';
  end if;

  delete from public.pagamentos where id = p_pagamento_id;

  if v_pag.parcela_id is not null then
    update public.parcelas
       set data_pagamento = null
     where id = v_pag.parcela_id
       and public.principal_restante_parcela(v_pag.parcela_id) > 0;
  end if;

  perform public.atualizar_status_divida(v_pag.divida_id);
  return v_pag.divida_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Lista de recebimentos ja com nomes, para a tela nao precisar juntar nada
-- ---------------------------------------------------------------------
create or replace view public.pagamentos_resumo
with (security_invoker = on) as
select
  pg.id,
  pg.user_id,
  pg.divida_id,
  pg.parcela_id,
  pg.data,
  pg.valor_principal,
  pg.valor_juros,
  pg.valor_pago,
  pg.observacao,
  pg.created_at,
  d.devedor_id,
  dev.nome        as devedor_nome,
  d.descricao     as divida_descricao,
  d.tipo          as divida_tipo,
  p.numero        as parcela_numero,
  p.vencimento    as parcela_vencimento,
  fp.id           as forma_pagamento_id,
  fp.nome         as forma_pagamento_nome
from public.pagamentos pg
join public.dividas d on d.id = pg.divida_id
join public.devedores dev on dev.id = d.devedor_id
left join public.parcelas p on p.id = pg.parcela_id
left join public.formas_pagamento fp on fp.id = pg.forma_pagamento_id;

-- ---------------------------------------------------------------------
revoke execute on function public.juros_pago_parcela(uuid) from public, anon;
revoke execute on function public.registrar_pagamento(uuid, numeric, numeric, uuid, date, uuid, text) from public, anon;
revoke execute on function public.editar_pagamento(uuid, numeric, numeric, date, uuid, text) from public, anon;
revoke execute on function public.estornar_pagamento(uuid) from public, anon;
revoke all on public.pagamentos_resumo from anon;
revoke all on public.parcelas_resumo from anon;

grant execute on function public.juros_pago_parcela(uuid) to authenticated;
grant execute on function public.registrar_pagamento(uuid, numeric, numeric, uuid, date, uuid, text) to authenticated;
grant execute on function public.editar_pagamento(uuid, numeric, numeric, date, uuid, text) to authenticated;
grant execute on function public.estornar_pagamento(uuid) to authenticated;
grant select on public.pagamentos_resumo to authenticated;
grant select on public.parcelas_resumo to authenticated;
