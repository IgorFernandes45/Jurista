-- =====================================================================
-- Teste de isolamento entre usuários (RLS)
-- Rodar no SQL Editor DEPOIS da migration 0001.
-- Resultado esperado: "Success. No rows returned".
-- Se algo falhar, aparece um erro começando com "TESTE FALHOU".
-- Não deixa nenhum dado no banco (os usuários de teste são apagados no fim).
-- =====================================================================
do $$
declare
  usuario_a  constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000a';
  usuario_b  constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
  produto_a  uuid;
  devedor_a  uuid;
  venda_b    uuid;
  n          bigint;
  falhas     text[] := '{}';
begin
  -- Usuários de teste (dispara a criação de perfil e formas de pagamento)
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (usuario_a, 'authenticated', 'authenticated', 'teste-a@rls.local', '{}', '{"nome":"Teste A"}', now(), now()),
    (usuario_b, 'authenticated', 'authenticated', 'teste-b@rls.local', '{}', '{"nome":"Teste B"}', now(), now());

  select count(*) into n from public.formas_pagamento where user_id = usuario_a;
  if n <> 3 then falhas := array_append(falhas, format('novo usuário deveria ter 3 formas de pagamento, tem %s', n)); end if;

  -- ---------------- Usuário A cria seus dados ----------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', usuario_a, 'role', 'authenticated')::text, true);

  execute $q$ insert into public.produtos (nome, preco_venda) values ('Produto do A', 10) returning id $q$ into produto_a;
  execute $q$ insert into public.devedores (nome) values ('Devedor do A') returning id $q$ into devedor_a;
  execute $q$ insert into public.movimentos_estoque (produto_id, tipo, quantidade) values ($1, 'entrada', 5) $q$ using produto_a;

  execute 'select estoque_atual from public.produtos where id = $1' into n using produto_a;
  if n <> 5 then falhas := array_append(falhas, format('estoque após entrada de 5 deveria ser 5, é %s', n)); end if;

  -- ---------------- Usuário B tenta acessar dados do A ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', usuario_b, 'role', 'authenticated')::text, true);

  execute 'select count(*) from public.produtos' into n;
  if n <> 0 then falhas := array_append(falhas, 'B enxergou produtos do A'); end if;

  execute 'select count(*) from public.devedores' into n;
  if n <> 0 then falhas := array_append(falhas, 'B enxergou devedores do A'); end if;

  execute 'select count(*) from public.formas_pagamento' into n;
  if n <> 3 then falhas := array_append(falhas, format('B deveria ver só as próprias 3 formas de pagamento, viu %s', n)); end if;

  execute 'select count(*) from public.perfis' into n;
  if n <> 1 then falhas := array_append(falhas, format('B deveria ver só o próprio perfil, viu %s', n)); end if;

  execute $q$ update public.produtos set nome = 'invadido' where id = $1 $q$ using produto_a;
  execute $q$ delete from public.devedores where id = $1 $q$ using devedor_a;

  -- B tenta gravar um registro em nome do A
  begin
    execute $q$ insert into public.produtos (user_id, nome) values ($1, 'falso') $q$ using usuario_a;
    falhas := array_append(falhas, 'B conseguiu criar produto em nome do A');
  exception when insufficient_privilege then null;
  end;

  -- B tenta usar o produto do A numa venda própria (bloqueado pela chave composta)
  execute $q$ insert into public.vendas (total) values (10) returning id $q$ into venda_b;
  begin
    execute $q$ insert into public.venda_itens (venda_id, produto_id, quantidade, preco_unit) values ($1, $2, 1, 10) $q$
      using venda_b, produto_a;
    falhas := array_append(falhas, 'B conseguiu vender o produto do A');
  exception when foreign_key_violation then null;
  end;

  -- B tenta mexer no estoque do A
  begin
    execute $q$ insert into public.movimentos_estoque (produto_id, tipo, quantidade) values ($1, 'saida', -5) $q$
      using produto_a;
    falhas := array_append(falhas, 'B conseguiu movimentar o estoque do A');
  exception when foreign_key_violation then null;
  end;

  -- ---------------- Visitante sem login ----------------
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    execute 'select count(*) from public.devedores' into n;
    falhas := array_append(falhas, 'visitante sem login conseguiu consultar devedores');
  exception when insufficient_privilege then null;
  end;

  -- ---------------- Conferência final (como administrador) ----------------
  execute 'reset role';

  select count(*) into n from public.produtos where id = produto_a and nome = 'Produto do A' and estoque_atual = 5;
  if n <> 1 then falhas := array_append(falhas, 'produto do A foi alterado por B'); end if;

  select count(*) into n from public.devedores where id = devedor_a;
  if n <> 1 then falhas := array_append(falhas, 'devedor do A foi apagado por B'); end if;

  -- Limpeza: apagar os usuários remove todos os dados deles em cascata
  delete from auth.users where id in (usuario_a, usuario_b);

  if cardinality(falhas) > 0 then
    raise exception 'TESTE FALHOU: %', array_to_string(falhas, ' | ');
  end if;
end;
$$;
