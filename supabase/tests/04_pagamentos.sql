-- =====================================================================
-- Teste dos recebimentos (lancar, editar, estornar)
-- Rodar no SQL Editor DEPOIS das migrations 0001 a 0005.
-- Resultado esperado: "Success. No rows returned".
-- Nao deixa nenhum dado no banco.
-- =====================================================================
do $$
declare
  usuario   constant uuid := 'ffffffff-0000-4000-8000-00000000000f';
  hoje      constant date := date '2026-05-20';
  devedor   uuid;
  divida    uuid;
  parcela1  uuid;
  parcela2  uuid;
  pagamento uuid;
  n         numeric;
  falhas    text[] := '{}';
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (usuario, 'authenticated', 'authenticated', 'teste-pagto@local', '{}', '{"nome":"Teste"}', now(), now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);

  execute $q$ insert into public.devedores (nome) values ('Devedor Pagamento') returning id $q$ into devedor;

  -- Divida de 1000 vencida ha 10 dias, 1% ao dia => 100 de juros
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Emprestimo', null, null, 'percentual_dia', 1) $q$
    into divida using devedor, hoje - 10;
  select id into parcela1 from public.parcelas where divida_id = divida;

  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 100 then falhas := array_append(falhas, format('juros iniciais deveriam ser 100, sao %s', n)); end if;

  -- ---------------- Pagamento parcial: 100 de juros + 300 de principal ----------------
  execute $q$ select public.registrar_pagamento($1, 300, 100, $2, $3) $q$
    into pagamento using divida, parcela1, hoje;

  execute 'select principal_restante from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 700 then falhas := array_append(falhas, format('principal deveria cair para 700, e %s', n)); end if;

  -- juros do dia sobre 700: 700 x 1%% x 10 = 70, menos os 100 ja pagos => 0 em aberto
  execute 'select juros_em_aberto from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 0 then falhas := array_append(falhas, format('juros em aberto deveriam ser 0, sao %s', n)); end if;

  execute $q$ select count(*) from public.dividas where id = $1 and status = 'parcial' $q$ into n using divida;
  if n <> 1 then falhas := array_append(falhas, 'status deveria ser parcial'); end if;

  execute 'select juros_pago from public.parcelas_resumo where id = $1' into n using parcela1;
  if n <> 100 then falhas := array_append(falhas, format('juros pagos da parcela deveriam ser 100, sao %s', n)); end if;

  -- ---------------- Editar o pagamento ----------------
  execute $q$ select public.editar_pagamento($1, 500, 100, $2) $q$ using pagamento, hoje;
  execute 'select principal_restante from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 500 then falhas := array_append(falhas, format('apos editar, o principal deveria ser 500, e %s', n)); end if;

  -- Nao pode abater mais do que o saldo
  begin
    execute $q$ select public.editar_pagamento($1, 5000, 0, $2) $q$ using pagamento, hoje;
    falhas := array_append(falhas, 'aceitou abater mais do que o saldo na edicao');
  exception when raise_exception then null;
  end;

  -- ---------------- Estorno ----------------
  execute 'select public.estornar_pagamento($1)' using pagamento;
  execute 'select principal_restante from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 1000 then falhas := array_append(falhas, format('apos o estorno o principal deveria voltar a 1000, e %s', n)); end if;

  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 100 then falhas := array_append(falhas, format('apos o estorno os juros deveriam voltar a 100, sao %s', n)); end if;

  execute $q$ select count(*) from public.dividas where id = $1 and status = 'aberta' $q$ into n using divida;
  if n <> 1 then falhas := array_append(falhas, 'apos o estorno o status deveria voltar para aberta'); end if;

  -- ---------------- Quitacao ----------------
  execute $q$ select public.registrar_pagamento($1, 1000, 100, $2, $3) $q$ using divida, parcela1, hoje;
  execute 'select total_devido from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 0 then falhas := array_append(falhas, format('apos quitar o total deveria ser 0, e %s', n)); end if;

  execute $q$ select count(*) from public.dividas where id = $1 and status = 'quitada' $q$ into n using divida;
  if n <> 1 then falhas := array_append(falhas, 'a divida deveria ficar quitada'); end if;

  execute 'select count(*) from public.parcelas where id = $1 and pago and data_pagamento = $2' into n using parcela1, hoje;
  if n <> 1 then falhas := array_append(falhas, 'a parcela deveria ficar paga e com a data do pagamento'); end if;

  -- Nao pode pagar mais do que o saldo
  begin
    execute $q$ select public.registrar_pagamento($1, 10, 0, $2, $3) $q$ using divida, parcela1, hoje;
    falhas := array_append(falhas, 'aceitou pagamento acima do saldo');
  exception when raise_exception then null;
  end;

  -- Valor zero e recusado
  begin
    execute $q$ select public.registrar_pagamento($1, 0, 0) $q$ using divida;
    falhas := array_append(falhas, 'aceitou pagamento de valor zero');
  exception when raise_exception then null;
  end;

  -- ---------------- Parcelada: pagar so a primeira parcela ----------------
  execute $q$ select public.criar_divida($1, 'parcelada', 300, $2, 'Parcelada', null, 3, 'sem_juros') $q$
    into divida using devedor, hoje - 5;
  select id into parcela1 from public.parcelas where divida_id = divida and numero = 1;
  select id into parcela2 from public.parcelas where divida_id = divida and numero = 2;

  execute $q$ select public.registrar_pagamento($1, 100, 0, $2, $3) $q$ using divida, parcela1, hoje;

  execute 'select count(*) from public.parcelas where id = $1 and pago' into n using parcela1;
  if n <> 1 then falhas := array_append(falhas, 'a parcela 1 deveria ficar paga'); end if;

  execute 'select count(*) from public.parcelas where id = $1 and pago' into n using parcela2;
  if n <> 0 then falhas := array_append(falhas, 'a parcela 2 nao deveria ficar paga'); end if;

  execute 'select principal_restante from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 200 then falhas := array_append(falhas, format('deveriam faltar 200, faltam %s', n)); end if;

  -- Pagamento em parcela de outra divida e recusado
  begin
    execute $q$ select public.registrar_pagamento($1, 10, 0, $2) $q$ using divida, parcela1;
  exception when raise_exception then null;
  end;

  -- ---------------- Visao de recebimentos ----------------
  execute 'select count(*) from public.pagamentos_resumo where divida_id = $1' into n using divida;
  if n <> 1 then falhas := array_append(falhas, format('a visao de recebimentos deveria trazer 1 linha, trouxe %s', n)); end if;

  -- ---------------- Limpeza ----------------
  execute 'reset role';
  delete from auth.users where id = usuario;

  if cardinality(falhas) > 0 then
    raise exception 'TESTE FALHOU: %', array_to_string(falhas, ' | ');
  end if;
end;
$$;
