-- =====================================================================
-- MIGRACIÓN 11: foto diaria de carga por persona (análisis de evolución)
-- Pegar todo en: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- Una fila por persona y por día: cuánto tenía abierto, cuánto cerró
-- y cuánta actividad operativa registró. Se toma sola cada noche.
create table public.daily_snapshots (
  day date not null,
  owner uuid not null references public.profiles(id) on delete cascade,
  open_count int not null default 0,
  open_effort int not null default 0,
  done_count int not null default 0,   -- cerradas ESE día
  done_effort int not null default 0,
  activity_qty int not null default 0, -- actividad operativa ESE día
  primary key (day, owner)
);

alter table public.daily_snapshots enable row level security;
create policy "ver fotos propias o ser jefe" on public.daily_snapshots
  for select to authenticated using (owner = auth.uid() or public.is_jefe());

create or replace function public.take_snapshot()
returns void language sql security definer set search_path = public as $$
  -- todo en fecha ARGENTINA (el cron corre 02:40 UTC = 23:40 ART del día que se fotografía)
  insert into daily_snapshots (day, owner, open_count, open_effort, done_count, done_effort, activity_qty)
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date, p.id,
    count(c.id) filter (where c.status <> 'term' and c.card_type = 'normal'),
    coalesce(sum(c.effort) filter (where c.status <> 'term' and c.card_type = 'normal'), 0),
    count(c.id) filter (where c.status = 'term'
      and (c.done_at at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date),
    coalesce(sum(c.effort) filter (where c.status = 'term'
      and (c.done_at at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date), 0),
    coalesce((select sum(a.qty) from activity_log a where a.owner = p.id
      and (a.at at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date), 0)
  from profiles p left join cards c on c.owner = p.id
  group by p.id
  on conflict (day, owner) do update set
    open_count = excluded.open_count, open_effort = excluded.open_effort,
    done_count = excluded.done_count, done_effort = excluded.done_effort,
    activity_qty = excluded.activity_qty;
$$;

-- todas las noches a las 02:40 UTC (~23:40 Argentina)
select cron.schedule('snapshot-diario', '40 2 * * *', 'select public.take_snapshot()');

-- primera foto ahora mismo, para arrancar la serie
select public.take_snapshot();

select 'ok — filas de hoy: ' || count(*) from public.daily_snapshots where day = current_date;
