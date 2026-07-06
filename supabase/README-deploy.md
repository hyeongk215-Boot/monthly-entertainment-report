# Supabase 배포 방법 (① 서버 제출 방식)

이 폴더는 "서버로 최종 제출" 기능을 쓰고 싶을 때만 필요합니다.
③번(백엔드 없는 파일 취합, `merge.html`) 방식만 쓸 거라면 이 단계는 건너뛰어도 됩니다.

기존에는 Cloudflare Worker + D1을 사용했으나, `*.workers.dev` 주소가 중국에서
간헐적으로 차단되는 문제(ERR_CONNECTION_TIMED_OUT 실측 확인)가 있어 Supabase로 교체했습니다.
Supabase는 `*.supabase.co` 도메인을 쓰며, 사내 다른 부서(장금상선 sonojang.github.io 사례)에서
커스텀 도메인 없이도 중국에서 안정적으로 접속된다는 점을 확인하고 채택했습니다.

## 1. Supabase 프로젝트 생성

**회사 이메일로 새 계정을 만드는 것을 권장합니다** (기존 Cloudflare/GitHub 저장소가 개인 계정에
있는 거버넌스 문제를 반복하지 않기 위함입니다).

1. https://supabase.com 접속 → Sign up (회사 이메일 또는 GitHub 계정 연동 가능)
2. New project 생성 (Organization, 프로젝트 이름, DB 비밀번호, 리전은 가까운 곳 예: Northeast Asia 선택)
3. 프로젝트 생성이 끝나면 좌측 메뉴 **Project Settings → API** 로 이동해서 아래 두 값을 복사해둡니다.
   - **Project URL** (예: `https://xxxxxxxx.supabase.co`)
   - **anon public** key (긴 문자열)

## 2. 테이블/함수 생성

1. 좌측 메뉴 **SQL Editor → New query**
2. 이 폴더의 `schema.sql` 파일 내용 전체를 복사해서 붙여넣습니다.
3. **실행 전에 반드시** 아래 두 자리를 원하는 값으로 바꾸세요 (편집기의 찾기/바꾸기 사용 권장):
   - `CHANGE_ME_ADMIN_KEY` → 본사 담당자만 아는 관리자 비밀번호 (필수, 빈 문자열 불가)
   - `CHANGE_ME_SUBMIT_KEY` → (선택) 지점 담당자에게 공유할 공용 비밀번호. 안 쓸 거면 빈 문자열 `''`로 둡니다.
4. **Run** 버튼으로 실행합니다. 에러 없이 완료되면 끝입니다.

> 보안 방식: `entries` 테이블은 RLS(Row Level Security)를 켜고 정책을 하나도 만들지 않았기 때문에,
> 외부에서 테이블에 직접 접근할 수 없습니다. 제출/조회/삭제는 모두 `submit_entries`, `get_aggregate`,
> `delete_entry` 함수(RPC)를 통해서만 가능하고, 각 함수 안에서 위에서 설정한 키를 검사합니다.
> anon key가 브라우저 코드에 노출되어도 이 세 함수 호출 권한만 가지므로 기존 Cloudflare Worker
> 방식과 동일한 수준의 보안입니다.

## 3. 프론트엔드에 연결

`docs/js/config.js` 파일을 열어 아래와 같이 수정합니다.

```js
SUPABASE_URL: "https://xxxxxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...(anon public key 전체)",
SUBMIT_KEY: "지점에 공유한 공용 비밀번호(설정했다면, schema.sql의 CHANGE_ME_SUBMIT_KEY와 동일하게)",
```

수정 후 GitHub에 커밋/푸시하면 GitHub Pages 사이트에 자동 반영됩니다.

## 4. 접속 테스트 (특히 중국 현지에서)

반드시 중국 현지 담당자에게 `submit.html`에서 "① 서버로 제출"과 `admin.html`에서 조회를
실제로 테스트해달라고 요청하세요.

## 참고: 데이터 확인/삭제

Supabase 대시보드 **Table Editor → entries** 에서 데이터를 직접 조회/삭제할 수 있습니다
(대시보드 접속은 관리자 계정 로그인 기준이라 RLS와 무관하게 항상 가능합니다).

## 관리자 키를 나중에 바꾸고 싶다면

**SQL Editor**에서 아래처럼 함수를 다시 `create or replace` 하면 됩니다 (테이블 데이터는 그대로 유지됩니다).

```sql
create or replace function get_aggregate(p_yearmonth text, p_admin_key text) returns jsonb ...
```
`schema.sql`에서 해당 함수 전체를 복사해 키 값만 바꿔서 다시 실행하세요.
