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
      tr.innerHTML = "<td>" + count + "</td><td>" + r.corp + "</td><td>" + window.regionDisplay(r.region, r.office) + "</td><td>" +
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
        allRows = allRows.concat.apply([], results);
        renderPreview();
      });
  }

  function downloadMerged() {
    var ymFilter = document.getElementById("ymFilter").value;
    var filtered = window.sortExpenseRows(allRows.filter(function (r) { return !ymFilter || r.yearmonth === ymFilter; }));
    if (!filtered.length) { showToast(t("mergeNoFiles")); return; }
    var header = ["번호", "법인", "지역", "사용자", "일시", "단위", "금액", "CNY 환산액", "접대처", "인원수", "비고", "원본파일"];
    var aoa = [header];
    var total = 0;
    filtered.forEach(function (r, i) {
      total += Number(r.cnyAmount) || 0;
      aoa.push([i + 1, r.corp, window.regionDisplay(r.region, r.office), r.submitter || "", r.date, r.currency, r.amount, r.cnyAmount, r.vendor, r.headcount, r.note || "", r.sourceFile || ""]);
    });
    aoa.push([]);
    aoa.push(["", "", "", "", "", "", "", "총액(CNY)", total]);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 24 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "취합본");
    XLSX.writeFile(wb, t("fileNamePrefix") + "_취합_" + (ymFilter || "all") + ".xlsx");
  }

  document.addEventListener("DOMContentLoaded", function () {
    fillYmFilter();
    document.addEventListener("langchange", fillYmFilter);
    document.getElementById("fileInput").addEventListener("change", function (e) { handleFiles(e.target.files); });
    document.getElementById("ymFilter").addEventListener("change", renderPreview);
    document.getElementById("downloadBtn").addEventListener("click", downloadMerged);
  });
})();
