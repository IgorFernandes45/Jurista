-- =====================================================================
-- Teste do painel e dos alertas
-- Rodar no SQL Editor DEPOIS das migrations 0001 a 0007.
-- Resultado esperado: "Success. No rows returned".
-- Nao deixa nenhum dado no banco.
-- =====================================================================
do $$
declare
  usuario   constant uuid := '22222222-0000-4000-8000-000000000022';
  outro     constant uuid := '33333333-0000-4000-8000-000000000033';
  hoje      constant date := current_date;
  produto   uuid;
  devedor   uuid;
  divida    uuid;
  parcela   uuid;
  painel    json;
  n         numeric;
  falhas    text[] := '{}';
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (usuario, 'authenticated', 'authenticated', 'teste-painel@local', '{}', '{"nome":"Teste"}', now(), now()),
         (outro,   'authenticated', 'authenticated', 'outro-painel@local', '{}', '{"nome":"Outro"}', now(), now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);

  -- ---------------- Estoque ----------------
  execute $q$ insert into public.produtos (nome, preco_venda, preco_custo, estoque_minimo)
              values ('Camiseta', 50, 20, 5) returning id $q$ into produto;
  execute $q$ insert into public.movimentos_estoque (produto_id, tipo, quantidade) values ($1, 'entrada', 10) $q$ using produto;

  execute 'select count(*) from public.produtos_alerta' into n;
  if n <> 0 then falhas := array_append(falhas, format('com estoque 10 e minimo 5 nao deveria ter alerta, tem %s', n)); end if;

  -- vende 6, sobra 4 (abaixo do minimo)
  execute $q$ select public.registrar_venda(
      jsonb_build_array(jsonb_build_object('produto_id', $1, 'quantidade', 6, 'preco_unit', 50))) $q$ using produto;

  execute 'select count(*) from public.produtos_alerta' into n;
  if n <> 1 then falhas := array_append(falhas, format('com estoque 4 e minimo 5 deveria ter 1 alerta, tem %s', n)); end if;

  -- ---------------- Cobranca ----------------
  execute $q$ insert into public.devedores (nome) values ('Devedor Painel') returning id $q$ into devedor;

  -- atrasada ha 10 dias: 1000 + 100 de juros
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Atrasada', null, null, 'percentual_dia', 1) $q$
    into divida using devedor, hoje - 10;
  -- vence hoje
  execute $q$ select public.criar_divida($1, 'a_vista', 500, $2, 'Vence hoje') $q$ using devedor, hoje;
  -- vence em 5 dias
  execute $q$ select public.criar_divida($1, 'a_vista', 200, $2, 'Proxima semana') $q$ using devedor, hoje + 5;
  -- vence daqui a 2 meses (nao entra nos proximos 7 dias)
  execute $q$ select public.criar_divida($1, 'a_vista', 900, $2, 'Longe') $q$ using devedor, hoje + 60;

  -- pagamento do mes
  select id into parcela from public.parcelas where divida_id = divida;
  execute $q$ select public.registrar_pagamento($1, 100, 100, $2, $3) $q$ using divida, parcela, hoje;

  execute 'select public.painel($1)' into painel using hoje;

  n := (painel -> 'vendas' ->> 'hoje_total')::numeric;
  if n <> 300 then falhas := array_append(falhas, format('vendas de hoje deveriam somar 300, deu %s', n)); end if;

  n := (painel -> 'vendas' ->> 'hoje_qtd')::numeric;
  if n <> 1 then falhas := array_append(falhas, format('deveria ter 1 venda hoje, tem %s', n)); end if;

  n := (painel -> 'estoque' ->> 'em_alerta')::numeric;
  if n <> 1 then falhas := array_append(falhas, format('deveria ter 1 produto em alerta, tem %s', n)); end if;

  -- atrasada: 900 de principal (1000 - 100 pagos) + juros recalculados (900 x 1%% x 10 = 90, menos 100 pagos = 0)
  n := (painel -> 'cobranca' ->> 'atrasado')::numeric;
  if n <> 900 then falhas := array_append(falhas, format('o valor atrasado deveria ser 900, deu %s', n)); end if;

  n := (painel -> 'cobranca' ->> 'qtd_atrasadas')::numeric;
  if n <> 1 then falhas := array_append(falhas, format('deveria ter 1 divida atrasada, tem %s', n)); end if;

  n := (painel -> 'cobranca' ->> 'vence_hoje')::numeric;
  if n <> 500 then falhas := array_append(falhas, format('vencendo hoje deveria dar 500, deu %s', n)); end if;

  n := (painel -> 'cobranca' ->> 'proximos_7')::numeric;
  if n <> 200 then falhas := array_append(falhas, format('proximos 7 dias deveria dar 200, deu %s', n)); end if;

  n := (painel -> 'cobranca' ->> 'a_receber')::numeric;
  if n <> 2500 then falhas := array_append(falhas, format('o total a receber deveria ser 2500, deu %s', n)); end if;

  n := (painel ->> 'recebido_mes')::numeric;
  if n <> 200 then falhas := array_append(falhas, format('o recebido no mes deveria ser 200, deu %s', n)); end if;

  -- ---------------- Cada usuario ve so o que e seu ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated')::text, true);
  execute 'select public.painel($1)' into painel using hoje;

  n := (painel -> 'cobranca' ->> 'a_receber')::numeric;
  if n <> 0 then falhas := array_append(falhas, format('o outro usuario viu %s a receber', n)); end if;

  n := (painel -> 'vendas' ->> 'mes_total')::numeric;
  if n <> 0 then falhas := array_append(falhas, format('o outro usuario viu %s em vendas', n)); end if;

  execute 'select count(*) from public.produtos_alerta' into n;
  if n <> 0 then falhas := array_append(falhas, 'o outro usuario viu produtos em alerta que nao sao dele'); end if;

  -- ---------------- Limpeza ----------------
  execute 'reset role';
  delete from auth.users where id in (usuario, outro);

  if cardinality(falhas) > 0 then
    raise exception 'TESTE FALHOU: %', array_to_string(falhas, ' | ');
  end if;
end;
$$;
