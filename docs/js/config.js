// ===== 이 파일만 수정하면 됩니다 (본사/지점 공통 설정) =====
window.APP_CONFIG = {
  // Cloudflare Worker 배포 후 이 URL을 채우면 "① 서버로 제출" 기능이 활성화됩니다.
  // 예: "https://china-expense-worker.<your-subdomain>.workers.dev"
  WORKER_URL: "",

  // 지점 담당자가 서버 제출 시 입력하는 간단한 공용 비밀번호(스팸 방지용, 필수 아님)
  SUBMIT_KEY: "",

  // 법인 목록 (해외 주재원 월별 접대비 리스트.xlsx 기준)
  CORPORATIONS: ["YJC 포워딩", "상해물류센터", "흥아물류", "천진 윤봉물류", "청도 CY", "창씽CY", "기타"],

  // 지역 목록
  REGIONS: ["상해", "닝보", "남경", "충칭", "천진", "대련", "청도", "위해", "연태", "심천", "광주", "홍콩", "연운항", "하문", "기타"],

  // 통화 단위
  CURRENCIES: ["CNY", "KRW", "USD"],

  // 접대비 관리 규정 제2장 제1조 - 전결 권한 기준 (CNY 환산 금액 기준)
  APPROVAL_TIERS: [
    { max: 2500, key: "tierNone" },
    { max: 5000, key: "tierGeneral" },
    { max: 15000, key: "tierImportant" },
    { max: Infinity, key: "tierSpecial" }
  ],
  // 별도 지출 품의서가 필요한 기준 금액 (CNY)
  PROPOSAL_THRESHOLD_CNY: 5000
};
