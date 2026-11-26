begin;

create table public.iwish_agenda_events (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  value jsonb not null,
  primary key (owner_id, id),
  constraint agenda_event_payload check ((
    jsonb_typeof(value) = 'object'
    and octet_length(value::text) <= 65536
    and value->>'id' = id::text
    and value->>'kind' in ('task', 'event')
    and jsonb_typeof(value->'title') = 'string'
    and char_length(btrim(value->>'title')) between 1 and 300
    and jsonb_typeof(value->'description') = 'string'
    and char_length(value->>'description') <= 1000
    and jsonb_typeof(value->'completed') = 'boolean'
    and jsonb_typeof(value->'history') = 'array'
    and value->>'priority' in ('1', '2', '3')
    and value->>'reminder_minutes' in ('0', '15', '30', '60', '1440', '10080')
    and value->>'starts_at' ~ '^\d{4}-\d{2}-\d{2}T'
    and (value->>'starts_at')::timestamptz is not null
  ) is true)
);

alter table public.iwish_agenda_events enable row level security;
revoke all on public.iwish_agenda_events from public, anon, authenticated;
grant select, insert, update on public.iwish_agenda_events to authenticated;

create policy agenda_select_own on public.iwish_agenda_events
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy agenda_insert_own on public.iwish_agenda_events
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy agenda_update_own on public.iwish_agenda_events
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create function public.iwish_agenda_sync(changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  change jsonb;
  event_id uuid;
  current_value jsonb;
  incoming jsonb;
  conflicts jsonb := '[]'::jsonb;
  result_rows jsonb;
begin
  if owner is null then
    raise exception 'Se requiere iniciar sesión' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) is distinct from 'array' then
    raise exception 'Cambios de Agenda inválidos' using errcode = '22023';
  end if;
  if jsonb_array_length(changes) > 5000 then
    raise exception 'Demasiados cambios de Agenda' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('iwish_agenda:' || owner::text, 0));
  for change in select value from jsonb_array_elements(changes)
  loop
    if change->>'bucket' is distinct from 'events' or
       jsonb_typeof(change->'value') is distinct from 'object' or not (change ? 'base') then
      raise exception 'Cambio de Agenda inválido' using errcode = '22023';
    end if;
    event_id := (change->>'id')::uuid;
    incoming := change->'value';
    select e.value into current_value
      from public.iwish_agenda_events e where e.owner_id = owner and e.id = event_id;

    if current_value is not distinct from incoming then
      continue;
    end if;
    if current_value is distinct from nullif(change->'base', 'null'::jsonb) then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('bucket', 'events', 'id', event_id));
      continue;
    end if;

    -- Compare again in the upsert, including writers using the table directly.
    insert into public.iwish_agenda_events as e(owner_id, id, value) values (owner, event_id, incoming)
    on conflict (owner_id, id) do update set value = excluded.value
      where e.value is not distinct from current_value or e.value = excluded.value;
    if not found then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('bucket', 'events', 'id', event_id));
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', 'events', 'id', e.id, 'value', e.value) order by e.id), '[]'::jsonb)
    into result_rows from public.iwish_agenda_events e where e.owner_id = owner;
  return jsonb_build_object('rows', result_rows, 'conflicts', conflicts);
end;
$$;

revoke all on function public.iwish_agenda_sync(jsonb) from public, anon, authenticated;
grant execute on function public.iwish_agenda_sync(jsonb) to authenticated;
commit;
