-- ============================================================
-- v3 마이그레이션: 프로그램 동시 오픈 + 전화번호 뒤 4자리
-- Supabase SQL Editor에 전체 붙여넣고 Run 하세요. (기존 데이터 초기화됨)
-- ============================================================

-- 전화번호 뒤 4자리 컬럼
alter table questions add column if not exists phone4 text not null default '';
alter table questions drop constraint if exists questions_phone4_check;
alter table questions add constraint questions_phone4_check
  check (phone4 = '' or phone4 ~ '^[0-9]{4}$');

-- 참가자 등록 시 4자리 필수
drop policy if exists questions_insert on questions;
create policy questions_insert on questions for insert
  with check (
    selected = false
    and phone4 ~ '^[0-9]{4}$'
    and char_length(trim(content)) > 0
    and exists (select 1 from rounds r where r.id = round_id and r.status = 'open')
  );

-- 전화번호는 일반 API 조회에서 제외 (관리자 함수로만 열람)
revoke select on questions from anon, authenticated;
grant select (id, round_id, author, content, selected, created_at) on questions to anon, authenticated;

-- 공개 상태 조회 (전화번호 제외)
create or replace function get_state() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'sessions', coalesce((
      select json_agg(s order by s.id) from (
        select r.id, r.title, r.status, r.created_at,
               (select count(*) from rounds r2 where r2.id <= r.id) as round_no,
               coalesce((select json_agg(json_build_object(
                          'id', q.id, 'round_id', q.round_id, 'author', q.author,
                          'content', q.content, 'selected', q.selected, 'created_at', q.created_at
                        ) order by q.id)
                         from questions q where q.round_id = r.id), '[]'::json) as questions
        from rounds r
      ) s
    ), '[]'::json)
  )
$$;

-- 관리자 상태 조회 (전화번호 포함, 암호 필요)
create or replace function get_state_admin(pass text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform check_pass(pass);
  return (select json_build_object(
    'sessions', coalesce((
      select json_agg(s order by s.id) from (
        select r.id, r.title, r.status, r.created_at,
               (select count(*) from rounds r2 where r2.id <= r.id) as round_no,
               coalesce((select json_agg(json_build_object(
                          'id', q.id, 'round_id', q.round_id, 'author', q.author,
                          'content', q.content, 'selected', q.selected, 'created_at', q.created_at,
                          'phone4', q.phone4
                        ) order by q.id)
                         from questions q where q.round_id = r.id), '[]'::json) as questions
        from rounds r
      ) s
    ), '[]'::json)
  ));
end $$;

grant execute on function get_state_admin(text) to anon, authenticated;

-- 전체 초기화 (질문 삭제 + 모든 프로그램 접수 중으로)
create or replace function reset_all(pass text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(pass);
  delete from questions;
  update rounds set status = 'open';
end $$;

grant execute on function reset_all(text) to anon, authenticated;

-- 프로그램 열기/만들기가 다른 프로그램을 닫지 않도록
create or replace function reopen_round(pass text, p_round_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(pass);
  update rounds set status = 'open' where id = p_round_id;
end $$;

create or replace function create_round(pass text, p_title text) returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint; n bigint;
begin
  perform check_pass(pass);
  select count(*) + 1 into n from rounds;
  insert into rounds (title)
    values (coalesce(nullif(trim(p_title), ''), '프로그램 ' || n))
    returning id into new_id;
  return new_id;
end $$;

-- 초기화 후 프로그램 6개 오픈
truncate table questions, rounds restart identity cascade;
insert into rounds (title, status) values
  ('AI drug discovery: Data, model, and beyond -신현진 소장-', 'open'),
  ('AI agent 기반 합성 가능한 신약 후보물질 설계 -장우대 교수-', 'open'),
  ('AI 전환을 향한 여정 -이제현 실장-', 'open'),
  ('신약개발에서의 AI의 역할 -김승하 팀장-', 'open'),
  ('DeepZema: AI 기반 합성신약 연구개발 플랫폼을 활용한 Drug Discovery -임동철 CTO-', 'open'),
  ('in silico Drug Discovery의 2026년 트렌드: ''AI 신약개발''의 모호함을 넘어 증명(Proof)으로 -오경석 연구위원-', 'open');

notify pgrst, 'reload schema';
