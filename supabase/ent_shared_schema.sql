-- 운영 재실행 금지: 운영에는 ent_ 함수가 이미 있으므로 이 파일의 create function 문은 오류로 멈춥니다.
-- create or replace function으로 바꾸지 마세요. 바꿔서 실행하면 운영 관리자키가 자리표시(CHANGE_ME_ADMIN_KEY)로 덮입니다.
-- 본문은 옛 schema.sql을 이름만 ent_로 바꾼 참고용 복사본입니다.
-- 2026-11-17 운영과 6개 함수 정규화 본문 해시 일치 확인(관리자키 자리표시 제외, 제출키는 양쪽 '').
-- 관리자키 자리표시는 어디서나 CHANGE_ME_ADMIN_KEY만 사용합니다.
-- 제출키는 Shawn 결정에 따라 의도적으로 ''(빈 문자열)입니다.
-- 전환 후 2단계 서버 입력 검증 전까지 덮어쓰기 위험을 감수합니다.
-- ent_entries identity 시퀀스 이름: ent_entries_id_seq

create table if not exists ent_entries (
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

create index if not exists idx_ent_entries_ym on ent_entries(yearmonth);
create index if not exists idx_ent_entries_corp_region_ym on ent_entries(corp, region, yearmonth);

-- RLS를 켜고 policy를 하나도 만들지 않으므로, anon/authenticated 롤은 테이블에 직접 접근할 수 없습니다.
-- 아래 SECURITY DEFINER 함수(RPC)를 통해서만 데이터에 접근합니다.
alter table ent_entries enable row level security;
revoke all on table ent_entries from public, anon, authenticated;

-- ===== 월 마감 =====
create table if not exists ent_closed_months (
  yearmonth text primary key,
  closed_at timestamptz not null default now(),
  closed_by text
);
alter table ent_closed_months enable row level security;
revoke all on table ent_closed_months from public, anon, authenticated;


create function ent_get_closed_months() returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(yearmonth order by yearmonth), '[]'::jsonb) from ent_closed_months;
$$;
REVOKE EXECUTE ON FUNCTION public.ent_get_closed_months() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.ent_get_closed_months() TO anon;

create function ent_close_month(
  p_yearmonth text,
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
  if p_yearmonth is null then
    raise exception 'yearmonth_required';
  end if;
  insert into ent_closed_months (yearmonth, closed_by) values (p_yearmonth, 'admin')
  on conflict (yearmonth) do nothing;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.ent_close_month(text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.ent_close_month(text, text) TO anon;

create function ent_reopen_month(
  p_yearmonth text,
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
  delete from ent_closed_months where yearmonth = p_yearmonth;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.ent_reopen_month(text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.ent_reopen_month(text, text) TO anon;

-- 같은 법인/지역/적용년월/제출자로 재제출하면 그 제출자의 기존 내역만 덮어씀
create function ent_submit_entries(
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
  v_submit_key constant text := '';
  v_now timestamptz := now();
  v_row jsonb;
  v_count integer := 0;
begin
  if v_submit_key <> '' and p_submit_key is distinct from v_submit_key then
    raise exception 'invalid_submit_key';
  end if;
  if exists (select 1 from ent_closed_months where yearmonth = p_yearmonth) then
    raise exception 'month_closed';
  end if;
  if p_corp is null or p_region is null or p_yearmonth is null or p_submitted_by is null
     or p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'invalid_payload';
  end if;

  delete from ent_entries
   where corp = p_corp and region = p_region and yearmonth = p_yearmonth and submitted_by = p_submitted_by;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into ent_entries (
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
REVOKE EXECUTE ON FUNCTION public.ent_submit_entries(text, text, text, text, text, text, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.ent_submit_entries(text, text, text, text, text, text, jsonb) TO anon;

create function ent_get_aggregate(
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
    from ent_entries where yearmonth = p_yearmonth
  ) e;

  select coalesce(jsonb_agg(s), '[]'::jsonb)
    into v_submissions
  from (
    select distinct on (corp, region) corp, region, submitted_by as "submittedBy", submitted_at as "submittedAt"
    from ent_entries where yearmonth = p_yearmonth
    order by corp, region, submitted_at desc
  ) s;

  return jsonb_build_object('rows', v_rows, 'submissions', v_submissions);
end;
$$;
REVOKE EXECUTE ON FUNCTION public.ent_get_aggregate(text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.ent_get_aggregate(text, text) TO anon;

create function ent_delete_entry(
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
  delete from ent_entries where id = p_id;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.ent_delete_entry(bigint, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.ent_delete_entry(bigint, text) TO anon;
