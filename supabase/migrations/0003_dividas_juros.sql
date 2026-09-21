-- =====================================================================
-- Agencia Impar -- Dividas e juros (Sprint 4)
-- Cria as dividas (a vista, parcelada e recorrente), gera as parcelas
-- e calcula os juros dentro do banco, para o valor ser igual em todas as telas.
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================

-- Sobre o que os juros incidem, escolhido em cada divida
create type public.base_juros as enum ('parcela', 'saldo_devedor');

alter table public.divida_juros
  add column base public.base_juros not null default 'parcela';

-- ---------------------------------------------------------------------
-- Datas: ajusta o dia do vencimento para meses mais curtos (31 -> 30 -> 28/29)
-- ---------------------------------------------------------------------
create or replace function public.vencimento_mes(p_base date, p_meses integer, p_dia integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(
    extract(year  from (date_trunc('month', p_base) + make_interval(months => p_meses)))::int,
    extract(month from (date_trunc('month', p_base) + make_interval(months => p_meses)))::int,
    least(
      p_dia,
      extract(day from (date_trunc('month', p_base) + make_interval(months => p_meses + 1) - interval '1 day'))::int
    )
  );
$$;

-- ---------------------------------------------------------------------
-- Quanto ainda falta do valor original de uma parcela (sem juros)
-- ---------------------------------------------------------------------
create or replace function public.principal_restante_parcela(p_parcela_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select greatest(
    p.valor - coalesce((select sum(pg.valor_principal) from public.pagamentos pg where pg.parcela_id = p.id), 0),
    0)
  from public.parcelas p
  where p.id = p_parcela_id;
$$;

-- Quanto falta do valor original da divida inteira
create or replace function public.principal_restante_divida(p_divida_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select greatest(
    coalesce((select sum(p.valor) from public.parcelas p where p.divida_id = p_divida_id), 0)
    - coalesce((select sum(pg.valor_principal) from public.pagamentos pg where pg.divida_id = p_divida_id), 0),
    0);
$$;

-- ---------------------------------------------------------------------
-- Dias de atraso de uma parcela, ja descontada a carencia
-- ---------------------------------------------------------------------
create or replace function public.dias_atraso_parcela(p_parcela_id uuid, p_data date default current_date)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest((p_data - p.vencimento) - coalesce(j.carencia_dias, 0), 0)
  from public.parcelas p
  left join public.divida_juros j on j.divida_id = p.divida_id
  where p.id = p_parcela_id;
$$;

-- ---------------------------------------------------------------------
-- Juros acumulados de uma parcela ate a data informada
--   base 'parcela'       -> juros sobre o que falta daquela parcela
--   base 'saldo_devedor' -> juros sobre o saldo da divida inteira,
--                           contados uma unica vez, pela parcela vencida mais antiga
-- ---------------------------------------------------------------------
create or replace function public.juros_parcela(p_parcela_id uuid, p_data date default current_date)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_parcela   public.parcelas%rowtype;
  v_juros     public.divida_juros%rowtype;
  v_dias      integer;
  v_base      numeric(12,2);
  v_restante  numeric(12,2);
begin
  select * into v_parcela from public.parcelas where id = p_parcela_id;
  if not found then return 0; end if;

  select * into v_juros from public.divida_juros where divida_id = v_parcela.divida_id;
  if not found or v_juros.modo = 'sem_juros' then return 0; end if;

  v_restante := public.principal_restante_parcela(p_parcela_id);
  if v_restante <= 0 then return 0; end if;

  v_dias := public.dias_atraso_parcela(p_parcela_id, p_data);
  if v_dias <= 0 then return 0; end if;

  if v_juros.base = 'saldo_devedor' then
    -- so a parcela vencida mais antiga carrega os juros, para nao contar duas vezes
    if exists (
      select 1
        from public.parcelas outra
       where outra.divida_id = v_parcela.divida_id
         and outra.id <> v_parcela.id
         and public.principal_restante_parcela(outra.id) > 0
         and (outra.vencimento < v_parcela.vencimento
              or (outra.vencimento = v_parcela.vencimento and outra.numero < v_parcela.numero))
         and public.dias_atraso_parcela(outra.id, p_data) > 0
    ) then
      return 0;
    end if;
    v_base := public.principal_restante_divida(v_parcela.divida_id);
  else
    v_base := v_restante;
  end if;

  return round(
    case v_juros.modo
      when 'percentual_dia'  then v_base * (v_juros.taxa_percent / 100) * v_dias
      when 'percentual_mes'  then v_base * (v_juros.taxa_percent / 100) * (v_dias::numeric / 30)
      when 'multa_mais_dia'  then v_juros.multa_fixa + v_base * (v_juros.taxa_percent / 100) * v_dias
      when 'manual'          then v_juros.valor_manual
      else 0
    end, 2);
end;
$$;

-- ---------------------------------------------------------------------
-- Situacao completa de uma divida numa data
-- ---------------------------------------------------------------------
create or replace function public.saldo_divida(p_divida_id uuid, p_data date default current_date)
returns table (
  principal_restante  numeric,
  juros_acumulado     numeric,
  juros_pago          numeric,
  juros_em_aberto     numeric,
  total_devido        numeric,
  dias_atraso         integer,
  proximo_vencimento  date
)
language sql
stable
set search_path = ''
as $$
  with parcelas_abertas as (
    select p.id, p.vencimento
      from public.parcelas p
     where p.divida_id = p_divida_id
       and public.principal_restante_parcela(p.id) > 0
  ),
  calculo as (
    select
      public.principal_restante_divida(p_divida_id) as principal,
      coalesce((select sum(public.juros_parcela(pa.id, p_data)) from parcelas_abertas pa), 0) as juros,
      coalesce((select sum(pg.valor_juros) from public.pagamentos pg where pg.divida_id = p_divida_id), 0) as juros_pg,
      coalesce((select max(public.dias_atraso_parcela(pa.id, p_data)) from parcelas_abertas pa), 0) as atraso,
      (select min(pa.vencimento) from parcelas_abertas pa) as prox
  )
  select
    principal,
    juros,
    juros_pg,
    greatest(juros - juros_pg, 0),
    principal + greatest(juros - juros_pg, 0),
    atraso,
    prox
  from calculo;
$$;

-- ---------------------------------------------------------------------
-- Gera as parcelas de uma divida (usada ao criar e ao editar)
-- ---------------------------------------------------------------------
create or replace function public.gerar_parcelas(p_divida_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_divida    public.dividas%rowtype;
  v_qtd       integer;
  v_dia       integer;
  v_valor     numeric(12,2);
  v_ultima    numeric(12,2);
  i           integer;
begin
  select * into v_divida from public.dividas where id = p_divida_id;
  if not found then
    raise exception 'Divida nao encontrada.' using errcode = 'P0001';
  end if;

  delete from public.parcelas where divida_id = p_divida_id;

  v_dia := coalesce(v_divida.dia_pagamento, extract(day from v_divida.data_vencimento)::int);

  if v_divida.tipo = 'parcelada' then
    v_qtd := v_divida.num_parcelas;
    v_valor := round(v_divida.valor_original / v_qtd, 2);
    v_ultima := v_divida.valor_original - (v_valor * (v_qtd - 1));

    for i in 1 .. v_qtd loop
      insert into public.parcelas (divida_id, numero, valor, vencimento)
      values (
        p_divida_id,
        i,
        case when i = v_qtd then v_ultima else v_valor end,
        case when i = 1 then v_divida.data_vencimento
             else public.vencimento_mes(v_divida.data_vencimento, i - 1, v_dia) end
      );
    end loop;
    return v_qtd;
  end if;

  -- a vista e recorrente comecam com uma parcela; a recorrente ganha as proximas mes a mes
  insert into public.parcelas (divida_id, numero, valor, vencimento)
  values (p_divida_id, 1, v_divida.valor_original, v_divida.data_vencimento);
  return 1;
end;
$$;

-- ---------------------------------------------------------------------
-- Criar divida (divida + configuracao de juros + parcelas), tudo de uma vez
-- ---------------------------------------------------------------------
create or replace function public.criar_divida(
  p_devedor_id       uuid,
  p_tipo             public.tipo_divida,
  p_valor_original   numeric,
  p_data_vencimento  date,
  p_descricao        text default null,
  p_dia_pagamento    integer default null,
  p_num_parcelas     integer default null,
  p_modo_juros       public.modo_juros default 'sem_juros',
  p_taxa_percent     numeric default 0,
  p_multa_fixa       numeric default 0,
  p_valor_manual     numeric default 0,
  p_carencia_dias    integer default 0,
  p_base_juros       public.base_juros default 'parcela',
  p_observacao       text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_divida_id uuid;
  v_dia smallint;
begin
  if auth.uid() is null then
    raise exception 'Faca login para cadastrar dividas.' using errcode = '42501';
  end if;
  if p_valor_original is null or p_valor_original <= 0 then
    raise exception 'O valor da divida precisa ser maior que zero.' using errcode = 'P0001';
  end if;
  if p_tipo = 'parcelada' and coalesce(p_num_parcelas, 0) < 2 then
    raise exception 'Uma divida parcelada precisa de pelo menos 2 parcelas.' using errcode = 'P0001';
  end if;

  v_dia := coalesce(p_dia_pagamento, extract(day from p_data_vencimento)::smallint);

  insert into public.dividas (
    devedor_id, descricao, tipo, valor_original, dia_pagamento, data_vencimento,
    num_parcelas, recorrencia_ativa, observacao
  )
  values (
    p_devedor_id, nullif(trim(p_descricao), ''), p_tipo, p_valor_original, v_dia, p_data_vencimento,
    case when p_tipo = 'parcelada' then p_num_parcelas end,
    p_tipo = 'recorrente',
    nullif(trim(p_observacao), '')
  )
  returning id into v_divida_id;

  insert into public.divida_juros (divida_id, modo, taxa_percent, multa_fixa, valor_manual, carencia_dias, base)
  values (v_divida_id, p_modo_juros, coalesce(p_taxa_percent, 0), coalesce(p_multa_fixa, 0),
          coalesce(p_valor_manual, 0), coalesce(p_carencia_dias, 0), p_base_juros);

  perform public.gerar_parcelas(v_divida_id);
  return v_divida_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Editar divida. As parcelas so sao refeitas se ainda nao houver pagamento.
-- ---------------------------------------------------------------------
create or replace function public.editar_divida(
  p_divida_id        uuid,
  p_valor_original   numeric,
  p_data_vencimento  date,
  p_descricao        text default null,
  p_dia_pagamento    integer default null,
  p_num_parcelas     integer default null,
  p_modo_juros       public.modo_juros default 'sem_juros',
  p_taxa_percent     numeric default 0,
  p_multa_fixa       numeric default 0,
  p_valor_manual     numeric default 0,
  p_carencia_dias    integer default 0,
  p_base_juros       public.base_juros default 'parcela',
  p_observacao       text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_divida      public.dividas%rowtype;
  v_tem_pagto   boolean;
  v_dia         smallint;
begin
  select * into v_divida from public.dividas where id = p_divida_id;
  if not found then
    raise exception 'Divida nao encontrada.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.pagamentos where divida_id = p_divida_id) into v_tem_pagto;
  v_dia := coalesce(p_dia_pagamento, extract(day from p_data_vencimento)::smallint);

  update public.dividas
     set descricao       = nullif(trim(p_descricao), ''),
         valor_original  = case when v_tem_pagto then valor_original else p_valor_original end,
         data_vencimento = case when v_tem_pagto then data_vencimento else p_data_vencimento end,
         dia_pagamento   = v_dia,
         num_parcelas    = case when v_tem_pagto then num_parcelas
                                when tipo = 'parcelada' then p_num_parcelas end,
         observacao      = nullif(trim(p_observacao), '')
   where id = p_divida_id;

  update public.divida_juros
     set modo          = p_modo_juros,
         taxa_percent  = coalesce(p_taxa_percent, 0),
         multa_fixa    = coalesce(p_multa_fixa, 0),
         valor_manual  = coalesce(p_valor_manual, 0),
         carencia_dias = coalesce(p_carencia_dias, 0),
         base          = p_base_juros
   where divida_id = p_divida_id;

  -- Com pagamento lancado, as parcelas ficam como estao (da para editar uma a uma na tela)
  if not v_tem_pagto then
    perform public.gerar_parcelas(p_divida_id);
  end if;

  return p_divida_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Dividas recorrentes: cria as mensalidades que ja venceram e ainda nao existem.
-- Roda sob demanda (o app chama ao abrir) e tambem pode ser agendada.
-- ---------------------------------------------------------------------
create or replace function public.gerar_recorrentes(p_ate date default current_date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_divida      public.dividas%rowtype;
  v_ultimo      date;
  v_numero      integer;
  v_proximo     date;
  v_criadas     integer := 0;
begin
  for v_divida in
    select * from public.dividas
     where tipo = 'recorrente' and recorrencia_ativa and status <> 'cancelada'
  loop
    select max(vencimento), max(numero) into v_ultimo, v_numero
      from public.parcelas where divida_id = v_divida.id;

    v_ultimo := coalesce(v_ultimo, v_divida.data_vencimento);
    v_numero := coalesce(v_numero, 0);

    loop
      v_proximo := public.vencimento_mes(v_ultimo, 1, coalesce(v_divida.dia_pagamento, extract(day from v_ultimo)::int));
      exit when v_proximo > p_ate;

      v_numero := v_numero + 1;
      insert into public.parcelas (user_id, divida_id, numero, valor, vencimento)
      values (v_divida.user_id, v_divida.id, v_numero, v_divida.valor_original, v_proximo);

      v_criadas := v_criadas + 1;
      v_ultimo := v_proximo;
    end loop;
  end loop;

  return v_criadas;
end;
$$;

-- ---------------------------------------------------------------------
-- Atualiza o status da divida conforme parcelas e pagamentos
-- ---------------------------------------------------------------------
create or replace function public.atualizar_status_divida(p_divida_id uuid)
returns public.status_divida
language plpgsql
set search_path = ''
as $$
declare
  v_restante  numeric;
  v_pago      numeric;
  v_status    public.status_divida;
begin
  v_restante := public.principal_restante_divida(p_divida_id);
  select coalesce(sum(valor_principal + valor_juros), 0) into v_pago
    from public.pagamentos where divida_id = p_divida_id;

  v_status := case
    when v_restante <= 0 then 'quitada'
    when v_pago > 0 then 'parcial'
    else 'aberta'
  end;

  update public.dividas set status = v_status
   where id = p_divida_id and status <> 'cancelada';

  update public.parcelas p
     set pago = (public.principal_restante_parcela(p.id) <= 0)
   where p.divida_id = p_divida_id;

  return v_status;
end;
$$;

-- ---------------------------------------------------------------------
revoke execute on function public.vencimento_mes(date, integer, integer) from public, anon;
revoke execute on function public.principal_restante_parcela(uuid) from public, anon;
revoke execute on function public.principal_restante_divida(uuid) from public, anon;
revoke execute on function public.dias_atraso_parcela(uuid, date) from public, anon;
revoke execute on function public.juros_parcela(uuid, date) from public, anon;
revoke execute on function public.saldo_divida(uuid, date) from public, anon;
revoke execute on function public.gerar_parcelas(uuid) from public, anon;
revoke execute on function public.criar_divida(uuid, public.tipo_divida, numeric, date, text, integer, integer, public.modo_juros, numeric, numeric, numeric, integer, public.base_juros, text) from public, anon;
revoke execute on function public.editar_divida(uuid, numeric, date, text, integer, integer, public.modo_juros, numeric, numeric, numeric, integer, public.base_juros, text) from public, anon;
revoke execute on function public.gerar_recorrentes(date) from public, anon;
revoke execute on function public.atualizar_status_divida(uuid) from public, anon;

grant execute on function public.vencimento_mes(date, integer, integer) to authenticated;
grant execute on function public.principal_restante_parcela(uuid) to authenticated;
grant execute on function public.principal_restante_divida(uuid) to authenticated;
grant execute on function public.dias_atraso_parcela(uuid, date) to authenticated;
grant execute on function public.juros_parcela(uuid, date) to authenticated;
grant execute on function public.saldo_divida(uuid, date) to authenticated;
grant execute on function public.gerar_parcelas(uuid) to authenticated;
grant execute on function public.criar_divida(uuid, public.tipo_divida, numeric, date, text, integer, integer, public.modo_juros, numeric, numeric, numeric, integer, public.base_juros, text) to authenticated;
grant execute on function public.editar_divida(uuid, numeric, date, text, integer, integer, public.modo_juros, numeric, numeric, numeric, integer, public.base_juros, text) to authenticated;
grant execute on function public.gerar_recorrentes(date) to authenticated;
grant execute on function public.atualizar_status_divida(uuid) to authenticated;
