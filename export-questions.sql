-- KSC 2026 Q&A 질문 목록 내보내기
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run → 결과 그리드 우측 상단 "Export → CSV"
-- (대시보드는 관리자 권한이라 앱에서 숨긴 phone4 도 함께 나옵니다)

-- 1) 전체 질문 목록 (프로그램 순 → 등록 시각 순, 시각은 한국시간)
select
  r.id                                            as 프로그램번호,
  r.title                                         as 프로그램,
  q.id                                            as 질문번호,
  q.author                                        as 이름,
  q.phone4                                        as 전화뒷자리,
  q.content                                       as 질문,
  case when q.selected then '★ 우수' else '' end    as 우수선정,
  to_char(q.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') as 등록시각
from questions q
join rounds r on r.id = q.round_id
order by r.id, q.created_at;

-- 2) 우수 질문만 (경품 연락용)
select
  r.id                                            as 프로그램번호,
  r.title                                         as 프로그램,
  q.author                                        as 이름,
  q.phone4                                        as 전화뒷자리,
  q.content                                       as 질문,
  to_char(q.created_at at time zone 'Asia/Seoul', 'HH24:MI') as 등록시각
from questions q
join rounds r on r.id = q.round_id
where q.selected
order by r.id, q.created_at;

-- 3) 프로그램별 집계
select
  r.id                                   as 프로그램번호,
  r.title                                as 프로그램,
  count(q.id)                            as 질문수,
  count(q.id) filter (where q.selected)  as 우수선정수,
  count(distinct q.phone4)               as 참여자수_전화기준
from rounds r
left join questions q on q.round_id = r.id
group by r.id, r.title
order by r.id;
