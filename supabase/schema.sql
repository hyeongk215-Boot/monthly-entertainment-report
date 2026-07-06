-- Supabase 마이그레이션: 중국법인 접대비 제출/집계
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 실행하세요.
--
-- 실행 전에 아래 두 값을 원하는 비밀번호로 바꾸세요 (Ctrl+H로 일괄 치환 권장):
--   CHANGE_ME_ADMIN_KEY   -> admin.html 에서 집계 조회/삭제 시 사용할 관리자 비밀번호 (필수, 빈 문자열 불가)
--   CHANGE_ME_SUBMIT_KEY  -> 지점 제출 시 요구할 공용 비밀번호 (선택. 빈 문자열 ''로 두면 검사 안 함)

create table if not exists entries (
  id bigint generated always as identity primary key,
  corp text not null,
  region text not null,
  yearmonth text not null,
  office text,
  submitted_by text,
  submitted_at timestamptz,
  date text,
  currency text,
  amount numeric,
  cny_amount numeric,
  vendor text,
  headcount integer,
  note text,
  pre_approved integer default 0
);

create index if not exists idx_entries_ym on entries(yearmonth);
create index if not exists idx_entries_corp_region_ym on entries(corp, region, yearmonth);

-- RLS를 켜고 policy를 하나도 만들지 않으므로, anon/authenticated 롤은 테이블에 직접 접근할 수 없습니다.
-- 아래 SECURITY DEFINER 함수(RPC)를 통해서만 데이터에 접근합니다.
alter table entries enable row level security;
revoke all on entries from anon, authenticated;

-- ===== 제출 =====
create or replace function submit_entries(
  p_corp text,
  p_region text,
  p_yearmonth text,
  p_office text,
  p_submitted_by text,
  p_submit_key text,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submit_key constant text := 'CHANGE_ME_SUBMIT_KEY';
  v_now timestamptz := now();
  v_row jsonb;
  v_count integer := 0;
begin
  if v_submit_key <> '' and p_submit_key is distinct from v_submit_key then
    raise exception 'invalid_submit_key';
  end if;
  if p_corp is null or p_region is null or p_yearmonth is null or p_submitted_by is null
     or p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'invalid_payload';
  end if;

  -- 같은 법인/지역/적용년월/제출자로 재제출하면 그 제출자의 기존 내역만 덮어씀
  delete from entries
   where corp = p_corp and region = p_region and yearmonth = p_yearmonth and submitted_by = p_submitted_by;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into entries (
      corp, region, yearmonth, office, submitted_by, submitted_at,
      date, currency, amount, cny_amount, vendor, headcount, note, pre_approved
    ) values (
      p_corp, p_region, p_yearmonth, coalesce(p_office, ''), p_submitted_by, v_now,
      coalesce(v_row->>'date', ''),
      coalesce(v_row->>'currency', 'CNY'),
      coalesce(nullif(v_row->>'amount', '')::numeric, 0),
      coalesce(nullif(v_row->>'cnyAmount', '')::numeric, 0),
      coalesce(v_row->>'vendor', ''),
      coalesce(nullif(v_row->>'headcount', '')::integer, 0),
      coalesce(v_row->>'note', ''),
      case when coalesce(v_row->>'preApproved', 'false')::boolean then 1 else 0 end
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ===== 관리자 집계 조회 =====
create or replace function get_aggregate(
  p_yearmonth text,
  p_admin_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_key constant text := 'CHANGE_ME_ADMIN_KEY';
  v_rows jsonb;
  v_submissions jsonb;
begin
  if v_admin_key = '' or p_admin_key is distinct from v_admin_key then
    raise exception 'unauthorized';
  end if;
  if p_yearmonth is null then
    raise exception 'yearmonth_required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.corp, e.region, e."submittedBy", e.date), '[]'::jsonb)
    into v_rows
  from (
    select id, corp, region, office, submitted_by as "submittedBy", submitted_at as "submittedAt",
           date, currency, amount, cny_amount as "cnyAmount", vendor, headcount, note, pre_approved as "preApproved"
    from entries where yearmonth = p_yearmonth
  ) e;

  select coalesce(jsonb_agg(s), '[]'::jsonb)
    into v_submissions
  from (
    select distinct on (corp, region) corp, region, submitted_by as "submittedBy", submitted_at as "submittedAt"
    from entries where yearmonth = p_yearmonth
    order by corp, region, submitted_at desc
  ) s;

  return jsonb_build_object('rows', v_rows, 'submissions', v_submissions);
end;
$$;

-- ===== 관리자 삭제 =====
create or replace function delete_entry(
  p_id bigint,
  p_admin_key text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_key constant text := 'CHANGE_ME_ADMIN_KEY';
begin
  if v_admin_key = '' or p_admin_key is distinct from v_admin_key then
    raise exception 'unauthorized';
  end if;
  delete from entries where id = p_id;
end;
$$;

grant execute on function submit_entries(text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function get_aggregate(text, text) to anon, authenticated;
grant execute on function delete_entry(bigint, text) to anon, authenticated;
