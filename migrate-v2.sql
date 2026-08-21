-- ============================================================
-- v2 마이그레이션: 세션 동시 오픈 모드
-- Supabase SQL Editor에 전체 붙여넣고 Run 하세요.
-- (기존 데이터를 지우고 6개 세션을 연 상태로 준비합니다)
-- ============================================================

-- 전체 세션 + 질문을 한 번에 반환
create or replace function get_state() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'sessions', coalesce((
      select json_agg(s order by s.id) from (
        select r.id, r.title, r.status, r.created_at,
               (select count(*) from rounds r2 where r2.id <= r.id) as round_no,
               coalesce((select json_agg(q order by q.id)
                         from questions q where q.round_id = r.id), '[]'::json) as questions
        from rounds r
      ) s
    ), '[]'::json)
  )
$$;

-- 세션 열기/만들기가 다른 세션을 닫지 않도록 변경
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
    values (coalesce(nullif(trim(p_title), ''), '라운드 ' || n))
    returning id into new_id;
  return new_id;
end $$;

-- 초기화 후 6개 세션을 연 상태로 등록
truncate table questions, rounds restart identity cascade;
insert into rounds (title, status) values
  ('AI drug discovery: Data, model, and beyond -신현진 소장-', 'open'),
  ('AI agent 기반 합성 가능한 신약 후보물질 설계 - 장우대 교수-', 'open'),
  ('신약개발에서의 AI의 역할 -김승하 팀장-', 'open'),
  ('DeepZema: AI 기반 합성신약 연구개발 플랫폼을 활용한 Drug Discovery -임동철 CTO-', 'open'),
  ('신약개발에서 AIX(AI Transformation)-김승하 연구원-', 'open'),
  ('in silico Drug Discovery의 2026년 트렌드: ''AI 신약개발''의 모호함을 넘어 증명(Proof)으로 -오경석 연구위원-', 'open');

notify pgrst, 'reload schema';
