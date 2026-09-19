-- Primer saque persistido, sorteo de una sola vez y turnos calculados por la base.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.como(p_carnet text) returns void language plpgsql as $$
declare v uuid;
begin
  select id into v from public.usuario where carnet = p_carnet;
  if v is null then raise exception 'Falta el usuario de prueba %', p_carnet; end if;
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
end; $$;

create or replace function pg_temp.exige_error(p_sql text, p_error text, p_que text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_error in sqlerrm) = 0 then
      raise exception 'Falló por otra razón al probar %: %', p_que, sqlerrm;
    end if;
    return;
  end;
  raise exception 'AGUJERO: no falló y debía fallar: %', p_que;
end; $$;

do $$
declare m public.marcador%rowtype; anterior public.marcador%rowtype; lado text;
begin
  perform pg_temp.como('20002');
  foreach lado in array array['a', 'b'] loop
    m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, 11::smallint);
    if m.primer_saque is not null then
      raise exception 'AGUJERO: un marcador nuevo ya eligió el primer saque';
    end if;
    anterior := m;
    m := public.elegir_saque_marcador(m.id, lado);
    if m.primer_saque is distinct from lado or m.saca is distinct from lado
       or m.version <> anterior.version + 1 then
      raise exception 'AGUJERO: no guardó la elección % con una nueva versión', lado;
    end if;
    if m.puntos_a <> 0 or m.puntos_b <> 0 or m.sets_a <> 0 or m.sets_b <> 0
       or m.historial <> '[]'::jsonb then
      raise exception 'AGUJERO: elegir el saque cambió el tanteo';
    end if;
    anterior := m;
    m := public.elegir_saque_marcador(m.id, case when lado = 'a' then 'b' else 'a' end);
    if m is distinct from anterior then
      raise exception 'AGUJERO: un segundo toque cambió una elección ya guardada';
    end if;
  end loop;
  m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, 11::smallint);
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L, ''c'')', m.id),
    'Elegí uno de los dos jugadores', 'elegir un lado inexistente');
  reset role;
  raise notice 'ok · se puede elegir A o B, una sola vez y sin cambiar los puntos';
end $$;

do $$
declare m public.marcador%rowtype; anterior public.marcador%rowtype; i integer;
begin
  perform pg_temp.como('20002');
  for i in 1..12 loop
    m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, 11::smallint);
    -- La omisión del argumento es la petición de sorteo.
    m := public.elegir_saque_marcador(m.id);
    if m.primer_saque is null or m.primer_saque not in ('a', 'b')
       or m.saca is distinct from m.primer_saque or m.version <> 1 then
      raise exception 'AGUJERO: el sorteo no dejó una elección persistida';
    end if;
    select * into anterior from public.marcador where id = m.id;
    m := public.elegir_saque_marcador(m.id);
    if m is distinct from anterior then
      raise exception 'AGUJERO: reintentar el sorteo lo volvió a hacer o cambió la versión';
    end if;
  end loop;
  reset role;
  raise notice 'ok · el sorteo se guarda y los reintentos devuelven exactamente el mismo estado';
end $$;

do $$
declare m public.marcador%rowtype; lado text; esperado text; e record;
begin
  perform pg_temp.como('20002');
  foreach lado in array array['a', 'b'] loop
    m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, 11::smallint);
    m := public.elegir_saque_marcador(m.id, lado);
    for e in select * from (values
      (0, 0, 0, 0, '[]', 'a'),
      (1, 0, 0, 0, '[]', 'a'),
      (1, 1, 0, 0, '[]', 'b'),
      (2, 1, 0, 0, '[]', 'b'),
      (2, 2, 0, 0, '[]', 'a'),
      (9, 9, 0, 0, '[]', 'b'),
      (10, 9, 0, 0, '[]', 'b'),
      (10, 10, 0, 0, '[]', 'a'),
      (11, 10, 0, 0, '[]', 'b'),
      (11, 11, 0, 0, '[]', 'a'),
      -- Deshacer recupera el turno de saque anterior.
      (11, 10, 0, 0, '[]', 'b'),
      (0, 0, 1, 0, '[[13,11]]', 'b'),
      (1, 1, 1, 0, '[[13,11]]', 'a'),
      (10, 10, 1, 0, '[[13,11]]', 'b'),
      (11, 10, 1, 0, '[[13,11]]', 'a'),
      (0, 0, 1, 1, '[[13,11],[7,11]]', 'a')
    ) as casos(pa, pb, sa, sb, historial, saque_con_a) loop
      esperado := case when lado = 'a' then e.saque_con_a
        when e.saque_con_a = 'a' then 'b' else 'a' end;
      -- El cliente manda adrede el turno equivocado: la base debe corregirlo.
      m := public.sincronizar_marcador(m.id, m.version + 1,
        e.pa::smallint, e.pb::smallint, e.sa::smallint, e.sb::smallint,
        e.historial::jsonb, case when esperado = 'a' then 'b' else 'a' end, 'en_juego');
      if m.saca is distinct from esperado or m.primer_saque is distinct from lado then
        raise exception 'AGUJERO: primer saque %, puntos %-%, sets %-%: esperaba %, recibió %',
          lado, e.pa, e.pb, e.sa, e.sb, esperado, m.saca;
      end if;
    end loop;
  end loop;
  reset role;
  raise notice 'ok · alterna cada dos puntos, cada uno desde 10-10, entre sets y al deshacer';
end $$;

do $$
declare m public.marcador%rowtype; objetivo integer; e record; esperado text;
begin
  perform pg_temp.como('20002');
  foreach objetivo in array array[5, 6, 21] loop
    m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, objetivo::smallint);
    m := public.elegir_saque_marcador(m.id, 'a');
    for e in select * from (values
      (objetivo - 1, objetivo - 1, 0),
      (objetivo, objetivo - 1, 1),
      (objetivo, objetivo, 0)
    ) as casos(pa, pb, cambio) loop
      esperado := case when (objetivo - 1 + e.cambio) % 2 = 0 then 'a' else 'b' end;
      m := public.sincronizar_marcador(m.id, m.version + 1,
        e.pa::smallint, e.pb::smallint, 0::smallint, 0::smallint, '[]'::jsonb,
        case when esperado = 'a' then 'b' else 'a' end, 'en_juego');
      if m.saca is distinct from esperado then
        raise exception 'AGUJERO: jugando a %, en %-%, esperaba % y recibió %',
          objetivo, e.pa, e.pb, esperado, m.saca;
      end if;
    end loop;
  end loop;
  reset role;
  raise notice 'ok · el cambio a un punto por saque respeta también los formatos a 5, 6 y 21';
end $$;

do $$
declare m public.marcador%rowtype; anterior public.marcador%rowtype;
begin
  perform pg_temp.como('20002');
  m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, 11::smallint);
  m := public.elegir_saque_marcador(m.id, 'b');
  m := public.sincronizar_marcador(m.id, m.version + 1,
    2::smallint, 0::smallint, 0::smallint, 0::smallint, '[]'::jsonb, 'a', 'en_juego');
  anterior := m;
  m := public.elegir_saque_marcador(m.id, 'a');
  if m is distinct from anterior then
    raise exception 'AGUJERO: repetir la elección durante el partido cambió el tanteo o el primer saque';
  end if;

  m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, 11::smallint);
  m := public.sincronizar_marcador(m.id, m.version + 1,
    1::smallint, 0::smallint, 0::smallint, 0::smallint, '[]'::jsonb, 'b', 'en_juego');
  if m.primer_saque is not null or m.saca is distinct from 'b' then
    raise exception 'AGUJERO: rompió la sincronización de un cliente anterior';
  end if;
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'El partido ya empezó', 'sortear por primera vez cuando ya hay puntos');
  reset role;
  update public.marcador set puntos_a = 0, sets_a = 1 where id = m.id;
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L, ''a'')', m.id),
    'El partido ya empezó', 'elegir por primera vez cuando ya hay sets');
  reset role;
  update public.marcador set sets_a = 0, historial = '[[11,4]]'::jsonb where id = m.id;
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L, ''b'')', m.id),
    'El partido ya empezó', 'elegir por primera vez cuando ya hay historial');
  reset role;
  raise notice 'ok · conserva clientes anteriores y nunca cambia el primer saque con progreso';
end $$;

do $$
declare m public.marcador%rowtype;
begin
  perform pg_temp.como('20002');
  m := public.abrir_marcador_libre('Uno', 'Dos', 3::smallint, 11::smallint);
  reset role;
  perform pg_temp.como('20003');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'Este marcador lo lleva otra persona', 'sortear en un marcador ajeno');
  reset role;

  update public.usuario set activo = false where carnet = '20002';
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'Tu cuenta está dada de baja', 'sortear con una cuenta inactiva');
  reset role;
  update public.usuario set activo = true where carnet = '20002';

  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'permission denied for function elegir_saque_marcador', 'sortear sin sesión');
  reset role;
  perform pg_temp.como('20001');
  m := public.elegir_saque_marcador(m.id, 'b');
  if m.primer_saque is distinct from 'b' then
    raise exception 'AGUJERO: el coordinador no pudo elegir el primer saque';
  end if;
  reset role;
  raise notice 'ok · solo el dueño activo o el coordinador eligen el saque; anon no ejecuta la RPC';
end $$;

do $$
declare m public.marcador%rowtype;
begin
  perform pg_temp.como('20002');
  m := public.abrir_marcador_libre('Uno', 'Dos', 1::smallint, 11::smallint);
  m := public.sincronizar_marcador(m.id, m.version + 1,
    0::smallint, 0::smallint, 0::smallint, 0::smallint, '[]'::jsonb, 'a', 'abandonado');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'El marcador ya está abandonado', 'sortear un marcador abandonado');
  m := public.abrir_marcador_libre('Uno', 'Dos', 1::smallint, 11::smallint);
  m := public.elegir_saque_marcador(m.id, 'a');
  m := public.sincronizar_marcador(m.id, m.version + 1,
    0::smallint, 0::smallint, 1::smallint, 0::smallint, '[[11,4]]'::jsonb, 'a', 'terminado');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'El marcador ya está terminado', 'volver a sortear un marcador terminado');
  reset role;
  raise notice 'ok · no elige ni sortea el saque en marcadores terminados o abandonados';
end $$;

do $$
declare m public.marcador%rowtype; t uuid; p uuid;
begin
  insert into public.torneo(semestre_id, nombre, formato, estado)
    select id, 'Primer saque ' || gen_random_uuid(), 'llave', 'en_juego'
      from public.semestre limit 1
    returning id into t;
  insert into public.partido(torneo_id, tipo, jugador_a, jugador_b)
    select t, 'llave', a.id, b.id
      from public.usuario a, public.usuario b
     where a.carnet = '20002' and b.carnet = '20003'
    returning id into p;
  perform pg_temp.como('20002');
  m := public.abrir_marcador_de_partido(p);
  reset role;
  update public.torneo set estado = 'cancelado' where id = t;
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'está cancelado', 'sortear en un torneo cancelado');
  reset role;
  update public.torneo set estado = 'cerrado' where id = t;
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'ya terminó', 'sortear en un torneo cerrado');
  reset role;
  update public.torneo set estado = 'en_juego' where id = t;
  update public.partido set estado = 'anulado' where id = p;
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.elegir_saque_marcador(%L)', m.id),
    'ya quedó firme', 'sortear un partido anulado');
  reset role;
  raise notice 'ok · respeta los cierres y cancelaciones del partido y su torneo';
end $$;

rollback;
