# 중국 지점 접대비 취합 시스템

중국 분공사 담당자가 매월 접대비 내역을 입력하고, 중국 본사 담당자가 이를 취합해
한국 본사에 엑셀로 보고할 수 있도록 만든 웹 도구입니다. 한국어/中文/English 3개 언어를 지원합니다.

## 구성
- `docs/` — GitHub Pages로 배포되는 프론트엔드 (지점 담당자, 본사 담당자 모두 이 사이트를 사용)
  - `index.html` — 법인/지역/적용년도월/작성자 선택
  - `submit.html` — 접대비 내역 입력, 임시저장(자동저장 포함), 최종 제출
  - `merge.html` — [본사용] 지점들이 내보낸 엑셀 파일 여러 개를 업로드해서 자동 병합 (③ 방식)
  - `admin.html` — [본사용] Cloudflare Worker에 저장된 데이터를 월별로 조회/다운로드 (① 방식)
- `worker/` — (선택) ① 서버 제출 방식을 쓸 경우에만 필요한 Cloudflare Worker + D1 백엔드

## 두 가지 제출 방식 (둘 다 만들어져 있으며, 테스트 후 하나를 선택하거나 병행 사용 가능)
1. **① 서버로 최종 제출**: Cloudflare Worker(무료)에 데이터가 저장되고, 본사는 `admin.html`에서 바로 조회/다운로드합니다.
   실시간 취합이 가능하지만 `worker/README-deploy.md`대로 별도 배포가 필요합니다.
2. **③ 엑셀 파일로 내보내기**: 지점 담당자가 버튼을 누르면 엑셀 파일이 다운로드되고, 이를 메일 등으로 본사에 보내면
   본사가 `merge.html`에서 여러 파일을 업로드해 자동으로 하나의 표로 병합합니다. 서버/배포가 전혀 필요 없습니다.

두 버튼 모두 항상 화면에 보이므로, 실제 중국 현지에서 접속 테스트를 해보시고 더 편한 방식을 쓰시면 됩니다.

## GitHub Pages로 배포하는 방법

1. 이 폴더 전체를 본인 GitHub 계정의 새 저장소(Repository)에 올립니다.
   ```
   cd "china-expense-app"
   git init
   git add .
   git commit -m "Initial commit: 중국 지점 접대비 취합 시스템"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. GitHub 저장소 페이지에서 **Settings → Pages** 로 이동합니다.
3. "Build and deployment" 섹션에서 **Source: Deploy from a branch** 선택,
   Branch는 `main` / 폴더는 `/docs` 를 선택 후 저장합니다.
4. 1~2분 후 `https://<your-username>.github.io/<repo-name>/` 주소로 접속하면 사이트가 열립니다.
5. 이 주소를 각 지점(분공사) 담당자에게 공유하면, 중국에서도 GitHub Pages는 접속이 가능하므로 별도 VPN 없이 사용할 수 있습니다.

## ① 서버 제출(Cloudflare Worker) 방식을 쓰려면
`worker/README-deploy.md` 문서를 따라 배포한 뒤, `docs/js/config.js`의 `WORKER_URL` 값을 채우고 다시 커밋/푸시하세요.

## 접대비 규정 반영 사항
`중국 접대비 관리 규정 (최종)`을 반영하여 다음 기능이 포함되어 있습니다.
- CNY 환산 금액에 따라 결재구분(일반/중요/특별 접대) 자동 표시
- 1회 접대 CNY 5,000 초과 시 별도 지출 품의서 문구를 자동 생성해 복사 가능
- 화면 하단에 익월 5일/10일 보고 기한 안내 문구 표시

## 커스터마이징
- 법인/지역/통화 목록, 승인 기준 금액: `docs/js/config.js`
- 다국어 문구: `docs/js/i18n.js`


