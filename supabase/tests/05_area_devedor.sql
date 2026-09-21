-- =====================================================================
-- Teste da area do devedor (link publico)
-- Rodar no SQL Editor DEPOIS das migrations 0001 a 0006.
-- Resultado esperado: "Success. No rows returned".
-- Nao deixa nenhum dado no banco.
-- =====================================================================
do $$
declare
  usuario   constant uuid := '11111111-0000-4000-8000-000000000011';
  hoje      constant date := current_date;
  devedor_a uuid;
  devedor_b uuid;
  token_a   text;
  token_b   text;
  divida    uuid;
  parcela   uuid;
  resposta  json;
  n         numeric;
  falhas    text[] := '{}';
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (usuario, 'authenticated', 'authenticated', 'teste-area@local', '{}', '{"nome":"Teste"}', now(), now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);

  execute $q$ insert into public.devedores (nome, telefone, observacao, instrucoes_pagamento)
              values ('Maria', '11999999999', 'SEGREDO INTERNO', 'Pix: 11999999999') returning id $q$ into devedor_a;
  execute $q$ insert into public.devedores (nome, observacao) values ('Joao', 'outro segredo') returning id $q$ into devedor_b;

  select link_token into token_a from public.devedores where id = devedor_a;
  select link_token into token_b from public.devedores where id = devedor_b;

  if length(token_a) < 32 then falhas := array_append(falhas, 'o token do link deveria ser longo'); end if;
  if token_a = token_b then falhas := array_append(falhas, 'dois devedores ficaram com o mesmo token'); end if;

  -- Divida de 1000 vencida ha 10 dias, 1% ao dia => 100 de juros
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Emprestimo', null, null, 'percentual_dia', 1) $q$
    into divida using devedor_a, hoje - 10;
  select id into parcela from public.parcelas where divida_id = divida;
  execute $q$ select public.registrar_pagamento($1, 200, 100, $2, $3) $q$ using divida, parcela, hoje;

  -- Divida do Joao, que nao pode aparecer no link da Maria
  execute $q$ select public.criar_divida($1, 'a_vista', 555, $2, 'Divida do Joao') $q$ using devedor_b, hoje;

  -- ---------------- Visitante sem login abre o link ----------------
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  execute 'select public.area_devedor($1)' into resposta using token_a;

  if resposta is null then
    falhas := array_append(falhas, 'o link valido nao devolveu nada');
  else
    if resposta -> 'devedor' ->> 'nome' <> 'Maria' then
      falhas := array_append(falhas, 'o nome do devedor veio errado');
    end if;
    if resposta -> 'devedor' ->> 'instrucoes_pagamento' <> 'Pix: 11999999999' then
      falhas := array_append(falhas, 'as instrucoes de pagamento nao apareceram');
    end if;
    if resposta::text like '%SEGREDO INTERNO%' then
      falhas := array_append(falhas, 'a observacao interna vazou para a pagina publica');
    end if;
    if resposta::text like '%11999999999%' and resposta -> 'devedor' ->> 'instrucoes_pagamento' is null then
      falhas := array_append(falhas, 'o telefone interno vazou');
    end if;
    if resposta::text like '%Divida do Joao%' then
      falhas := array_append(falhas, 'apareceu divida de outro devedor');
    end if;

    -- 800 de principal + juros do dia (800 x 1%% x 10 = 80, menos os 100 ja pagos => 0)
    n := (resposta -> 'resumo' ->> 'total_devido')::numeric;
    if n <> 800 then falhas := array_append(falhas, format('o total devido deveria ser 800, veio %s', n)); end if;

    n := json_array_length(resposta -> 'dividas');
    if n <> 1 then falhas := array_append(falhas, format('deveria trazer 1 divida, trouxe %s', n)); end if;

    n := json_array_length(resposta -> 'pagamentos');
    if n <> 1 then falhas := array_append(falhas, format('deveria trazer 1 pagamento, trouxe %s', n)); end if;

    n := json_array_length(resposta -> 'dividas' -> 0 -> 'parcelas');
    if n <> 1 then falhas := array_append(falhas, format('deveria trazer 1 parcela, trouxe %s', n)); end if;
  end if;

  -- ---------------- Token errado ----------------
  execute 'select public.area_devedor($1)' into resposta using repeat('a', 64);
  if resposta is not null then falhas := array_append(falhas, 'token inventado devolveu dados'); end if;

  execute 'select public.area_devedor($1)' into resposta using 'curto';
  if resposta is not null then falhas := array_append(falhas, 'token curto devolveu dados'); end if;

  execute 'select public.area_devedor(null)' into resposta;
  if resposta is not null then falhas := array_append(falhas, 'token nulo devolveu dados'); end if;

  -- ---------------- Visitante nao acessa as tabelas direto ----------------
  begin
    execute 'select count(*) from public.devedores' into n;
    falhas := array_append(falhas, 'visitante conseguiu ler a tabela de devedores');
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select count(*) from public.dividas_resumo' into n;
    falhas := array_append(falhas, 'visitante conseguiu ler a visao de dividas');
  exception when insufficient_privilege then null;
  end;

  -- ---------------- Link desativado ----------------
  execute 'reset role';
  update public.devedores set link_ativo = false where id = devedor_a;

  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'select public.area_devedor($1)' into resposta using token_a;
  if resposta is not null then falhas := array_append(falhas, 'link desativado continuou funcionando'); end if;

  -- ---------------- Limpeza ----------------
  execute 'reset role';
  delete from auth.users where id = usuario;

  if cardinality(falhas) > 0 then
    raise exception 'TESTE FALHOU: %', array_to_string(falhas, ' | ');
  end if;
end;
$$;
