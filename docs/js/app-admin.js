(function () {
  var lastData = null;
  var corpFilter = null; // 클릭한 법인(ko값)만 보기, null이면 전체
  var closedMonths = [];

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

  function deleteSelected() {
    var ids = Array.from(document.querySelectorAll(".row-select:checked")).map(function (cb) { return cb.dataset.id; });
    if (ids.length === 0) { showToast(t("adminDeleteSelectedNone")); return; }
    var client = window.getSupabaseClient();
    var key = document.getElementById("adminKey").value;
    if (!client) { showToast(t("adminDeleteFail")); return; }
    if (!key) { showToast(t("adminKeyRequired")); return; }
    if (!confirm(t("adminDeleteConfirm", { n: ids.length }))) return;
    Promise.all(ids.map(function (id) {
      return client.rpc("delete_entry", { p_id: id, p_admin_key: key });
    })).then(function (results) {
      if (results.some(function (r) { return r.error; })) throw new Error("delete_failed");
      showToast(t("adminDeleteSuccess"));
      lastData.rows = lastData.rows.filter(function (r) { return ids.indexOf(String(r.id)) === -1; });
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
        "<td style='text-align:center;'><input type='checkbox' class='row-select' data-id='" + r.id + "'></td>";
      body.appendChild(tr);
    });
    document.getElementById("totalRows").textContent = rows.length;
    document.getElementById("totalCny").textContent = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
    var selectAll = document.getElementById("selectAllCheckbox");
    if (selectAll) selectAll.checked = false;
  }

  function renderAll() {
    renderStatusGrid((lastData && lastData.submissions) || []);
    renderTable();
    renderMonthStatus();
    renderCorpSummary();
  }

  // ===== 법인별 요약 (건수/CNY 총액) =====
  function renderCorpSummary() {
    var rows = (lastData && lastData.rows) || [];
    var ym = document.getElementById("adminYm").value;
    var parts = ym.split("-");
    var byCorp = {};
    rows.forEach(function (r) {
      if (!byCorp[r.corp]) byCorp[r.corp] = { count: 0, total: 0 };
      byCorp[r.corp].count += 1;
      byCorp[r.corp].total += Number(r.cnyAmount) || 0;
    });
    var lines = [t("adminCorpSummaryTitle", { year: parts[0], month: Number(parts[1]) })];
    window.APP_CONFIG.CORPORATIONS.forEach(function (corpItem) {
      if (corpItem.ko === "기타") return;
      var s = byCorp[corpItem.ko] || { count: 0, total: 0 };
      lines.push(t("adminCorpSummaryLine", {
        corp: window.corpLabel(corpItem.ko), count: s.count, total: s.total.toLocaleString(undefined, { maximumFractionDigits: 2 })
      }));
    });
    document.getElementById("corpSummaryText").textContent = lines.join("\n");
  }

  // ===== 월 마감 =====
  function renderMonthStatus() {
    var ym = document.getElementById("adminYm").value;
    var isClosed = closedMonths.indexOf(ym) !== -1;
    var badge = document.getElementById("monthStatusBadge");
    badge.textContent = t(isClosed ? "adminMonthClosedBadge" : "adminMonthOpenBadge");
    badge.className = "badge " + (isClosed ? "badge-special" : "badge-general");
    var btn = document.getElementById("closeMonthBtn");
    btn.textContent = t(isClosed ? "adminReopenMonthBtn" : "adminCloseMonthBtn");
  }

  function refreshClosedMonths() {
    var client = window.getSupabaseClient();
    if (!client) return Promise.resolve();
    return client.rpc("get_closed_months", {}).then(function (res) {
      closedMonths = res.data || [];
      renderMonthStatus();
    });
  }

  function toggleMonthClosed() {
    var ym = document.getElementById("adminYm").value;
    var key = document.getElementById("adminKey").value;
    var isClosed = closedMonths.indexOf(ym) !== -1;
    var client = window.getSupabaseClient();
    if (!client) { showToast(t("adminCloseFail")); return; }
    if (!key) { showToast(t("adminKeyRequired")); return; }
    if (!confirm(t(isClosed ? "adminReopenConfirm" : "adminCloseConfirm", { yearmonth: ym }))) return;
    var fn = isClosed ? "reopen_month" : "close_month";
    client.rpc(fn, { p_yearmonth: ym, p_admin_key: key }).then(function (res) {
      if (res.error) throw res.error;
      showToast(t(isClosed ? "adminReopenSuccess" : "adminCloseSuccess"));
      return refreshClosedMonths();
    }).catch(function () {
      showToast(t("adminCloseFail"));
    });
  }

  function fetchData() {
    var client = window.getSupabaseClient();
    var key = document.getElementById("adminKey").value;
    var ym = document.getElementById("adminYm").value;
    if (!client) { showToast(t("adminFetchFail")); return; }
    client.rpc("get_aggregate", { p_yearmonth: ym, p_admin_key: key }).then(function (res) {
      if (res.error) throw res.error;
      lastData = res.data;
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
    document.addEventListener("langchange", function () { fillYm(); renderMonthStatus(); });
    document.getElementById("fetchBtn").addEventListener("click", fetchData);
    document.getElementById("downloadBtn").addEventListener("click", downloadAggregate);
    document.getElementById("deleteSelectedBtn").addEventListener("click", deleteSelected);
    document.getElementById("selectAllCheckbox").addEventListener("change", function (e) {
      document.querySelectorAll(".row-select").forEach(function (cb) { cb.checked = e.target.checked; });
    });
    document.getElementById("filterAllBtn").addEventListener("click", function () {
      corpFilter = null;
      renderAll();
    });
    document.getElementById("adminYm").addEventListener("change", renderMonthStatus);
    document.getElementById("closeMonthBtn").addEventListener("click", toggleMonthClosed);
    document.getElementById("corpSummaryCopyBtn").addEventListener("click", function () {
      navigator.clipboard.writeText(document.getElementById("corpSummaryText").textContent)
        .then(function () { showToast(t("adminCorpSummaryCopied")); });
    });
    refreshClosedMonths();
  });
})();
