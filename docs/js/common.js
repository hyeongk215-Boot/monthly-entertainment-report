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

// 법인/지역은 한국어(ko) 값을 저장/보고 기준으로 쓰고, 화면 표시만 언어별로 바꿉니다.
function findByKo(list, koValue) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].ko === koValue) return list[i];
  }
  return null;
}
window.corpLabel = function (koValue, lang) {
  var item = findByKo(window.APP_CONFIG.CORPORATIONS, koValue);
  if (!item) return koValue;
  return item[lang || getLang()] || item.ko;
};
window.regionLabel = function (koValue, lang) {
  var item = findByKo(window.APP_CONFIG.REGIONS, koValue);
  if (!item) return koValue;
  return item[lang || getLang()] || item.ko;
};

// 지역을 "기타"로 선택한 경우, 취합 화면에서는 지역 대신 입력받은 사무소/지점명을 표시합니다.
window.regionDisplay = function (koValue, office, lang) {
  if (koValue === "기타" && office) return office;
  return window.regionLabel(koValue, lang);
};

// 지점마다 다른 언어로 내보낸 엑셀 파일을 병합할 때, 법인/지역 값을 언어에 관계없이
// 하나의 기준(한국어 ko값)으로 되돌려서 병합본을 일관되게 만듭니다.
// (매칭되는 항목이 없으면 원래 값을 그대로 둡니다 - 예: "기타" 대신 들어간 사무소명)
function findKoByAnyLabel(list, anyValue) {
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (item.ko === anyValue || item.zh === anyValue || item.en === anyValue) return item.ko;
  }
  return anyValue;
}
window.corpKoFromLabel = function (anyValue) {
  return findKoByAnyLabel(window.APP_CONFIG.CORPORATIONS, anyValue);
};
window.regionKoFromLabel = function (anyValue) {
  return findKoByAnyLabel(window.APP_CONFIG.REGIONS, anyValue);
};

// ===== localStorage 임시저장 =====
// 같은 PC에서 여러 사용자(대리 작성 포함) 내역을 입력할 수 있으므로 사용자명까지 키에 포함합니다.
window.draftKey = function (corp, region, yearmonth, submitter) {
  return "draft::" + corp + "::" + region + "::" + yearmonth + "::" + (submitter || "");
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

// ===== 엑셀 내보내기 =====
// 취합본(merge/admin)과 동일한 컬럼 구성을 사용합니다: 지역을 "기타"로 선택한 경우
// 지역 칸에 사무소/지점명을 대신 표시하고, 별도의 사무소/지점 컬럼은 두지 않습니다.
// 헤더/총액 라벨/결재구분 값은 모두 현재 선택된 언어로 출력됩니다.
window.buildWorkbook = function (context, rows) {
  var header = [
    t("rowNumberCol"), t("corp"), t("region"), t("yearmonth"), t("submitterCol"), t("colDate"),
    t("colCurrency"), t("colAmount"), t("colCnyAmount"), t("colVendor"), t("colHeadcount"), t("colNote"), t("colTier")
  ];
  var aoa = [header];
  var totalCny = 0;
  rows.forEach(function (r, i) {
    totalCny += Number(r.cnyAmount) || 0;
    aoa.push([
      i + 1, window.corpLabel(context.corp), window.regionDisplay(context.region, context.office), context.yearmonth, context.submitter,
      r.date, r.currency, r.amount, r.cnyAmount, r.vendor,
      r.headcount, r.note || "", t(window.classifyTier(Number(r.cnyAmount) || 0))
    ]);
  });
  aoa.push([]);
  aoa.push(["", "", "", "", "", "", "", "", t("totalCnyLabel"), totalCny]);
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 5 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 },
    { wch: 20 }, { wch: 22 }
  ];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t("sheetNameSingle"));
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

// 법인 -> 지역 -> 사용자(작성자) -> 일시 순으로 정렬 (법인 필터 시에도 동일 기준 유지)
window.sortExpenseRows = function (rows) {
  return rows.slice().sort(function (a, b) {
    var ac = (a.corp || ""), bc = (b.corp || "");
    if (ac !== bc) return ac < bc ? -1 : 1;
    var ar = (a.region || ""), br = (b.region || "");
    if (ar !== br) return ar < br ? -1 : 1;
    var au = (a.submitter || a.submittedBy || ""), bu = (b.submitter || b.submittedBy || "");
    if (au !== bu) return au < bu ? -1 : 1;
    var ad = (a.date || ""), bd = (b.date || "");
    if (ad !== bd) return ad < bd ? -1 : 1;
    return 0;
  });
};

// 업로드된 지점 엑셀 파일(위 buildWorkbook 형식)을 파싱해서 rows 배열로 복원
// 헤더 문구는 언어별로 다를 수 있으므로(내보낼 때 선택 언어로 기록됨) 문구가 아닌
// 고정된 컬럼 순서(번호/법인/지역/적용년도월/사용자/일시/단위/금액/CNY환산액/접대처/인원수/비고/결재구분)로 읽습니다.
window.parseWorkbookFile = function (file) {
  return file.arrayBuffer().then(function (buf) {
    var wb = XLSX.read(buf, { type: "array" });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    var rows = [];
    for (var i = 1; i < aoa.length; i++) {
      var r = aoa[i];
      if (!r || !r[1]) break;
      if (r[5] === undefined || r[5] === "") continue;
      rows.push({
        corp: r[1], region: r[2], yearmonth: r[3], submitter: r[4],
        date: r[5], currency: r[6], amount: r[7], cnyAmount: r[8], vendor: r[9],
        headcount: r[10], note: r[11], sourceFile: file.name
      });
    }
    return rows;
  });
};
