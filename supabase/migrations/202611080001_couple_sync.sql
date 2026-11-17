-- Couple membership is the authorization boundary; the publishable key grants no data access.
begin;
create extension if not exists pgcrypto with schema extensions;
create table public.gym_couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);
create table public.gym_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.gym_couples(id),
  partner_id text not null check (partner_id in ('markus', 'partner')),
  unique (couple_id, partner_id)
);
create table public.gym_events (
  id text primary key,
  seq bigint generated always as identity unique,
  couple_id uuid not null references public.gym_couples(id),
  sender_id uuid not null references auth.users(id),
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object' and octet_length(envelope::text) <= 100000),
  created_at timestamptz not null default now()
);
create index gym_events_couple_seq on public.gym_events(couple_id, seq);
alter table public.gym_couples enable row level security;
alter table public.gym_members enable row level security;
alter table public.gym_events enable row level security;
create policy members_read_self on public.gym_members for select to authenticated using (user_id = auth.uid());
create policy couples_read_own on public.gym_couples for select to authenticated using (
  id in (select couple_id from public.gym_members where user_id = auth.uid())
);
create policy events_read_own on public.gym_events for select to authenticated using (
  couple_id in (select couple_id from public.gym_members where user_id = auth.uid())
);
revoke all on public.gym_couples, public.gym_members, public.gym_events from anon, authenticated;
grant select on public.gym_couples, public.gym_members, public.gym_events to authenticated;

create function public.gym_create_couple(chosen_partner text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare room uuid;
begin
  if auth.uid() is null or chosen_partner not in ('markus', 'partner') then raise exception 'Invalid member'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select couple_id into room from public.gym_members where user_id = auth.uid();
  if room is not null then return room; end if;
  insert into public.gym_couples default values returning id into room;
  insert into public.gym_members values (auth.uid(), room, chosen_partner);
  return room;
end $$;

create function public.gym_join_couple(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare room uuid; occupied text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select couple_id into room from public.gym_members where user_id = auth.uid();
  if room is not null then raise exception 'This device already belongs to a couple'; end if;
  select id into room from public.gym_couples where invite_code = lower(trim(code)) for update;
  if room is null then raise exception 'Invalid invite code'; end if;
  if (select count(*) from public.gym_members where couple_id = room) <> 1 then raise exception 'This couple already has two members'; end if;
  select partner_id into occupied from public.gym_members where couple_id = room;
  insert into public.gym_members values (auth.uid(), room, case occupied when 'markus' then 'partner' else 'markus' end);
  return room;
end $$;

create function public.gym_append_event(item jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare room uuid;
begin
  select couple_id into room from public.gym_members where user_id = auth.uid();
  if room is null then raise exception 'Pair this device first'; end if;
  -- Serialize inserts per room so a committed sequence cursor cannot skip a pending insert.
  perform pg_advisory_xact_lock(hashtext(room::text));
  if coalesce(item->>'id', '') = '' or coalesce(item#>>'{event,type}', '') not in
    ('MACHINE_ADDED','SETUP_UPDATED','SET_LOGGED','HYPE_REACTION','SESSION_STARTED','SESSION_FINISHED','PROFILES_UPDATED')
    then raise exception 'Invalid event'; end if;
  insert into public.gym_events(id, couple_id, sender_id, envelope)
    values (item->>'id', room, auth.uid(), item) on conflict (id) do nothing;
end $$;
revoke all on function public.gym_create_couple(text), public.gym_join_couple(text), public.gym_append_event(jsonb) from public, anon;
grant execute on function public.gym_create_couple(text), public.gym_join_couple(text), public.gym_append_event(jsonb) to authenticated;

create policy gym_realtime_read on realtime.messages for select to authenticated using (
  (select realtime.topic()) in (select 'gymcrush:' || couple_id::text from public.gym_members where user_id = auth.uid())
);
create policy gym_realtime_write on realtime.messages for insert to authenticated with check (
  (select realtime.topic()) in (select 'gymcrush:' || couple_id::text from public.gym_members where user_id = auth.uid())
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('gym-photos', 'gym-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy gym_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'gym-photos' and (storage.foldername(name))[1] in
  (select couple_id::text from public.gym_members where user_id = auth.uid())
);
create policy gym_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'gym-photos' and (storage.foldername(name))[1] in
  (select couple_id::text from public.gym_members where user_id = auth.uid())
);
commit;
