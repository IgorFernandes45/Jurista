-- =====================================================================
-- Teste dos relatorios
-- Rodar no SQL Editor DEPOIS das migrations 0001 a 0008.
-- Resultado esperado: "Success. No rows returned".
-- Nao deixa nenhum dado no banco.
-- =====================================================================
do $$
declare
  usuario   constant uuid := '44444444-0000-4000-8000-000000000044';
  outro     constant uuid := '55555555-0000-4000-8000-000000000055';
  hoje      constant date := current_date;
  camiseta  uuid;
  bone      uuid;
  pix       uuid;
  devedor   uuid;
  divida    uuid;
  parcela   uuid;
  rel       json;
  n         numeric;
  falhas    text[] := '{}';
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (usuario, 'authenticated', 'authenticated', 'teste-rel@local', '{}', '{"nome":"Teste"}', now(), now()),
         (outro,   'authenticated', 'authenticated', 'outro-rel@local', '{}', '{"nome":"Outro"}', now(), now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);

  select id into pix from public.formas_pagamento where nome = 'Pix';

  -- ---------------- Vendas ----------------
  execute $q$ insert into public.produtos (nome, preco_venda, preco_custo) values ('Camiseta', 50, 20) returning id $q$ into camiseta;
  execute $q$ insert into public.produtos (nome, preco_venda, preco_custo) values ('Bone', 30, 10) returning id $q$ into bone;
  execute $q$ insert into public.movimentos_estoque (produto_id, tipo, quantidade) values ($1, 'entrada', 50) $q$ using camiseta;
  execute $q$ insert into public.movimentos_estoque (produto_id, tipo, quantidade) values ($1, 'entrada', 50) $q$ using bone;

  -- venda 1: 2 camisetas a 50 (custo 20 cada) = 100, sem desconto
  execute $q$ select public.registrar_venda(
      jsonb_build_array(jsonb_build_object('produto_id', $1, 'quantidade', 2, 'preco_unit', 50)),
      now(), null, null, $2, 0) $q$ using camiseta, pix;

  -- venda 2: 1 bone a 30 (custo 10) com 10 de desconto = 20
  execute $q$ select public.registrar_venda(
      jsonb_build_array(jsonb_build_object('produto_id', $1, 'quantidade', 1, 'preco_unit', 30)),
      now(), null, null, null, 10) $q$ using bone;

  -- venda 3: cancelada, nao pode entrar no relatorio
  execute $q$ select public.cancelar_venda(public.registrar_venda(
      jsonb_build_array(jsonb_build_object('produto_id', $1, 'quantidade', 5, 'preco_unit', 50)))) $q$ using camiseta;

  execute 'select public.relatorio_vendas($1, $2)' into rel using hoje, hoje;

  n := (rel -> 'totais' ->> 'qtd_vendas')::numeric;
  if n <> 2 then falhas := array_append(falhas, format('deveriam entrar 2 vendas (a cancelada fora), entraram %s', n)); end if;

  -- 100 + 20 = 120
  n := (rel -> 'totais' ->> 'faturamento')::numeric;
  if n <> 120 then falhas := array_append(falhas, format('faturamento deveria ser 120, deu %s', n)); end if;

  -- custo: 2 x 20 + 1 x 10 = 50
  n := (rel -> 'totais' ->> 'custo')::numeric;
  if n <> 50 then falhas := array_append(falhas, format('custo deveria ser 50, deu %s', n)); end if;

  -- lucro: 120 - 50 = 70 (o desconto ja esta descontado do faturamento)
  n := (rel -> 'totais' ->> 'lucro')::numeric;
  if n <> 70 then falhas := array_append(falhas, format('lucro deveria ser 70, deu %s', n)); end if;

  n := (rel -> 'totais' ->> 'descontos')::numeric;
  if n <> 10 then falhas := array_append(falhas, format('descontos deveriam somar 10, deu %s', n)); end if;

  n := (rel -> 'totais' ->> 'ticket_medio')::numeric;
  if n <> 60 then falhas := array_append(falhas, format('ticket medio deveria ser 60, deu %s', n)); end if;

  n := json_array_length(rel -> 'por_forma');
  if n <> 2 then falhas := array_append(falhas, format('deveriam aparecer 2 formas de pagamento, apareceram %s', n)); end if;

  n := json_array_length(rel -> 'por_produto');
  if n <> 2 then falhas := array_append(falhas, format('deveriam aparecer 2 produtos, apareceram %s', n)); end if;

  -- o mais vendido em valor vem primeiro: camiseta com 100
  if rel -> 'por_produto' -> 0 ->> 'nome' <> 'Camiseta' then
    falhas := array_append(falhas, 'o produto de maior valor deveria vir primeiro');
  end if;

  -- periodo sem vendas
  execute 'select public.relatorio_vendas($1, $2)' into rel using hoje - 30, hoje - 20;
  n := (rel -> 'totais' ->> 'faturamento')::numeric;
  if n <> 0 then falhas := array_append(falhas, format('periodo sem vendas deveria dar 0, deu %s', n)); end if;

  -- ---------------- Cobranca ----------------
  execute $q$ insert into public.devedores (nome) values ('Devedor Rel') returning id $q$ into devedor;
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Atrasada', null, null, 'percentual_dia', 1) $q$
    into divida using devedor, hoje - 10;
  select id into parcela from public.parcelas where divida_id = divida;
  execute $q$ select public.registrar_pagamento($1, 200, 100, $2, $3, $4) $q$ using divida, parcela, hoje, pix;

  execute 'select public.relatorio_cobranca($1, $2)' into rel using hoje, hoje;

  n := (rel -> 'recebido' ->> 'total')::numeric;
  if n <> 300 then falhas := array_append(falhas, format('recebido deveria ser 300, deu %s', n)); end if;

  n := (rel -> 'recebido' ->> 'juros')::numeric;
  if n <> 100 then falhas := array_append(falhas, format('juros recebidos deveriam ser 100, deu %s', n)); end if;

  n := (rel -> 'recebido' ->> 'principal')::numeric;
  if n <> 200 then falhas := array_append(falhas, format('principal recebido deveria ser 200, deu %s', n)); end if;

  -- em aberto: 800 de principal; juros recalculados (800 x 1%% x 10 = 80) menos 100 pagos => 0
  n := (rel -> 'em_aberto' ->> 'a_receber')::numeric;
  if n <> 800 then falhas := array_append(falhas, format('a receber deveria ser 800, deu %s', n)); end if;

  n := (rel -> 'em_aberto' ->> 'qtd_atrasadas')::numeric;
  if n <> 1 then falhas := array_append(falhas, format('deveria ter 1 divida atrasada, tem %s', n)); end if;

  if rel -> 'recebido_por_devedor' -> 0 ->> 'nome' <> 'Devedor Rel' then
    falhas := array_append(falhas, 'o recebido por devedor veio errado');
  end if;

  -- ---------------- Cada usuario ve so o que e seu ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated')::text, true);

  execute 'select public.relatorio_vendas($1, $2)' into rel using hoje, hoje;
  n := (rel -> 'totais' ->> 'faturamento')::numeric;
  if n <> 0 then falhas := array_append(falhas, format('o outro usuario viu %s de faturamento', n)); end if;

  execute 'select public.relatorio_cobranca($1, $2)' into rel using hoje, hoje;
  n := (rel -> 'recebido' ->> 'total')::numeric;
  if n <> 0 then falhas := array_append(falhas, format('o outro usuario viu %s recebidos', n)); end if;

  execute 'select count(*) from public.vendas_lucro' into n;
  if n <> 0 then falhas := array_append(falhas, 'o outro usuario viu vendas que nao sao dele'); end if;

  -- ---------------- Limpeza ----------------
  execute 'reset role';
  delete from auth.users where id in (usuario, outro);

  if cardinality(falhas) > 0 then
    raise exception 'TESTE FALHOU: %', array_to_string(falhas, ' | ');
  end if;
end;
$$;
