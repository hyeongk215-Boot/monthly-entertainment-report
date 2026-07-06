(function () {
  var lastData = null;
  var corpFilter = null; // 클릭한 법인(ko값)만 보기, null이면 전체

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

  function filteredRows() {
    var rows = (lastData && lastData.rows) || [];
    if (corpFilter) rows = rows.filter(function (r) { return r.corp === corpFilter; });
    return window.sortExpenseRows(rows);
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
      div.style.cursor = "pointer";
      if (corpFilter === corpItem.ko) div.style.outline = "2px solid var(--primary)";
      div.innerHTML = "<b>" + window.corpLabel(corpItem.ko) + "</b><br>" + (s ? t("adminSubmitted") + " (" + (s.submittedBy || "") + ")" : t("adminNotSubmitted"));
      div.addEventListener("click", function () {
        corpFilter = (corpFilter === corpItem.ko) ? null : corpItem.ko;
        renderAll();
      });
      grid.appendChild(div);
    });
    document.getElementById("filterAllWrap").style.display = corpFilter ? "block" : "none";
  }

  function deleteEntry(id) {
    if (!confirm(t("adminDeleteConfirm"))) return;
    var url = window.APP_CONFIG.WORKER_URL;
    var key = document.getElementById("adminKey").value;
    fetch(url.replace(/\/$/, "") + "/api/entry?id=" + encodeURIComponent(id), {
      method: "DELETE",
      headers: { "X-Admin-Key": key }
    }).then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    }).then(function () {
      showToast(t("adminDeleteSuccess"));
      lastData.rows = lastData.rows.filter(function (r) { return String(r.id) !== String(id); });
      renderAll();
    }).catch(function () {
      showToast(t("adminDeleteFail"));
    });
  }

  function renderTable() {
    var rows = filteredRows();
    var body = document.getElementById("previewBody");
    body.innerHTML = "";
    var total = 0;
    rows.forEach(function (r, i) {
      total += Number(r.cnyAmount) || 0;
      var preApprovalText = r.preApproved === 1 ? t("preApprovalChecked") : (r.preApproved === 0 ? t("preApprovalUnchecked") : t("preApprovalNA"));
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + window.corpLabel(r.corp) + "</td><td>" + window.regionDisplay(r.region, r.office) + "</td><td>" +
        (r.submittedBy || "") + "</td><td>" + r.date + "</td><td>" +
        r.currency + "</td><td>" + r.amount + "</td><td>" + r.cnyAmount + "</td><td>" + r.vendor +
        "</td><td>" + r.headcount + "</td><td>" + (r.note || "") + "</td><td>" + preApprovalText + "</td><td style='font-size:11px;color:var(--muted);'>" + (r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "") + "</td>" +
        "<td><button class='btn-danger del-btn' data-id='" + r.id + "' style='font-size:11px;padding:5px 8px;'>" + t("adminDeleteBtn") + "</button></td>";
      body.appendChild(tr);
    });
    document.getElementById("totalRows").textContent = rows.length;
    document.getElementById("totalCny").textContent = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
    body.querySelectorAll(".del-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteEntry(btn.dataset.id); });
    });
  }

  function renderAll() {
    renderStatusGrid((lastData && lastData.submissions) || []);
    renderTable();
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
      corpFilter = null;
      renderAll();
    }).catch(function () {
      showToast(t("adminFetchFail"));
    });
  }

  function downloadAggregate() {
    var rows = filteredRows();
    if (!rows.length) { showToast(t("mergeNoFiles")); return; }
    var ym = document.getElementById("adminYm").value;
    var header = [t("rowNumberCol"), t("corp"), t("region"), t("submitterCol"), t("colDate"), t("colCurrency"),
      t("colAmount"), t("colCnyAmount"), t("colVendor"), t("colHeadcount"), t("colNote"), t("submittedAtCol")];
    var aoa = [header];
    var total = 0;
    rows.forEach(function (r, i) {
      total += Number(r.cnyAmount) || 0;
      aoa.push([i + 1, r.corp, window.regionDisplay(r.region, r.office), r.submittedBy || "", r.date, r.currency, r.amount, r.cnyAmount, r.vendor, r.headcount, r.note || "", r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ""]);
    });
    aoa.push([]);
    aoa.push(["", "", "", "", "", "", "", t("totalCnyLabel"), total]);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 18 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("sheetNameMerged"));
    var suffix = corpFilter ? "_" + corpFilter : "";
    XLSX.writeFile(wb, t("fileNamePrefix") + "_" + t("mergedWord") + "_" + ym + suffix + ".xlsx");
  }

  document.addEventListener("DOMContentLoaded", function () {
    fillYm();
    document.addEventListener("langchange", fillYm);
    document.getElementById("fetchBtn").addEventListener("click", fetchData);
    document.getElementById("downloadBtn").addEventListener("click", downloadAggregate);
    document.getElementById("filterAllBtn").addEventListener("click", function () {
      corpFilter = null;
      renderAll();
    });
  });
})();
