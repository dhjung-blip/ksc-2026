-- ============================================================
-- 워크숍 Q&A 스키마
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- ★ 아래 'workshop-2026' 을 원하는 관리자 암호로 바꾼 뒤 실행하세요.
-- ============================================================

create table if not exists rounds (
  id bigint generated always as identity primary key,
  title text not null default '',
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id bigint generated always as identity primary key,
  round_id bigint not null references rounds(id) on delete cascade,
  author text not null default '익명' check (char_length(author) <= 40),
  content text not null check (char_length(content) between 1 and 500),
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

-- 관리자 암호 (RLS 정책이 없으므로 API로는 읽을 수 없음)
create table if not exists admin_settings (
  key text primary key,
  value text not null
);

insert into admin_settings (key, value) values ('passcode', 'workshop-2026')
  on conflict (key) do update set value = excluded.value;

alter table rounds enable row level security;
alter table questions enable row level security;
alter table admin_settings enable row level security;

-- 누구나 읽기 가능
drop policy if exists rounds_read on rounds;
create policy rounds_read on rounds for select using (true);
drop policy if exists questions_read on questions;
create policy questions_read on questions for select using (true);

-- 참가자는 진행 중(open)인 라운드에만 질문 등록 가능
drop policy if exists questions_insert on questions;
create policy questions_insert on questions for insert
  with check (
    selected = false
    and exists (select 1 from rounds r where r.id = round_id and r.status = 'open')
  );

-- ---------- 관리자용 함수 (암호 확인 후 실행) ----------

create or replace function check_pass(pass text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_settings where key = 'passcode' and value = pass) then
    raise exception 'PASSCODE_INVALID';
  end if;
end $$;

create or replace function admin_login(pass text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(pass);
  return true;
end $$;

create or replace function create_round(pass text, p_title text) returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint; n bigint;
begin
  perform check_pass(pass);
  update rounds set status = 'closed' where status = 'open';
  select count(*) + 1 into n from rounds;
  insert into rounds (title)
    values (coalesce(nullif(trim(p_title), ''), '라운드 ' || n))
    returning id into new_id;
  return new_id;
end $$;

create or replace function close_round(pass text, p_round_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(pass);
  update rounds set status = 'closed' where id = p_round_id;
end $$;

create or replace function reopen_round(pass text, p_round_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(pass);
  update rounds set status = 'closed' where status = 'open';
  update rounds set status = 'open' where id = p_round_id;
end $$;

create or replace function set_selected(pass text, p_question_id bigint, p_selected boolean) returns void
language plpgsql security definer set search_path = public as $$
declare rid bigint; cnt int;
begin
  perform check_pass(pass);
  select round_id into rid from questions where id = p_question_id;
  if p_selected then
    select count(*) into cnt from questions
      where round_id = rid and selected and id <> p_question_id;
    if cnt >= 2 then
      raise exception 'MAX_SELECTED';
    end if;
  end if;
  update questions set selected = p_selected where id = p_question_id;
end $$;

create or replace function delete_question(pass text, p_question_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(pass);
  delete from questions where id = p_question_id;
end $$;

-- ---------- 조회용 함수 (참가자/스크린이 폴링) ----------

create or replace function get_state() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'round', (
      select row_to_json(r) from (
        select r1.*, (select count(*) from rounds r2 where r2.id <= r1.id) as round_no
        from rounds r1 order by r1.id desc limit 1
      ) r
    ),
    'questions', coalesce((
      select json_agg(q order by q.id)
      from questions q
      where q.round_id = (select max(id) from rounds)
    ), '[]'::json),
    'winners', coalesce((
      select json_agg(w order by w.round_id, w.id) from (
        select q.*, r.title as round_title,
               (select count(*) from rounds r2 where r2.id <= r.id) as round_no
        from questions q join rounds r on r.id = q.round_id
        where q.selected
      ) w
    ), '[]'::json)
  )
$$;

grant execute on function
  check_pass(text), admin_login(text), create_round(text, text),
  close_round(text, bigint), reopen_round(text, bigint),
  set_selected(text, bigint, boolean), delete_question(text, bigint),
  get_state()
to anon, authenticated;

notify pgrst, 'reload schema';
