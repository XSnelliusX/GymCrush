create or replace function public.gym_append_event(item jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare room uuid;
begin
  select couple_id into room from public.gym_members where user_id = auth.uid();
  if room is null then raise exception 'Pair this device first'; end if;
  -- Serialize inserts per room so a committed sequence cursor cannot skip a pending insert.
  perform pg_advisory_xact_lock(hashtext(room::text));
  if coalesce(item->>'id', '') = '' or coalesce(item#>>'{event,type}', '') not in
    ('MACHINE_ADDED','MACHINE_DELETED','SETUP_UPDATED','SET_LOGGED','SET_CHANGED','HYPE_REACTION','SESSION_STARTED','SESSION_FINISHED','PROFILES_UPDATED')
    then raise exception 'Invalid event'; end if;
  insert into public.gym_events(id, couple_id, sender_id, envelope)
    values (item->>'id', room, auth.uid(), item) on conflict (id) do nothing;
end $$;
