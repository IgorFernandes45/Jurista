-- =====================================================================
-- Agencia Impar -- Area do devedor (Sprint 6)
-- Uma unica funcao publica, que devolve apenas os dados de UM devedor,
-- identificado por um token aleatorio. Nenhuma tabela fica exposta.
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

create or replace function public.area_devedor(p_token text)
returns json
language plpgsql
security definer          -- roda com permissao propria, por isso filtra tudo pelo token
stable
set search_path = ''
as $$
declare
  v_devedor  public.devedores%rowtype;
  v_hoje     date := current_date;
  v_json     json;
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;

  select * into v_devedor
    from public.devedores
   where link_token = p_token
     and link_ativo
     and ativo;

  if not found then
    return null;   -- link invalido, desativado ou devedor inativo
  end if;

  select json_build_object(
    'devedor', json_build_object(
      'nome', v_devedor.nome,
      'instrucoes_pagamento', v_devedor.instrucoes_pagamento
    ),
    'atualizado_em', v_hoje,
    'resumo', (
      select json_build_object(
        'total_devido',   coalesce(sum(d.total_devido), 0),
        'total_atrasado', coalesce(sum(case when d.dias_atraso > 0 then d.total_devido else 0 end), 0),
        'proximo_vencimento', min(d.proximo_vencimento)
      )
      from public.dividas_resumo d
      where d.devedor_id = v_devedor.id
        and d.status not in ('cancelada', 'quitada')
    ),
    'dividas', (
      select coalesce(json_agg(divida order by divida ->> 'proximo_vencimento'), '[]'::json)
      from (
        select json_build_object(
          'descricao',          coalesce(d.descricao, ''),
          'tipo',               d.tipo,
          'situacao',           d.situacao,
          'valor_original',     d.valor_original,
          'principal_restante', d.principal_restante,
          'juros_em_aberto',    d.juros_em_aberto,
          'total_devido',       d.total_devido,
          'dias_atraso',        d.dias_atraso,
          'proximo_vencimento', d.proximo_vencimento,
          'parcelas', (
            select coalesce(json_agg(json_build_object(
                     'numero',             p.numero,
                     'vencimento',         p.vencimento,
                     'valor',              p.valor,
                     'principal_restante', p.principal_restante,
                     'juros_em_aberto',    p.juros_em_aberto,
                     'total_atualizado',   p.total_atualizado,
                     'dias_atraso',        p.dias_atraso,
                     'situacao',           p.situacao,
                     'pago',               p.pago
                   ) order by p.numero), '[]'::json)
            from public.parcelas_resumo p
            where p.divida_id = d.id
          )
        ) as divida
        from public.dividas_resumo d
        where d.devedor_id = v_devedor.id
          and d.status <> 'cancelada'
      ) as dividas_json
    ),
    'pagamentos', (
      select coalesce(json_agg(json_build_object(
               'data',            pg.data,
               'valor_pago',      pg.valor_pago,
               'valor_juros',     pg.valor_juros,
               'valor_principal', pg.valor_principal,
               'divida',          coalesce(pg.divida_descricao, '')
             ) order by pg.data desc), '[]'::json)
      from public.pagamentos_resumo pg
      where pg.devedor_id = v_devedor.id
    )
  ) into v_json;

  return v_json;
end;
$$;

-- A funcao roda como dona das tabelas; por isso ela mesma filtra pelo token.
-- Nada alem do que esta no json acima sai daqui (observacao interna, por exemplo, nunca).
revoke execute on function public.area_devedor(text) from public;
grant execute on function public.area_devedor(text) to anon, authenticated;
