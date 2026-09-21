-- =====================================================================
-- Teste das vendas (registrar, editar, cancelar)
-- Rodar no SQL Editor DEPOIS das migrations 0001 e 0002.
-- Resultado esperado: "Success. No rows returned".
-- Se algo falhar, aparece um erro começando com "TESTE FALHOU".
-- Não deixa nenhum dado no banco.
-- =====================================================================
do $$
declare
  usuario    constant uuid := 'cccccccc-0000-4000-8000-00000000000c';
  produto_a  uuid;
  produto_b  uuid;
  venda_id   uuid;
  n          numeric;
  falhas     text[] := '{}';
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (usuario, 'authenticated', 'authenticated', 'teste-vendas@local', '{}', '{"nome":"Teste"}', now(), now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);

  execute $q$ insert into public.produtos (nome, preco_venda, preco_custo) values ('Camiseta', 50, 20) returning id $q$ into produto_a;
  execute $q$ insert into public.produtos (nome, preco_venda, preco_custo) values ('Boné', 30, 10) returning id $q$ into produto_b;
  execute $q$ insert into public.movimentos_estoque (produto_id, tipo, quantidade) values ($1, 'entrada', 10) $q$ using produto_a;
  execute $q$ insert into public.movimentos_estoque (produto_id, tipo, quantidade) values ($1, 'entrada', 10) $q$ using produto_b;

  -- ---------------- Registrar ----------------
  execute $q$ select public.registrar_venda(
      jsonb_build_array(
        jsonb_build_object('produto_id', $1, 'quantidade', 2, 'preco_unit', 50),
        jsonb_build_object('produto_id', $2, 'quantidade', 1, 'preco_unit', 25)
      ),
      now(), 'Maria', '11999999999', null, 5, null) $q$
    into venda_id using produto_a, produto_b;

  execute 'select total from public.vendas where id = $1' into n using venda_id;
  if n <> 120 then falhas := array_append(falhas, format('total deveria ser 120 (100 + 25 - 5), é %s', n)); end if;

  execute 'select estoque_atual from public.produtos where id = $1' into n using produto_a;
  if n <> 8 then falhas := array_append(falhas, format('estoque da Camiseta deveria ser 8, é %s', n)); end if;

  execute 'select estoque_atual from public.produtos where id = $1' into n using produto_b;
  if n <> 9 then falhas := array_append(falhas, format('estoque do Boné deveria ser 9, é %s', n)); end if;

  -- preço editado na venda (25 em vez dos 30 do cadastro) deve valer
  execute 'select preco_unit from public.venda_itens where venda_id = $1 and produto_id = $2' into n using venda_id, produto_b;
  if n <> 25 then falhas := array_append(falhas, format('preço do item deveria ser 25, é %s', n)); end if;

  -- custo guardado no item, para o relatório de lucro não mudar depois
  execute 'select preco_custo_unit from public.venda_itens where venda_id = $1 and produto_id = $2' into n using venda_id, produto_a;
  if n <> 20 then falhas := array_append(falhas, format('custo do item deveria ser 20, é %s', n)); end if;

  -- ---------------- Editar ----------------
  execute $q$ select public.editar_venda($1,
      jsonb_build_array(jsonb_build_object('produto_id', $2, 'quantidade', 5, 'preco_unit', 50)),
      null, 'Maria Souza', null, null, 0, null) $q$
    using venda_id, produto_a;

  execute 'select estoque_atual from public.produtos where id = $1' into n using produto_a;
  if n <> 5 then falhas := array_append(falhas, format('após editar para 5 unidades, estoque deveria ser 5, é %s', n)); end if;

  execute 'select estoque_atual from public.produtos where id = $1' into n using produto_b;
  if n <> 10 then falhas := array_append(falhas, format('Boné saiu da venda, estoque deveria voltar a 10, é %s', n)); end if;

  execute 'select total from public.vendas where id = $1' into n using venda_id;
  if n <> 250 then falhas := array_append(falhas, format('total após edição deveria ser 250, é %s', n)); end if;

  execute 'select count(*) from public.venda_itens where venda_id = $1' into n using venda_id;
  if n <> 1 then falhas := array_append(falhas, format('venda deveria ter 1 item após a edição, tem %s', n)); end if;

  -- ---------------- Cancelar ----------------
  execute 'select public.cancelar_venda($1)' using venda_id;

  execute 'select estoque_atual from public.produtos where id = $1' into n using produto_a;
  if n <> 10 then falhas := array_append(falhas, format('após cancelar, estoque deveria voltar a 10, é %s', n)); end if;

  execute $q$ select count(*) from public.movimentos_estoque where venda_id = $1 and origem = 'cancelamento_venda' $q$
    into n using venda_id;
  if n <> 1 then falhas := array_append(falhas, 'o cancelamento deveria gerar movimento de entrada no histórico'); end if;

  -- Cancelar de novo deve ser recusado
  begin
    execute 'select public.cancelar_venda($1)' using venda_id;
    falhas := array_append(falhas, 'cancelou a mesma venda duas vezes');
  exception when raise_exception then null;
  end;

  -- Editar venda cancelada deve ser recusado
  begin
    execute $q$ select public.editar_venda($1, jsonb_build_array(jsonb_build_object('produto_id', $2, 'quantidade', 1, 'preco_unit', 10))) $q$
      using venda_id, produto_a;
    falhas := array_append(falhas, 'editou uma venda cancelada');
  exception when raise_exception then null;
  end;

  -- ---------------- Regras de validação ----------------
  -- Venda sem itens
  begin
    execute $q$ select public.registrar_venda('[]'::jsonb) $q$;
    falhas := array_append(falhas, 'registrou venda sem itens');
  exception when raise_exception then null;
  end;

  -- Desconto maior que o total
  begin
    execute $q$ select public.registrar_venda(
        jsonb_build_array(jsonb_build_object('produto_id', $1, 'quantidade', 1, 'preco_unit', 10)),
        now(), null, null, null, 999) $q$ using produto_a;
    falhas := array_append(falhas, 'aceitou desconto maior que o total');
  exception when raise_exception then null;
  end;

  -- Quantidade zero
  begin
    execute $q$ select public.registrar_venda(
        jsonb_build_array(jsonb_build_object('produto_id', $1, 'quantidade', 0, 'preco_unit', 10))) $q$ using produto_a;
    falhas := array_append(falhas, 'aceitou quantidade zero');
  exception when raise_exception then null;
  end;

  -- Produto inexistente
  begin
    execute $q$ select public.registrar_venda(
        jsonb_build_array(jsonb_build_object('produto_id', '00000000-0000-4000-8000-000000000000', 'quantidade', 1, 'preco_unit', 10))) $q$;
    falhas := array_append(falhas, 'aceitou produto que não existe');
  exception when raise_exception then null;
  end;

  -- Venda sem estoque é permitida (fica negativo, com aviso na tela)
  execute $q$ select public.registrar_venda(
      jsonb_build_array(jsonb_build_object('produto_id', $1, 'quantidade', 99, 'preco_unit', 50))) $q$ using produto_a;
  execute 'select estoque_atual from public.produtos where id = $1' into n using produto_a;
  if n <> -89 then falhas := array_append(falhas, format('venda sem estoque deveria deixar -89, deixou %s', n)); end if;

  -- Nenhuma venda recusada pode ter sobrado pela metade
  execute 'select count(*) from public.vendas' into n;
  if n <> 2 then falhas := array_append(falhas, format('deveriam existir 2 vendas (1 cancelada + 1 sem estoque), existem %s', n)); end if;

  -- ---------------- Limpeza ----------------
  execute 'reset role';
  delete from auth.users where id = usuario;

  if cardinality(falhas) > 0 then
    raise exception 'TESTE FALHOU: %', array_to_string(falhas, ' | ');
  end if;
end;
$$;
