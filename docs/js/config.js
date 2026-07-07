// ===== 이 파일만 수정하면 됩니다 (본사/지점 공통 설정) =====
window.APP_CONFIG = {
  // Supabase 프로젝트 생성 후 이 두 값을 채우면 "① 서버로 제출" 기능이 활성화됩니다.
  // Supabase 대시보드 > Project Settings > API 에서 확인 (Project URL / anon public key)
  // 자세한 절차는 supabase/README-deploy.md 참고
  SUPABASE_URL: "https://ipnuhxmvsyuerlvqeyoa.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_juVphLpldO2Ml5JiA3cKaw_nh0YjN2A",

  // 지점 담당자가 서버 제출 시 입력하는 간단한 공용 비밀번호(스팸 방지용, 필수 아님)
  // supabase/schema.sql 의 submit_entries 함수 안 CHANGE_ME_SUBMIT_KEY 와 동일한 값을 넣으세요.
  SUBMIT_KEY: "",

  // 법인 목록 (ko 값이 저장/보고 기준 값입니다. zh/en은 화면 표시용 번역만 담당)
  CORPORATIONS: [
    { ko: "YJC 포워딩", zh: "裕佳昌 货代", en: "YJC Forwarding" },
    { ko: "상해물류센터", zh: "上海 物流中心", en: "YJC CY&WH" },
    { ko: "흥아물류", zh: "兴亚物流", en: "Heung-A Logistics" },
    { ko: "윤봉물류", zh: "润峰物流", en: "Runfeng" },
    { ko: "청도 CY", zh: "青岛 CY", en: "Qingdao CY" },
    { ko: "창씽 CY", zh: "长兴 CY", en: "CML CX CY" },
    { ko: "기타", zh: "其他", en: "Other" }
  ],

  // 지역 목록
  REGIONS: [
    { ko: "상해", zh: "上海", en: "Shanghai" },
    { ko: "닝보", zh: "宁波", en: "Ningbo" },
    { ko: "남경", zh: "南京", en: "Nanjing" },
    { ko: "충칭", zh: "重庆", en: "Chongqing" },
    { ko: "천진", zh: "天津", en: "Tianjin" },
    { ko: "대련", zh: "大连", en: "Dalian" },
    { ko: "청도", zh: "青岛", en: "Qingdao" },
    { ko: "위해", zh: "威海", en: "Weihai" },
    { ko: "연태", zh: "烟台", en: "Yantai" },
    { ko: "심천", zh: "深圳", en: "Shenzhen" },
    { ko: "광주", zh: "广州", en: "Guangzhou" },
    { ko: "홍콩", zh: "香港", en: "Hongkong" },
    { ko: "연운항", zh: "连云港", en: "Lianyungang" },
    { ko: "하문", zh: "厦门", en: "Xiamen" },
    { ko: "기타", zh: "其他", en: "Other" }
  ],

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
