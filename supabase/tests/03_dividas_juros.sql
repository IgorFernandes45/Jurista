-- =====================================================================
-- Teste das dividas e do calculo de juros
-- Rodar no SQL Editor DEPOIS das migrations 0001, 0002 e 0003.
-- Resultado esperado: "Success. No rows returned".
-- Se algo falhar, aparece um erro comecando com "TESTE FALHOU".
-- Nao deixa nenhum dado no banco.
-- =====================================================================
do $$
declare
  usuario   constant uuid := 'dddddddd-0000-4000-8000-00000000000d';
  hoje      constant date := date '2026-03-10';
  devedor   uuid;
  divida    uuid;
  parcela   uuid;
  n         numeric;
  d         date;
  falhas    text[] := '{}';
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (usuario, 'authenticated', 'authenticated', 'teste-dividas@local', '{}', '{"nome":"Teste"}', now(), now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);

  execute $q$ insert into public.devedores (nome) values ('Devedor Teste') returning id $q$ into devedor;

  -- ============ Exemplos do plano ============
  -- 1% ao dia, 5 dias de atraso sobre R$ 1.000 = R$ 50
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Exemplo 1', null, null, 'percentual_dia', 1) $q$
    into divida using devedor, hoje - 5;
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 50 then falhas := array_append(falhas, format('1%%/dia por 5 dias deveria dar 50, deu %s', n)); end if;

  execute 'select total_devido from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 1050 then falhas := array_append(falhas, format('total deveria ser 1050, e %s', n)); end if;

  -- 5% ao mes, 15 dias de atraso sobre R$ 1.000 = R$ 25
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Exemplo 2', null, null, 'percentual_mes', 5) $q$
    into divida using devedor, hoje - 15;
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 25 then falhas := array_append(falhas, format('5%%/mes por 15 dias deveria dar 25, deu %s', n)); end if;

  -- Multa fixa R$ 20 + 0,5% ao dia por 10 dias sobre R$ 1.000 = R$ 70
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Exemplo 3', null, null, 'multa_mais_dia', 0.5, 20) $q$
    into divida using devedor, hoje - 10;
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 70 then falhas := array_append(falhas, format('multa 20 + 0,5%%/dia por 10 dias deveria dar 70, deu %s', n)); end if;

  -- Valor cheio digitado a mao = R$ 80, nao importa quantos dias
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Exemplo 4', null, null, 'manual', 0, 0, 80) $q$
    into divida using devedor, hoje - 30;
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 80 then falhas := array_append(falhas, format('juros manual deveria dar 80, deu %s', n)); end if;

  -- ============ Carencia ============
  -- 5 dias corridos, 3 de carencia => juros de 2 dias = R$ 20
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Carencia', null, null, 'percentual_dia', 1, 0, 0, 3) $q$
    into divida using devedor, hoje - 5;
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 20 then falhas := array_append(falhas, format('com 3 dias de carencia deveria dar 20, deu %s', n)); end if;

  -- Dentro da carencia, nenhum juros
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje - 3;
  if n <> 0 then falhas := array_append(falhas, format('dentro da carencia deveria dar 0, deu %s', n)); end if;

  -- Antes do vencimento, nenhum juros
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje - 10;
  if n <> 0 then falhas := array_append(falhas, format('antes do vencimento deveria dar 0, deu %s', n)); end if;

  -- ============ Parcelada: base parcela x base saldo devedor ============
  -- 3 parcelas de 100, as duas primeiras vencidas ha 10 e 5 dias, 1%/dia sobre cada parcela
  execute $q$ select public.criar_divida($1, 'parcelada', 300, $2, 'Parcelada', null, 3, 'percentual_dia', 1) $q$
    into divida using devedor, hoje - 10;

  execute 'select count(*) from public.parcelas where divida_id = $1' into n using divida;
  if n <> 3 then falhas := array_append(falhas, format('deveriam ser 3 parcelas, sao %s', n)); end if;

  -- 100 x 1% x 10 dias = 10 ; segunda parcela vence um mes depois, ainda nao venceu em 10/03
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 10 then falhas := array_append(falhas, format('juros da parcelada (base parcela) deveria ser 10, deu %s', n)); end if;

  -- Mesma divida com base no saldo devedor: 300 x 1% x 10 dias = 30
  execute $q$ update public.divida_juros set base = 'saldo_devedor' where divida_id = $1 $q$ using divida;
  execute 'select juros_acumulado from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 30 then falhas := array_append(falhas, format('juros da parcelada (base saldo) deveria ser 30, deu %s', n)); end if;

  -- Arredondamento: 100 dividido em 3 parcelas
  execute $q$ select public.criar_divida($1, 'parcelada', 100, $2, 'Arredondamento', null, 3, 'sem_juros') $q$
    into divida using devedor, hoje;
  execute 'select sum(valor) from public.parcelas where divida_id = $1' into n using divida;
  if n <> 100 then falhas := array_append(falhas, format('a soma das parcelas deveria fechar 100, deu %s', n)); end if;

  -- ============ Vencimento em meses curtos ============
  -- 31 de janeiro + 1 mes = ultimo dia de fevereiro
  execute $q$ select public.vencimento_mes(date '2026-01-31', 1, 31) $q$ into d;
  if d <> date '2026-02-28' then falhas := array_append(falhas, format('31/01 + 1 mes deveria virar 28/02/2026, virou %s', d)); end if;
  execute $q$ select public.vencimento_mes(date '2024-01-31', 1, 31) $q$ into d;
  if d <> date '2024-02-29' then falhas := array_append(falhas, format('em ano bissexto deveria virar 29/02/2024, virou %s', d)); end if;

  -- ============ Recorrente ============
  execute $q$ select public.criar_divida($1, 'recorrente', 200, $2, 'Mensalidade', 10, null, 'sem_juros') $q$
    into divida using devedor, date '2026-01-10';

  execute 'select count(*) from public.parcelas where divida_id = $1' into n using divida;
  if n <> 1 then falhas := array_append(falhas, format('recorrente deveria comecar com 1 parcela, tem %s', n)); end if;

  execute 'select public.gerar_recorrentes($1)' using hoje;
  execute 'select count(*) from public.parcelas where divida_id = $1' into n using divida;
  if n <> 3 then falhas := array_append(falhas, format('em 10/03 a recorrente deveria ter 3 mensalidades, tem %s', n)); end if;

  -- Rodar de novo nao pode duplicar
  execute 'select public.gerar_recorrentes($1)' using hoje;
  execute 'select count(*) from public.parcelas where divida_id = $1' into n using divida;
  if n <> 3 then falhas := array_append(falhas, format('rodar de novo duplicou as mensalidades: %s', n)); end if;

  -- Encerrando a recorrencia, para de gerar
  execute $q$ update public.dividas set recorrencia_ativa = false where id = $1 $q$ using divida;
  execute 'select public.gerar_recorrentes($1)' using hoje + 60;
  execute 'select count(*) from public.parcelas where divida_id = $1' into n using divida;
  if n <> 3 then falhas := array_append(falhas, format('recorrencia encerrada continuou gerando: %s', n)); end if;

  -- ============ Pagamento abate juros e principal ============
  execute $q$ select public.criar_divida($1, 'a_vista', 1000, $2, 'Com pagamento', null, null, 'percentual_dia', 1) $q$
    into divida using devedor, hoje - 5;
  select id into parcela from public.parcelas where divida_id = divida;

  -- paga os 50 de juros e 200 do principal
  execute $q$ insert into public.pagamentos (divida_id, parcela_id, data, valor_principal, valor_juros)
              values ($1, $2, $3, 200, 50) $q$ using divida, parcela, hoje;

  execute 'select principal_restante from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 800 then falhas := array_append(falhas, format('principal deveria cair para 800, e %s', n)); end if;

  execute 'select total_devido from public.saldo_divida($1, $2)' into n using divida, hoje;
  -- juros do dia recalculados sobre 800: 800 x 1%% x 5 = 40, menos os 50 ja pagos => 0
  if n <> 800 then falhas := array_append(falhas, format('total devido deveria ser 800, e %s', n)); end if;

  execute 'select public.atualizar_status_divida($1)' using divida;
  execute $q$ select count(*) from public.dividas where id = $1 and status = 'parcial' $q$ into n using divida;
  if n <> 1 then falhas := array_append(falhas, 'apos pagamento parcial o status deveria ser parcial'); end if;

  -- quitando o restante
  execute $q$ insert into public.pagamentos (divida_id, parcela_id, data, valor_principal, valor_juros)
              values ($1, $2, $3, 800, 0) $q$ using divida, parcela, hoje;
  execute 'select public.atualizar_status_divida($1)' using divida;

  execute 'select total_devido from public.saldo_divida($1, $2)' into n using divida, hoje;
  if n <> 0 then falhas := array_append(falhas, format('apos quitar, o total deveria ser 0, e %s', n)); end if;

  execute $q$ select count(*) from public.dividas where id = $1 and status = 'quitada' $q$ into n using divida;
  if n <> 1 then falhas := array_append(falhas, 'a divida deveria ficar com status quitada'); end if;

  execute $q$ select count(*) from public.parcelas where divida_id = $1 and pago $q$ into n using divida;
  if n <> 1 then falhas := array_append(falhas, 'a parcela deveria ficar marcada como paga'); end if;

  -- ============ Validacoes ============
  begin
    execute $q$ select public.criar_divida($1, 'a_vista', 0, $2) $q$ using devedor, hoje;
    falhas := array_append(falhas, 'aceitou divida com valor zero');
  exception when raise_exception then null;
  end;

  begin
    execute $q$ select public.criar_divida($1, 'parcelada', 100, $2, null, null, 1) $q$ using devedor, hoje;
    falhas := array_append(falhas, 'aceitou parcelada com 1 parcela');
  exception when raise_exception then null;
  end;

  -- ============ Limpeza ============
  execute 'reset role';
  delete from auth.users where id = usuario;

  if cardinality(falhas) > 0 then
    raise exception 'TESTE FALHOU: %', array_to_string(falhas, ' | ');
  end if;
end;
$$;
