(function () {
  var allRows = [];

  function showToast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 2500);
  }

  function fillYmFilter() {
    var sel = document.getElementById("ymFilter");
    sel.innerHTML = "<option value=''>" + t("selectPlaceholder") + "</option>";
    window.generateYearMonths().forEach(function (ym) {
      var o = document.createElement("option");
      o.value = ym; o.textContent = ym;
      sel.appendChild(o);
    });
    sel.value = window.defaultYearMonth();
  }

  function renderPreview() {
    var ymFilter = document.getElementById("ymFilter").value;
    var body = document.getElementById("previewBody");
    body.innerHTML = "";
    var total = 0, count = 0;
    var sorted = window.sortExpenseRows(allRows);
    sorted.forEach(function (r, i) {
      if (ymFilter && r.yearmonth !== ymFilter) return;
      count++;
      total += Number(r.cnyAmount) || 0;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + count + "</td><td>" + window.corpLabel(r.corp) + "</td><td>" + window.regionLabel(r.region) + "</td><td>" +
        (r.submitter || "") + "</td><td>" + r.date + "</td><td>" +
        r.currency + "</td><td>" + r.amount + "</td><td>" + r.cnyAmount + "</td><td>" + r.vendor +
        "</td><td>" + r.headcount + "</td><td>" + (r.note || "") + "</td><td style='font-size:11px;color:var(--muted);'>" + (r.sourceFile || "") + "</td>";
      body.appendChild(tr);
    });
    document.getElementById("totalRows").textContent = count;
    document.getElementById("totalCny").textContent = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function handleFiles(fileList) {
    var files = Array.from(fileList);
    Promise.all(files.map(function (f) { return window.parseWorkbookFile(f); }))
      .then(function (results) {
        var newRows = [].concat.apply([], results);
        // 지점마다 다른 언어로 내보냈어도 병합본은 하나의 기준(한국어)으로 통일합니다.
        newRows.forEach(function (r) {
          r.corp = window.corpKoFromLabel(r.corp);
          r.region = window.regionKoFromLabel(r.region);
        });
        allRows = allRows.concat(newRows);
        renderPreview();
      });
  }

  function downloadMerged() {
    var ymFilter = document.getElementById("ymFilter").value;
    var filtered = window.sortExpenseRows(allRows.filter(function (r) { return !ymFilter || r.yearmonth === ymFilter; }));
    if (!filtered.length) { showToast(t("mergeNoFiles")); return; }
    var header = [t("rowNumberCol"), t("corp"), t("region"), t("submitterCol"), t("colDate"), t("colCurrency"),
      t("colAmount"), t("colCnyAmount"), t("colVendor"), t("colHeadcount"), t("colNote"), t("sourceFileCol")];
    var aoa = [header];
    var total = 0;
    filtered.forEach(function (r, i) {
      total += Number(r.cnyAmount) || 0;
      aoa.push([i + 1, r.corp, r.region, r.submitter || "", r.date, r.currency, r.amount, r.cnyAmount, r.vendor, r.headcount, r.note || "", r.sourceFile || ""]);
    });
    aoa.push([]);
    aoa.push(["", "", "", "", "", "", "", t("totalCnyLabel"), total]);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 24 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("sheetNameMerged"));
    XLSX.writeFile(wb, t("fileNamePrefix") + "_" + t("mergedWord") + "_" + (ymFilter || "all") + ".xlsx");
  }

  document.addEventListener("DOMContentLoaded", function () {
    fillYmFilter();
    document.addEventListener("langchange", fillYmFilter);
    document.getElementById("fileInput").addEventListener("change", function (e) { handleFiles(e.target.files); });
    document.getElementById("ymFilter").addEventListener("change", renderPreview);
    document.getElementById("downloadBtn").addEventListener("click", downloadMerged);
  });
})();
