> **사용 중단**: `*.workers.dev`가 중국에서 간헐적으로 차단되는 문제로 인해
> ① 서버 제출 방식은 `supabase/README-deploy.md` (Supabase) 로 교체되었습니다.
> 이 문서와 코드는 참고용으로만 남겨두었습니다.

# Cloudflare Worker 배포 방법 (① 서버 제출 방식, 사용 중단)

이 폴더는 "서버로 최종 제출" 기능을 쓰고 싶을 때만 필요합니다.
③ 번(백엔드 없는 파일 취합) 방식만 쓸 거라면 이 단계는 건너뛰어도 됩니다.

## 0. 준비물
- Cloudflare 계정 (무료 가입: https://dash.cloudflare.com/sign-up)
- Node.js가 설치된 PC (이미 있음)

## 1. Cloudflare 로그인
터미널(명령 프롬프트)에서 이 폴더(`worker`)로 이동한 후:

```
npx wrangler login
```
브라우저가 열리면 Cloudflare 계정으로 로그인 및 권한 허용을 합니다.

## 2. D1 데이터베이스 생성
```
npx wrangler d1 create china-expense-db
```
실행 결과에 나오는 `database_id` 값을 복사해서 `wrangler.toml` 파일의
`database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"` 부분에 붙여넣습니다.

## 3. 테이블 생성 (스키마 적용)
```
npx wrangler d1 execute china-expense-db --remote --file=./schema.sql
```

## 4. 비밀 키 설정 (관리자 코드 / 제출 공용키)
```
npx wrangler secret put ADMIN_KEY
```
→ 본사 담당자(나)만 아는 비밀번호를 입력합니다. admin.html에서 집계 조회 시 사용합니다.

```
npx wrangler secret put SUBMIT_KEY
```
→ (선택) 지점 담당자들에게 공유할 간단한 공용 비밀번호. 설정하지 않으려면 이 단계는 생략 가능합니다.
생략 시 누구나 제출 API를 호출할 수 있으니, 사내 전용 링크로만 공유하는 것을 권장합니다.

## 5. 배포
```
npx wrangler deploy
```
배포가 끝나면 `https://china-expense-worker.<your-subdomain>.workers.dev` 형태의 URL이 출력됩니다.

## 6. 프론트엔드에 연결
`docs/js/config.js` 파일을 열어 아래와 같이 수정합니다.

```js
WORKER_URL: "https://china-expense-worker.<your-subdomain>.workers.dev",
SUBMIT_KEY: "지점에 공유한 공용 비밀번호(설정했다면)",
```

수정 후 GitHub에 커밋/푸시하면 GitHub Pages 사이트에 자동 반영됩니다.

## 7. 접속 테스트 (특히 중국 현지에서)
`*.workers.dev` 도메인은 지역에 따라 접속이 불안정할 수 있습니다.
반드시 중국 현지 담당자에게 실제 접속 테스트를 부탁하세요.
문제가 있다면 Cloudflare에 커스텀 도메인을 연결하는 방법으로 대체할 수 있습니다
(도메인이 있다면 말씀해주시면 안내해 드리겠습니다).

## 참고: 데이터 확인/삭제
```
npx wrangler d1 execute china-expense-db --remote --command="SELECT * FROM entries LIMIT 20"
```
