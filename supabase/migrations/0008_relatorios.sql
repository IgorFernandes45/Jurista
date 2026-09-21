-- =====================================================================
-- Agencia Impar -- Relatorios (Sprint 8)
-- Lucro por venda, produtos mais vendidos, vendas por forma de pagamento
-- e o resumo da cobranca no periodo.
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

-- Cada venda com o custo dos itens e o lucro ja calculado.
-- O custo usado e o que estava no produto no dia da venda (guardado no item).
create or replace view public.vendas_lucro
with (security_invoker = on) as
select
  v.id,
  v.user_id,
  v.data,
  v.cliente_nome,
  v.forma_pagamento_id,
  fp.nome                                  as forma_pagamento_nome,
  v.subtotal,
  v.desconto,
  v.total,
  v.status,
  coalesce(itens.custo_total, 0)           as custo_total,
  v.total - coalesce(itens.custo_total, 0) as lucro,
  case when v.total > 0
       then round((v.total - coalesce(itens.custo_total, 0)) / v.total * 100, 2)
       else 0 end                          as margem_percent
from public.vendas v
left join public.formas_pagamento fp on fp.id = v.forma_pagamento_id
left join lateral (
  select sum(i.quantidade * i.preco_custo_unit) as custo_total
  from public.venda_itens i
  where i.venda_id = v.id
) itens on true;

-- ---------------------------------------------------------------------
-- Relatorio de vendas do periodo
-- ---------------------------------------------------------------------
create or replace function public.relatorio_vendas(p_de date, p_ate date)
returns json
language sql
stable
set search_path = ''
as $$
  with vendas_periodo as (
    select * from public.vendas_lucro
     where status = 'ativa'
       and data::date between p_de and p_ate
  )
  select json_build_object(
    'de', p_de,
    'ate', p_ate,
    'totais', (
      select json_build_object(
        'qtd_vendas',  count(*),
        'faturamento', coalesce(sum(total), 0),
        'descontos',   coalesce(sum(desconto), 0),
        'custo',       coalesce(sum(custo_total), 0),
        'lucro',       coalesce(sum(lucro), 0),
        'ticket_medio', case when count(*) > 0 then round(coalesce(sum(total), 0) / count(*), 2) else 0 end,
        'margem',      case when coalesce(sum(total), 0) > 0
                            then round(coalesce(sum(lucro), 0) / sum(total) * 100, 2) else 0 end
      ) from vendas_periodo
    ),
    'por_forma', (
      select coalesce(json_agg(f order by f ->> 'nome'), '[]'::json) from (
        select json_build_object(
          'nome',  coalesce(forma_pagamento_nome, 'Não informada'),
          'qtd',   count(*),
          'total', sum(total)
        ) as f
        from vendas_periodo
        group by forma_pagamento_nome
      ) x
    ),
    'por_produto', (
      select coalesce(json_agg(p order by (p ->> 'total')::numeric desc), '[]'::json) from (
        select json_build_object(
          'nome',       pr.nome,
          'quantidade', sum(i.quantidade),
          'total',      sum(i.subtotal),
          'lucro',      sum(i.quantidade * (i.preco_unit - i.preco_custo_unit))
        ) as p
        from public.venda_itens i
        join vendas_periodo v on v.id = i.venda_id
        join public.produtos pr on pr.id = i.produto_id
        group by pr.id, pr.nome
      ) x
    ),
    'por_dia', (
      select coalesce(json_agg(d order by d ->> 'dia'), '[]'::json) from (
        select json_build_object(
          'dia',   data::date,
          'total', sum(total),
          'lucro', sum(lucro),
          'qtd',   count(*)
        ) as d
        from vendas_periodo
        group by data::date
      ) x
    )
  );
$$;

-- ---------------------------------------------------------------------
-- Relatorio da cobranca no periodo
-- ---------------------------------------------------------------------
create or replace function public.relatorio_cobranca(p_de date, p_ate date)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'de', p_de,
    'ate', p_ate,
    'recebido', (
      select json_build_object(
        'qtd',       count(*),
        'total',     coalesce(sum(valor_pago), 0),
        'juros',     coalesce(sum(valor_juros), 0),
        'principal', coalesce(sum(valor_principal), 0)
      )
      from public.pagamentos
      where data between p_de and p_ate
    ),
    'recebido_por_forma', (
      select coalesce(json_agg(f order by f ->> 'nome'), '[]'::json) from (
        select json_build_object(
          'nome',  coalesce(fp.nome, 'Não informada'),
          'qtd',   count(*),
          'total', sum(pg.valor_pago)
        ) as f
        from public.pagamentos pg
        left join public.formas_pagamento fp on fp.id = pg.forma_pagamento_id
        where pg.data between p_de and p_ate
        group by fp.nome
      ) x
    ),
    'recebido_por_devedor', (
      select coalesce(json_agg(d order by (d ->> 'total')::numeric desc), '[]'::json) from (
        select json_build_object(
          'nome',  pg.devedor_nome,
          'qtd',   count(*),
          'total', sum(pg.valor_pago),
          'juros', sum(pg.valor_juros)
        ) as d
        from public.pagamentos_resumo pg
        where pg.data between p_de and p_ate
        group by pg.devedor_nome
      ) x
    ),
    'em_aberto', (
      select json_build_object(
        'a_receber', coalesce(sum(total_devido), 0),
        'atrasado',  coalesce(sum(total_devido) filter (where dias_atraso > 0), 0),
        'juros_acumulados', coalesce(sum(juros_em_aberto), 0),
        'qtd_dividas', count(*),
        'qtd_atrasadas', count(*) filter (where dias_atraso > 0)
      )
      from public.dividas_resumo
      where status not in ('cancelada', 'quitada')
    )
  );
$$;

-- ---------------------------------------------------------------------
revoke all on public.vendas_lucro from anon;
revoke execute on function public.relatorio_vendas(date, date) from public, anon;
revoke execute on function public.relatorio_cobranca(date, date) from public, anon;
grant select on public.vendas_lucro to authenticated;
grant execute on function public.relatorio_vendas(date, date) to authenticated;
grant execute on function public.relatorio_cobranca(date, date) to authenticated;
