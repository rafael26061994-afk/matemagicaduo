begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role'
      and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('student', 'teacher', 'admin');
  end if;
end $$;

create table if not exists public.profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references public.profiles(auth_user_id) on delete cascade,
  display_name text not null,
  school_name text not null default '',
  turma_label text not null default '',
  grade_year smallint,
  avatar_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_profiles_grade_year_chk check (grade_year is null or grade_year between 6 and 9)
);


create table if not exists public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references public.profiles(auth_user_id) on delete cascade,
  full_name text not null,
  school_name text not null default '',
  turma_label text not null default '',
  email text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_device_links (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles(id) on delete cascade,
  device_profile_id text not null,
  device_label text not null default '',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_device_links_unique unique (student_profile_id, device_profile_id)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references public.profiles(auth_user_id) on delete restrict,
  name text not null,
  grade_year smallint not null,
  school_year integer not null,
  shift text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_grade_year_chk check (grade_year between 6 and 9),
  constraint classes_school_year_chk check (school_year >= 2024),
  constraint classes_teacher_name_year_unique unique (teacher_user_id, name, school_year)
);

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_enrollments_unique unique (student_profile_id, class_id)
);

create table if not exists public.student_progress (
  student_profile_id uuid primary key references public.student_profiles(id) on delete cascade,
  total_xp integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  total_sessions integer not null default 0,
  total_answered integer not null default 0,
  last_played_at timestamptz,
  operation_progress jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_progress_non_negative_chk check (
    total_xp >= 0 and streak >= 0 and best_streak >= 0 and total_sessions >= 0 and total_answered >= 0
  )
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null unique,
  student_profile_id uuid not null references public.student_profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  operation text not null,
  level_name text not null default '',
  mode text not null default 'study',
  stage_no integer,
  stage_label text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  answered integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  accuracy numeric(5,2),
  score integer not null default 0,
  xp_earned integer not null default 0,
  xp_bonus integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint game_sessions_non_negative_chk check (
    duration_seconds >= 0 and answered >= 0 and correct_count >= 0 and wrong_count >= 0 and score >= 0 and xp_earned >= 0 and xp_bonus >= 0
  )
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  client_attempt_id text not null unique,
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  operation text not null,
  skill_code text not null default '',
  stage_label text not null default '',
  question_text text not null,
  presented_options jsonb not null default '[]'::jsonb,
  student_answer text,
  correct boolean not null,
  response_ms integer,
  error_code text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint attempts_response_ms_chk check (response_ms is null or response_ms >= 0)
);
create index if not exists idx_attempts_client_attempt_id on public.attempts(client_attempt_id);

create table if not exists public.skill_mastery (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles(id) on delete cascade,
  operation text not null,
  skill_code text not null,
  status text not null default '',
  mastery_score numeric(5,2) not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skill_mastery_unique unique (student_profile_id, operation, skill_code),
  constraint skill_mastery_score_chk check (mastery_score >= 0 and mastery_score <= 100),
  constraint skill_mastery_non_negative_chk check (success_count >= 0 and failure_count >= 0)
);

create or replace function public.compute_skill_mastery_status(p_success integer, p_failure integer)
returns text
language plpgsql
stable
as $$
declare
  total_attempts integer := greatest(0, coalesce(p_success, 0) + coalesce(p_failure, 0));
  accuracy numeric := case when total_attempts > 0 then (coalesce(p_success, 0)::numeric / total_attempts::numeric) * 100 else 0 end;
begin
  if total_attempts = 0 then
    return 'novo';
  elsif total_attempts >= 5 and accuracy >= 80 then
    return 'dominada';
  elsif accuracy < 50 then
    return 'reforco';
  else
    return 'praticando';
  end if;
end;
$$;

create or replace function public.apply_attempt_to_skill_mastery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_success integer;
  v_failure integer;
  v_total integer;
  v_score numeric(5,2);
  v_status text;
begin
  insert into public.skill_mastery (
    student_profile_id,
    operation,
    skill_code,
    status,
    mastery_score,
    success_count,
    failure_count,
    first_seen_at,
    last_seen_at,
    updated_at
  )
  values (
    new.student_profile_id,
    coalesce(nullif(trim(new.operation), ''), 'geral'),
    coalesce(nullif(trim(new.skill_code), ''), 'geral'),
    case when new.correct then 'praticando' else 'reforco' end,
    case when new.correct then 100 else 0 end,
    case when new.correct then 1 else 0 end,
    case when new.correct then 0 else 1 end,
    coalesce(new.created_at, now()),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (student_profile_id, operation, skill_code)
  do update set
    success_count = public.skill_mastery.success_count + case when new.correct then 1 else 0 end,
    failure_count = public.skill_mastery.failure_count + case when new.correct then 0 else 1 end,
    last_seen_at = greatest(coalesce(public.skill_mastery.last_seen_at, now()), coalesce(new.created_at, now())),
    updated_at = now();

  select
    greatest(0, coalesce(success_count, 0)),
    greatest(0, coalesce(failure_count, 0))
  into v_success, v_failure
  from public.skill_mastery
  where student_profile_id = new.student_profile_id
    and operation = coalesce(nullif(trim(new.operation), ''), 'geral')
    and skill_code = coalesce(nullif(trim(new.skill_code), ''), 'geral');

  v_total := greatest(0, coalesce(v_success, 0) + coalesce(v_failure, 0));
  v_score := case when v_total > 0 then round(((v_success::numeric / v_total::numeric) * 100)::numeric, 2) else 0 end;
  v_status := public.compute_skill_mastery_status(v_success, v_failure);

  update public.skill_mastery
  set mastery_score = v_score,
      status = v_status,
      updated_at = now()
  where student_profile_id = new.student_profile_id
    and operation = coalesce(nullif(trim(new.operation), ''), 'geral')
    and skill_code = coalesce(nullif(trim(new.skill_code), ''), 'geral');

  return new;
end;
$$;

create index if not exists idx_student_profiles_auth_user_id on public.student_profiles(auth_user_id);
create index if not exists idx_teacher_profiles_auth_user_id on public.teacher_profiles(auth_user_id);
create index if not exists idx_student_device_links_student_profile_id on public.student_device_links(student_profile_id);
create index if not exists idx_student_device_links_device_profile_id on public.student_device_links(device_profile_id);
create index if not exists idx_classes_teacher_user_id on public.classes(teacher_user_id);
create index if not exists idx_student_enrollments_student_profile_id on public.student_enrollments(student_profile_id);
create index if not exists idx_student_enrollments_class_id on public.student_enrollments(class_id);
create index if not exists idx_game_sessions_student_profile_id on public.game_sessions(student_profile_id);
create index if not exists idx_game_sessions_class_id on public.game_sessions(class_id);
create index if not exists idx_game_sessions_ended_at on public.game_sessions(ended_at desc);
create index if not exists idx_attempts_student_profile_id on public.attempts(student_profile_id);
create index if not exists idx_attempts_game_session_id on public.attempts(game_session_id);
create index if not exists idx_attempts_class_id on public.attempts(class_id);
create index if not exists idx_skill_mastery_student_profile_id on public.skill_mastery(student_profile_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.auth_user_id = auth.uid() limit 1), false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role in ('teacher', 'admin') from public.profiles p where p.auth_user_id = auth.uid() limit 1), false);
$$;


create or replace function public.register_teacher_access(
  p_full_name text,
  p_school_name text,
  p_turma_label text,
  p_email text
)
returns public.teacher_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_row public.teacher_profiles;
begin
  if v_auth_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  insert into public.profiles (auth_user_id, role, display_name)
  values (v_auth_user_id, 'teacher', coalesce(nullif(trim(p_full_name), ''), 'Professor'))
  on conflict (auth_user_id)
  do update set
    role = 'teacher',
    display_name = excluded.display_name,
    updated_at = now();

  insert into public.teacher_profiles (auth_user_id, full_name, school_name, turma_label, email, active)
  values (
    v_auth_user_id,
    coalesce(nullif(trim(p_full_name), ''), 'Professor'),
    coalesce(trim(p_school_name), ''),
    coalesce(trim(p_turma_label), ''),
    coalesce(trim(p_email), ''),
    true
  )
  on conflict (auth_user_id)
  do update set
    full_name = excluded.full_name,
    school_name = excluded.school_name,
    turma_label = excluded.turma_label,
    email = excluded.email,
    active = true,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.viewer_owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and (c.teacher_user_id = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.viewer_can_access_student(p_student_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_profiles sp
    where sp.id = p_student_profile_id
      and (
        sp.auth_user_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.student_enrollments se
          join public.classes c on c.id = se.class_id
          where se.student_profile_id = sp.id
            and se.active = true
            and c.active = true
            and c.teacher_user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.viewer_can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and (
        public.is_admin()
        or c.teacher_user_id = auth.uid()
        or exists (
          select 1
          from public.student_enrollments se
          join public.student_profiles sp on sp.id = se.student_profile_id
          where se.class_id = c.id
            and se.active = true
            and sp.auth_user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (auth_user_id, role, display_name)
  values (
    new.id,
    'student',
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'aluno'), '@', 1)
    )
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_profiles_set_updated_at on public.student_profiles;
create trigger trg_student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_teacher_profiles_set_updated_at on public.teacher_profiles;
create trigger trg_teacher_profiles_set_updated_at
before update on public.teacher_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_device_links_set_updated_at on public.student_device_links;
create trigger trg_student_device_links_set_updated_at
before update on public.student_device_links
for each row execute function public.set_updated_at();

drop trigger if exists trg_classes_set_updated_at on public.classes;
create trigger trg_classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_enrollments_set_updated_at on public.student_enrollments;
create trigger trg_student_enrollments_set_updated_at
before update on public.student_enrollments
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_progress_set_updated_at on public.student_progress;
create trigger trg_student_progress_set_updated_at
before update on public.student_progress
for each row execute function public.set_updated_at();

drop trigger if exists trg_skill_mastery_set_updated_at on public.skill_mastery;
create trigger trg_skill_mastery_set_updated_at
before update on public.skill_mastery
for each row execute function public.set_updated_at();

drop trigger if exists trg_attempts_apply_skill_mastery on public.attempts;
create trigger trg_attempts_apply_skill_mastery
after insert on public.attempts
for each row execute function public.apply_attempt_to_skill_mastery();

revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.student_profiles to authenticated;
grant select, insert, update, delete on public.teacher_profiles to authenticated;
grant select, insert, update, delete on public.student_device_links to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.student_enrollments to authenticated;
grant select, insert, update, delete on public.student_progress to authenticated;
grant select, insert, update, delete on public.game_sessions to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;
grant select, insert, update, delete on public.skill_mastery to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.student_device_links enable row level security;
alter table public.classes enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.student_progress enable row level security;
alter table public.game_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.skill_mastery enable row level security;

-- profiles

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
for insert to authenticated
with check (
  auth.uid() is not null
  and ((auth.uid() = auth_user_id and role = 'student') or public.is_admin())
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
)
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or (
      auth.uid() = auth_user_id
      and role = (select p.role from public.profiles p where p.auth_user_id = auth.uid() limit 1)
    )
  )
);

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
for delete to authenticated
using (
  auth.uid() is not null and public.is_admin()
);

-- student_profiles

drop policy if exists student_profiles_select on public.student_profiles;
create policy student_profiles_select on public.student_profiles
for select to authenticated
using (
  auth.uid() is not null
  and public.viewer_can_access_student(id)
);

drop policy if exists student_profiles_insert on public.student_profiles;
create policy student_profiles_insert on public.student_profiles
for insert to authenticated
with check (
  auth.uid() is not null
  and ((auth.uid() = auth_user_id) or public.is_admin())
);

drop policy if exists student_profiles_update on public.student_profiles;
create policy student_profiles_update on public.student_profiles
for update to authenticated
using (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
)
with check (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
);

drop policy if exists student_profiles_delete on public.student_profiles;
create policy student_profiles_delete on public.student_profiles
for delete to authenticated
using (
  auth.uid() is not null and (auth.uid() = auth_user_id or public.is_admin())
);


-- teacher_profiles

drop policy if exists teacher_profiles_select on public.teacher_profiles;
create policy teacher_profiles_select on public.teacher_profiles
for select to authenticated
using (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
);

drop policy if exists teacher_profiles_insert on public.teacher_profiles;
create policy teacher_profiles_insert on public.teacher_profiles
for insert to authenticated
with check (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
);

drop policy if exists teacher_profiles_update on public.teacher_profiles;
create policy teacher_profiles_update on public.teacher_profiles
for update to authenticated
using (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
)
with check (
  auth.uid() is not null
  and (auth.uid() = auth_user_id or public.is_admin())
);

drop policy if exists teacher_profiles_delete on public.teacher_profiles;
create policy teacher_profiles_delete on public.teacher_profiles
for delete to authenticated
using (
  auth.uid() is not null and public.is_admin()
);

-- student_device_links

drop policy if exists student_device_links_select on public.student_device_links;
create policy student_device_links_select on public.student_device_links
for select to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.student_profiles sp
    where sp.id = student_device_links.student_profile_id
      and (sp.auth_user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists student_device_links_insert on public.student_device_links;
create policy student_device_links_insert on public.student_device_links
for insert to authenticated
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.student_profiles sp
    where sp.id = student_device_links.student_profile_id
      and (sp.auth_user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists student_device_links_update on public.student_device_links;
create policy student_device_links_update on public.student_device_links
for update to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.student_profiles sp
    where sp.id = student_device_links.student_profile_id
      and (sp.auth_user_id = auth.uid() or public.is_admin())
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.student_profiles sp
    where sp.id = student_device_links.student_profile_id
      and (sp.auth_user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists student_device_links_delete on public.student_device_links;
create policy student_device_links_delete on public.student_device_links
for delete to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.student_profiles sp
    where sp.id = student_device_links.student_profile_id
      and (sp.auth_user_id = auth.uid() or public.is_admin())
  )
);

-- classes

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
for select to authenticated
using (
  auth.uid() is not null
  and public.viewer_can_access_class(id)
);

drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes
for insert to authenticated
with check (
  auth.uid() is not null
  and teacher_user_id = auth.uid()
  and public.is_teacher()
);

drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes
for update to authenticated
using (
  auth.uid() is not null
  and public.viewer_owns_class(id)
)
with check (
  auth.uid() is not null
  and public.viewer_owns_class(id)
);

drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes
for delete to authenticated
using (
  auth.uid() is not null
  and public.viewer_owns_class(id)
);

-- student_enrollments

drop policy if exists student_enrollments_select on public.student_enrollments;
create policy student_enrollments_select on public.student_enrollments
for select to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or public.viewer_owns_class(class_id)
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = student_enrollments.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists student_enrollments_insert on public.student_enrollments;
create policy student_enrollments_insert on public.student_enrollments
for insert to authenticated
with check (
  auth.uid() is not null
  and public.viewer_owns_class(class_id)
);

drop policy if exists student_enrollments_update on public.student_enrollments;
create policy student_enrollments_update on public.student_enrollments
for update to authenticated
using (
  auth.uid() is not null
  and public.viewer_owns_class(class_id)
)
with check (
  auth.uid() is not null
  and public.viewer_owns_class(class_id)
);

drop policy if exists student_enrollments_delete on public.student_enrollments;
create policy student_enrollments_delete on public.student_enrollments
for delete to authenticated
using (
  auth.uid() is not null
  and public.viewer_owns_class(class_id)
);

-- student_progress

drop policy if exists student_progress_select on public.student_progress;
create policy student_progress_select on public.student_progress
for select to authenticated
using (
  auth.uid() is not null
  and public.viewer_can_access_student(student_profile_id)
);

drop policy if exists student_progress_insert on public.student_progress;
create policy student_progress_insert on public.student_progress
for insert to authenticated
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = student_progress.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists student_progress_update on public.student_progress;
create policy student_progress_update on public.student_progress
for update to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = student_progress.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = student_progress.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists student_progress_delete on public.student_progress;
create policy student_progress_delete on public.student_progress
for delete to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = student_progress.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

-- game_sessions

drop policy if exists game_sessions_select on public.game_sessions;
create policy game_sessions_select on public.game_sessions
for select to authenticated
using (
  auth.uid() is not null
  and public.viewer_can_access_student(student_profile_id)
);

drop policy if exists game_sessions_insert on public.game_sessions;
create policy game_sessions_insert on public.game_sessions
for insert to authenticated
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = game_sessions.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists game_sessions_update on public.game_sessions;
create policy game_sessions_update on public.game_sessions
for update to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = game_sessions.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = game_sessions.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists game_sessions_delete on public.game_sessions;
create policy game_sessions_delete on public.game_sessions
for delete to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = game_sessions.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

-- attempts

drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts
for select to authenticated
using (
  auth.uid() is not null
  and public.viewer_can_access_student(student_profile_id)
);

drop policy if exists attempts_insert on public.attempts;
create policy attempts_insert on public.attempts
for insert to authenticated
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = attempts.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists attempts_update on public.attempts;
create policy attempts_update on public.attempts
for update to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = attempts.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = attempts.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists attempts_delete on public.attempts;
create policy attempts_delete on public.attempts
for delete to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = attempts.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

-- skill_mastery

drop policy if exists skill_mastery_select on public.skill_mastery;
create policy skill_mastery_select on public.skill_mastery
for select to authenticated
using (
  auth.uid() is not null
  and public.viewer_can_access_student(student_profile_id)
);

drop policy if exists skill_mastery_insert on public.skill_mastery;
create policy skill_mastery_insert on public.skill_mastery
for insert to authenticated
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = skill_mastery.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists skill_mastery_update on public.skill_mastery;
create policy skill_mastery_update on public.skill_mastery
for update to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = skill_mastery.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = skill_mastery.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

drop policy if exists skill_mastery_delete on public.skill_mastery;
create policy skill_mastery_delete on public.skill_mastery
for delete to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.student_profiles sp
      where sp.id = skill_mastery.student_profile_id
        and sp.auth_user_id = auth.uid()
    )
  )
);

commit;
