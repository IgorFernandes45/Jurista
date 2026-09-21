-- =====================================================================
-- Agencia Impar -- Visoes da cobranca (Sprint 4)
-- Juntam divida, devedor, juros e saldo num lugar so, para as telas
-- mostrarem sempre o mesmo numero.
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

-- security_invoker: a visao respeita o RLS de quem consulta
create or replace view public.dividas_resumo
with (security_invoker = on) as
select
  d.id,
  d.user_id,
  d.devedor_id,
  dev.nome              as devedor_nome,
  dev.telefone          as devedor_telefone,
  d.descricao,
  d.tipo,
  d.valor_original,
  d.data_vencimento,
  d.dia_pagamento,
  d.num_parcelas,
  d.recorrencia_ativa,
  d.status,
  d.observacao,
  d.created_at,
  j.modo                as juros_modo,
  j.taxa_percent        as juros_taxa,
  j.multa_fixa          as juros_multa,
  j.valor_manual        as juros_valor_manual,
  j.carencia_dias       as juros_carencia,
  j.base                as juros_base,
  s.principal_restante,
  s.juros_acumulado,
  s.juros_pago,
  s.juros_em_aberto,
  s.total_devido,
  s.dias_atraso,
  s.proximo_vencimento,
  case
    when d.status = 'cancelada'            then 'cancelada'
    when s.principal_restante <= 0         then 'quitada'
    when s.dias_atraso > 0                 then 'atrasada'
    when s.proximo_vencimento = current_date then 'vence_hoje'
    when s.proximo_vencimento is not null
     and s.proximo_vencimento <= current_date + 3 then 'vence_em_breve'
    else 'em_dia'
  end as situacao
from public.dividas d
join public.devedores dev on dev.id = d.devedor_id
left join public.divida_juros j on j.divida_id = d.id
cross join lateral public.saldo_divida(d.id) s;

-- ---------------------------------------------------------------------
create or replace view public.parcelas_resumo
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
  public.principal_restante_parcela(p.id) + public.juros_parcela(p.id) as total_atualizado,
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

revoke all on public.dividas_resumo from anon;
revoke all on public.parcelas_resumo from anon;
grant select on public.dividas_resumo to authenticated;
grant select on public.parcelas_resumo to authenticated;
