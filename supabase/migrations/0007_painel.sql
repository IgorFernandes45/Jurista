-- =====================================================================
-- Agencia Impar -- Painel, calendario e alertas (Sprint 7)
-- Uma visao dos produtos em alerta e uma funcao que devolve os numeros
-- do painel inicial de uma vez so.
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

-- Produtos no estoque minimo ou abaixo dele
create or replace view public.produtos_alerta
with (security_invoker = on) as
select
  p.id,
  p.user_id,
  p.nome,
  p.sku,
  p.estoque_atual,
  p.estoque_minimo,
  p.preco_venda,
  (p.estoque_atual < 0) as negativo
from public.produtos p
where p.ativo
  and p.estoque_atual <= p.estoque_minimo;

-- ---------------------------------------------------------------------
-- Numeros do painel inicial (respeita o RLS de quem chama)
-- ---------------------------------------------------------------------
create or replace function public.painel(p_data date default current_date)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'data', p_data,
    'vendas', (
      select json_build_object(
        'hoje_total',  coalesce(sum(v.total) filter (where v.data::date = p_data), 0),
        'hoje_qtd',    count(*) filter (where v.data::date = p_data),
        'mes_total',   coalesce(sum(v.total) filter (where v.data::date >= date_trunc('month', p_data)::date), 0),
        'mes_qtd',     count(*) filter (where v.data::date >= date_trunc('month', p_data)::date)
      )
      from public.vendas v
      where v.status = 'ativa'
        and v.data::date >= date_trunc('month', p_data)::date
    ),
    'estoque', (
      select json_build_object(
        'em_alerta', count(*),
        'negativos', count(*) filter (where negativo)
      )
      from public.produtos_alerta
    ),
    'cobranca', (
      select json_build_object(
        'a_receber',        coalesce(sum(d.total_devido), 0),
        'atrasado',         coalesce(sum(d.total_devido) filter (where d.dias_atraso > 0), 0),
        'qtd_atrasadas',    count(*) filter (where d.dias_atraso > 0),
        'vence_hoje',       coalesce(sum(d.total_devido) filter (where d.proximo_vencimento = p_data), 0),
        'qtd_vence_hoje',   count(*) filter (where d.proximo_vencimento = p_data),
        'proximos_7',       coalesce(sum(d.total_devido) filter (
                              where d.proximo_vencimento > p_data and d.proximo_vencimento <= p_data + 7), 0),
        'qtd_proximos_7',   count(*) filter (
                              where d.proximo_vencimento > p_data and d.proximo_vencimento <= p_data + 7)
      )
      from public.dividas_resumo d
      where d.status not in ('cancelada', 'quitada')
    ),
    'recebido_mes', (
      select coalesce(sum(pg.valor_pago), 0)
      from public.pagamentos pg
      where pg.data >= date_trunc('month', p_data)::date
        and pg.data <= p_data
    )
  );
$$;

-- ---------------------------------------------------------------------
revoke all on public.produtos_alerta from anon;
revoke execute on function public.painel(date) from public, anon;
grant select on public.produtos_alerta to authenticated;
grant execute on function public.painel(date) to authenticated;
