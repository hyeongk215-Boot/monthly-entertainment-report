// 공통 유틸 함수 모음

// 최근 N개월 ~ 다음 1개월까지 "YYYY-MM" 목록 생성, 기본값은 전월(규정상 익월 보고 기준)
window.generateYearMonths = function (back, forward) {
  back = back == null ? 18 : back;
  forward = forward == null ? 1 : forward;
  var now = new Date();
  var list = [];
  for (var i = -back; i <= forward; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    var ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    list.push(ym);
  }
  return list.reverse();
};

window.defaultYearMonth = function () {
  var now = new Date();
  var d = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 전월
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

// 접대비 관리 규정 제2장 제1조 - CNY 환산액 기준 전결권한 분류
window.classifyTier = function (cnyAmount) {
  var tiers = window.APP_CONFIG.APPROVAL_TIERS;
  for (var i = 0; i < tiers.length; i++) {
    if (cnyAmount < tiers[i].max) return tiers[i].key;
  }
  return tiers[tiers.length - 1].key;
};

window.needsProposal = function (cnyAmount) {
  return cnyAmount > window.APP_CONFIG.PROPOSAL_THRESHOLD_CNY;
};

// ===== localStorage 임시저장 =====
window.draftKey = function (corp, region, yearmonth) {
  return "draft::" + corp + "::" + region + "::" + yearmonth;
};
window.saveDraft = function (key, data) {
  data._savedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(data));
  return data._savedAt;
};
window.loadDraft = function (key) {
  var raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};
window.clearDraft = function (key) {
  localStorage.removeItem(key);
};

// ===== 세션 컨텍스트 (법인/지역/년월/작성자) =====
window.saveContext = function (ctx) {
  sessionStorage.setItem("submitContext", JSON.stringify(ctx));
};
window.loadContext = function () {
  var raw = sessionStorage.getItem("submitContext");
  return raw ? JSON.parse(raw) : null;
};

// ===== 엑셀 내보내기 (해외 주재원 월별 접대비 리스트.xlsx 형식과 유사하게) =====
// rows: [{date, currency, amount, cnyAmount, vendor, headcount, note}]
window.buildWorkbook = function (context, rows) {
  var header = [
    "번호", "법인", "지역", "적용년도월", "작성자", "사무소/지점", "일시",
    "단위", "금액", "CNY 환산액", "접대처", "인원수", "비고", "결재구분"
  ];
  var aoa = [header];
  var totalCny = 0;
  rows.forEach(function (r, i) {
    totalCny += Number(r.cnyAmount) || 0;
    aoa.push([
      i + 1, context.corp, context.region, context.yearmonth, context.submitter,
      context.office || "", r.date, r.currency, r.amount, r.cnyAmount, r.vendor,
      r.headcount, r.note || "", t(window.classifyTier(Number(r.cnyAmount) || 0))
    ]);
  });
  aoa.push([]);
  aoa.push(["", "", "", "", "", "", "", "", "", "총액(CNY)", totalCny]);
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 5 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 },
    { wch: 20 }, { wch: 22 }
  ];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "접대비내역");
  return wb;
};

window.downloadWorkbook = function (wb, filename) {
  XLSX.writeFile(wb, filename);
};

window.exportContextRows = function (context, rows, i18nPrefixKey) {
  var wb = window.buildWorkbook(context, rows);
  var fname = t(i18nPrefixKey || "fileNamePrefix") + "_" + context.corp + "_" + context.region + "_" + context.yearmonth + ".xlsx";
  window.downloadWorkbook(wb, fname);
};

// 업로드된 지점 엑셀 파일(위 buildWorkbook 형식)을 파싱해서 rows 배열로 복원
window.parseWorkbookFile = function (file) {
  return file.arrayBuffer().then(function (buf) {
    var wb = XLSX.read(buf, { type: "array" });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    var rows = [];
    for (var i = 1; i < aoa.length; i++) {
      var r = aoa[i];
      if (!r || !r[1] || r[9] === "총액(CNY)") break;
      if (r[6] === undefined || r[6] === "") continue;
      rows.push({
        corp: r[1], region: r[2], yearmonth: r[3], submitter: r[4], office: r[5],
        date: r[6], currency: r[7], amount: r[8], cnyAmount: r[9], vendor: r[10],
        headcount: r[11], note: r[12], sourceFile: file.name
      });
    }
    return rows;
  });
};
