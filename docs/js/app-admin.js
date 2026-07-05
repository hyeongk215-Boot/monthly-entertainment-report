(function () {
  var lastData = null;

  function showToast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 2500);
  }

  function fillYm() {
    var sel = document.getElementById("adminYm");
    sel.innerHTML = "";
    window.generateYearMonths().forEach(function (ym) {
      var o = document.createElement("option");
      o.value = ym; o.textContent = ym;
      sel.appendChild(o);
    });
    sel.value = window.defaultYearMonth();
  }

  function renderStatusGrid(submittedList) {
    var grid = document.getElementById("statusGrid");
    grid.innerHTML = "";
    var submittedCorps = {};
    (submittedList || []).forEach(function (s) { submittedCorps[s.corp] = s; });
    window.APP_CONFIG.CORPORATIONS.forEach(function (corpItem) {
      if (corpItem.ko === "기타") return;
      var s = submittedCorps[corpItem.ko];
      var div = document.createElement("div");
      div.className = "status-chip " + (s ? "ok" : "missing");
      div.innerHTML = "<b>" + window.corpLabel(corpItem.ko) + "</b><br>" + (s ? t("adminSubmitted") + " (" + (s.submittedBy || "") + ")" : t("adminNotSubmitted"));
      grid.appendChild(div);
    });
  }

  function renderTable(rows) {
    var body = document.getElementById("previewBody");
    body.innerHTML = "";
    var total = 0;
    rows.forEach(function (r, i) {
      total += Number(r.cnyAmount) || 0;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + r.corp + "</td><td>" + r.region + "</td><td>" +
        (r.office || "") + "</td><td>" + (r.submittedBy || "") + "</td><td>" + r.date + "</td><td>" +
        r.currency + "</td><td>" + r.amount + "</td><td>" + r.cnyAmount + "</td><td>" + r.vendor +
        "</td><td>" + r.headcount + "</td><td>" + (r.note || "") + "</td><td style='font-size:11px;color:var(--muted);'>" + (r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "") + "</td>";
      body.appendChild(tr);
    });
    document.getElementById("totalRows").textContent = rows.length;
    document.getElementById("totalCny").textContent = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function fetchData() {
    var url = window.APP_CONFIG.WORKER_URL;
    var key = document.getElementById("adminKey").value;
    var ym = document.getElementById("adminYm").value;
    if (!url) { showToast(t("adminFetchFail")); return; }
    fetch(url.replace(/\/$/, "") + "/api/aggregate?yearmonth=" + encodeURIComponent(ym), {
      headers: { "X-Admin-Key": key }
    }).then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    }).then(function (data) {
      lastData = data;
      renderStatusGrid(data.submissions || []);
      renderTable(data.rows || []);
    }).catch(function () {
      showToast(t("adminFetchFail"));
    });
  }

  function downloadAggregate() {
    if (!lastData || !lastData.rows || !lastData.rows.length) { showToast(t("mergeNoFiles")); return; }
    var ym = document.getElementById("adminYm").value;
    var header = ["번호", "법인", "지역", "사무소/지점", "작성자", "일시", "단위", "금액", "CNY 환산액", "접대처", "인원수", "비고", "제출일시"];
    var aoa = [header];
    var total = 0;
    lastData.rows.forEach(function (r, i) {
      total += Number(r.cnyAmount) || 0;
      aoa.push([i + 1, r.corp, r.region, r.office || "", r.submittedBy || "", r.date, r.currency, r.amount, r.cnyAmount, r.vendor, r.headcount, r.note || "", r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ""]);
    });
    aoa.push([]);
    aoa.push(["", "", "", "", "", "", "", "", "총액(CNY)", total]);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 18 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "취합본");
    XLSX.writeFile(wb, t("fileNamePrefix") + "_취합_" + ym + ".xlsx");
  }

  document.addEventListener("DOMContentLoaded", function () {
    fillYm();
    document.addEventListener("langchange", fillYm);
    document.getElementById("fetchBtn").addEventListener("click", fetchData);
    document.getElementById("downloadBtn").addEventListener("click", downloadAggregate);
  });
})();
