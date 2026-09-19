-- El primer saque se elige una sola vez, a mano o por sorteo. Después el
-- servidor deriva los turnos de los puntos y los sets, también al deshacer.
alter table public.marcador
  add column primer_saque text constraint marcador_primer_saque
    check (primer_saque is null or primer_saque in ('a', 'b'));

comment on column public.marcador.primer_saque is
  'Quién comenzó sacando en el primer set. Null cuando todavía falta elegirlo.';

-- El marcador anterior comenzaba siempre con A. Los que ya se usaron deben
-- poder continuar sin pedir una elección a mitad del partido.
update public.marcador
   set primer_saque = 'a'
 where version > 0 or puntos_a > 0 or puntos_b > 0
    or sets_a > 0 or sets_b > 0 or historial <> '[]'::jsonb
    or estado <> 'en_juego';

create or replace function public.elegir_saque_marcador(
  p_marcador_id uuid, p_saca text default null
)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.marcador%rowtype;
  v_yo uuid;
  v_saca text;
begin
  v_yo := public.exigir_activo();
  select * into m from public.marcador where id = p_marcador_id for update;
  if m.id is null then raise exception 'Marcador no existe'; end if;
  if m.dueno <> v_yo and not public.es_coordinador() then
    raise exception 'Este marcador lo lleva otra persona' using errcode = '42501';
  end if;
  if m.partido_id is not null then
    perform public.exigir_partido_jugable(m.partido_id);
    if exists (
      select 1 from public.partido p
       where p.id = m.partido_id and p.estado in ('confirmado', 'resuelto', 'anulado')
    ) then
      raise exception 'El resultado de ese partido ya quedó firme';
    end if;
  end if;
  if m.estado <> 'en_juego' then
    raise exception 'El marcador ya está %', m.estado;
  end if;
  if p_saca is not null and p_saca not in ('a', 'b') then
    raise exception 'Elegí uno de los dos jugadores';
  end if;

  -- Un doble toque o un reintento de red devuelve la misma elección. Nunca
  -- vuelve a sortear ni reemplaza los puntos que ya se estén jugando.
  if m.primer_saque is not null then return m; end if;
  if m.puntos_a > 0 or m.puntos_b > 0 or m.sets_a > 0 or m.sets_b > 0
     or m.historial <> '[]'::jsonb then
    raise exception 'El partido ya empezó; no se puede elegir el primer saque';
  end if;

  v_saca := coalesce(p_saca, case when random() < 0.5 then 'a' else 'b' end);
  update public.marcador
     set primer_saque = v_saca, saca = v_saca,
         version = m.version + 1, actualizado_en = now()
   where id = m.id
  returning * into m;
  return m;
end;
$$;

revoke execute on function public.elegir_saque_marcador(uuid, text) from public, anon;
grant execute on function public.elegir_saque_marcador(uuid, text) to authenticated;

-- Misma firma para que sigan funcionando los clientes anteriores. Conserva
-- todas las guardas y el puente al resultado; solo cambia el cálculo del saque.
create or replace function public.sincronizar_marcador(
  p_marcador_id uuid, p_version bigint, p_puntos_a smallint, p_puntos_b smallint,
  p_sets_a smallint, p_sets_b smallint, p_historial jsonb, p_saca text, p_estado text
)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.marcador%rowtype;
  v_yo uuid;
  v_est public.marcador_estado;
  v_error text;
  v_aviso text;
  v_saca text;
  v_turnos integer;
begin
  v_yo := public.exigir_activo();
  select * into m from public.marcador where id = p_marcador_id for update;
  if m.id is null then raise exception 'Marcador no existe'; end if;
  if m.dueno <> v_yo and not public.es_coordinador() then
    raise exception 'Este marcador lo lleva otra persona' using errcode = '42501';
  end if;

  if m.partido_id is not null and exists (
    select 1 from public.contenedor_de_partido(m.partido_id) c where c.estado = 'cancelado'
  ) then
    raise exception 'El ranking o torneo de este marcador está cancelado';
  end if;

  if p_version <= m.version then return m; end if;
  if p_version > m.version + 10000 then
    raise exception 'La versión % está demasiado adelante de la del servidor (%). Recargá el marcador', p_version, m.version;
  end if;
  if m.estado <> 'en_juego' then
    raise exception 'El marcador ya está %', m.estado;
  end if;

  v_est := coalesce(nullif(p_estado, ''), 'en_juego')::public.marcador_estado;
  if p_sets_a is null or p_sets_b is null or p_sets_a < 0 or p_sets_b < 0 then
    raise exception 'Los sets no pueden faltar ni ser negativos';
  end if;
  if p_sets_a >= m.sets_para_ganar and p_sets_b >= m.sets_para_ganar then
    raise exception 'Los dos no pueden llegar a % sets en el mismo partido', m.sets_para_ganar;
  end if;
  if greatest(p_sets_a, p_sets_b) > m.sets_para_ganar then
    raise exception 'Más sets de los que se juegan (al mejor de %)', m.sets_para_ganar * 2 - 1;
  end if;
  v_error := public.historial_valido(p_historial, p_sets_a, p_sets_b, m.puntos_por_set);
  if v_error is not null then raise exception '%', v_error; end if;
  if v_est = 'terminado' and greatest(p_sets_a, p_sets_b) <> m.sets_para_ganar then
    raise exception 'El partido no terminó: va %-% y se juega a % sets', p_sets_a, p_sets_b, m.sets_para_ganar;
  end if;

  v_saca := nullif(p_saca, '');
  if m.primer_saque is not null then
    -- Dos puntos por turno; al llegar ambos a un punto del objetivo, uno.
    -- Se cuenta también la paridad de los turnos anteriores al empate.
    v_turnos := case
      when p_puntos_a >= m.puntos_por_set - 1 and p_puntos_b >= m.puntos_por_set - 1
        then p_puntos_a + p_puntos_b - (m.puntos_por_set - 1)
      else (p_puntos_a + p_puntos_b) / 2
    end;
    v_saca := case when (v_turnos + p_sets_a + p_sets_b) % 2 = 0
      then m.primer_saque
      when m.primer_saque = 'a' then 'b'
      else 'a'
    end;
  end if;

  update public.marcador set
    puntos_a = p_puntos_a,
    puntos_b = p_puntos_b,
    sets_a = p_sets_a,
    sets_b = p_sets_b,
    historial = p_historial,
    saca = v_saca,
    estado = v_est,
    version = p_version,
    actualizado_en = now()
  where id = m.id
  returning * into m;

  if v_est = 'terminado' and m.partido_id is not null then
    begin
      perform public.registrar_resultado(m.partido_id, p_sets_a, p_sets_b, p_historial);
    exception when others then
      v_aviso := sqlerrm;
    end;
    update public.marcador set aviso = v_aviso where id = m.id returning * into m;
  end if;
  return m;
end;
$$;

-- CREATE OR REPLACE conserva los permisos de sincronizar_marcador.
