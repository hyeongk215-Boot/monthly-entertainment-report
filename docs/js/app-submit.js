(function () {
  var ctx = window.loadContext();
  if (!ctx) { window.location.href = "index.html"; return; }

  var dKey = window.draftKey(ctx.corp, ctx.region, ctx.yearmonth, ctx.submitter);
  var rows = [];
  var pendingSubmitAction = null; // "server" | "export"

  function emptyRow() {
    return { date: "", currency: "CNY", amount: "", cnyAmount: "", vendor: "", headcount: "", note: "", preApproved: false };
  }

  // 사전승인 체크가 필요한 결재구분: 사무소장 승인(일반), 법인장 승인(중요)
  // 한도 미만 건과 본사 임원 확인(특별) 건은 체크 불필요
  function requiresPreApproval(tierKey) {
    return tierKey === "tierGeneral" || tierKey === "tierImportant";
  }

  function renderContextBar() {
    var bar = document.getElementById("contextBar");
    bar.innerHTML =
      "<div>" + t("corp") + ": <b>" + window.corpLabel(ctx.corp) + "</b></div>" +
      "<div>" + t("region") + ": <b>" + window.regionLabel(ctx.region) + "</b></div>" +
      "<div>" + t("yearmonth") + ": <b>" + ctx.yearmonth + "</b></div>" +
      "<div>" + t("submitterName") + ": <b>" + ctx.submitter + "</b></div>" +
      (ctx.office ? "<div>" + t("officeName") + ": <b>" + ctx.office + "</b></div>" : "");
  }

  function tierBadgeClass(key) {
    return { tierNone: "badge-none", tierGeneral: "badge-general", tierImportant: "badge-important", tierSpecial: "badge-special" }[key] || "badge-none";
  }

  function renderRows() {
    var body = document.getElementById("expBody");
    body.innerHTML = "";
    var totalCny = 0;
    rows.forEach(function (r, i) {
      var cny = Number(r.cnyAmount) || 0;
      totalCny += cny;
      var tierKey = window.classifyTier(cny);
      var needsProp = window.needsProposal(cny);
      var needsPreApproval = requiresPreApproval(tierKey);
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + (i + 1) + "</td>" +
        "<td><input type='date' data-field='date' data-i='" + i + "' value='" + (r.date || "") + "'></td>" +
        "<td><select data-field='currency' data-i='" + i + "'>" +
          window.APP_CONFIG.CURRENCIES.map(function (c) {
            return "<option value='" + c + "'" + (r.currency === c ? " selected" : "") + ">" + c + "</option>";
          }).join("") +
        "</select></td>" +
        "<td><input type='number' min='0' step='0.01' data-field='amount' data-i='" + i + "' value='" + (r.amount || "") + "'></td>" +
        "<td><input type='number' min='0' step='0.01' data-field='cnyAmount' data-i='" + i + "' value='" + (r.cnyAmount || "") + "'></td>" +
        "<td><input type='text' data-field='vendor' data-i='" + i + "' value='" + (r.vendor || "").replace(/'/g, "&#39;") + "'></td>" +
        "<td><input type='number' min='0' step='1' data-field='headcount' data-i='" + i + "' value='" + (r.headcount || "") + "'></td>" +
        "<td><input type='text' data-field='note' data-i='" + i + "' value='" + (r.note || "").replace(/'/g, "&#39;") + "'></td>" +
        "<td><span class='badge " + tierBadgeClass(tierKey) + "'>" + t(tierKey) + "</span></td>" +
        "<td>" + (needsPreApproval ? "<input type='checkbox' data-field='preApproved' data-i='" + i + "'" + (r.preApproved ? " checked" : "") + ">" : "<span style='color:var(--muted);font-size:12px;'>-</span>") + "</td>" +
        "<td>" + (needsProp ? "<button class='btn-secondary proposal-btn' data-i='" + i + "' style='font-size:11px;padding:5px 8px;'>" + t("proposalCopy") + "</button>" : "<span style='color:var(--muted);font-size:12px;'>" + t("proposalNotNeeded") + "</span>") + "</td>" +
        "<td><button class='btn-danger remove-row-btn' data-i='" + i + "' style='font-size:11px;padding:5px 8px;'>" + t("removeRow") + "</button></td>";
      body.appendChild(tr);
    });
    document.getElementById("totalRows").textContent = rows.length;
    document.getElementById("totalCny").textContent = totalCny.toLocaleString(undefined, { maximumFractionDigits: 2 });

    body.querySelectorAll("[data-field]").forEach(function (el) {
      el.addEventListener("input", onFieldChange);
    });
    body.querySelectorAll(".remove-row-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        rows.splice(Number(btn.dataset.i), 1);
        renderRows();
        autosave();
      });
    });
    body.querySelectorAll(".proposal-btn").forEach(bindProposalBtn);
  }

  function bindProposalBtn(btn) {
    btn.addEventListener("click", function () {
      var r = rows[Number(btn.dataset.i)];
      var text = t("proposalTemplate", { vendor: r.vendor || "-", date: r.date || "-", amount: r.cnyAmount || r.amount || "-", headcount: r.headcount || "-" });
      navigator.clipboard.writeText(text).then(function () { showToast(t("proposalCopied")); });
    });
  }

  // 금액/통화가 바뀌어도 표 전체를 다시 그리지 않고, 해당 행의 배지/품의서 칸만 갱신합니다.
  // (표 전체를 다시 그리면 입력 중이던 input이 새로 생성되면서 커서가 맨 앞으로 이동해
  //  "1000" 입력 시 "0001"처럼 뒤집혀 보이는 문제가 있었습니다.)
  function updateRowComputed(i) {
    var tr = document.getElementById("expBody").children[i];
    if (!tr) return;
    var r = rows[i];
    var cny = Number(r.cnyAmount) || 0;
    var tierKey = window.classifyTier(cny);
    var needsProp = window.needsProposal(cny);
    var needsPreApproval = requiresPreApproval(tierKey);
    var cells = tr.children;

    var cnyInput = cells[4].querySelector("input");
    if (cnyInput && document.activeElement !== cnyInput) cnyInput.value = r.cnyAmount;

    var badge = cells[8].querySelector(".badge");
    badge.className = "badge " + tierBadgeClass(tierKey);
    badge.textContent = t(tierKey);

    cells[9].innerHTML = needsPreApproval
      ? "<input type='checkbox' data-field='preApproved' data-i='" + i + "'" + (r.preApproved ? " checked" : "") + ">"
      : "<span style='color:var(--muted);font-size:12px;'>-</span>";
    if (!needsPreApproval) r.preApproved = false;
    var cb = cells[9].querySelector("input[type=checkbox]");
    if (cb) cb.addEventListener("input", onFieldChange);

    cells[10].innerHTML = needsProp
      ? "<button class='btn-secondary proposal-btn' data-i='" + i + "' style='font-size:11px;padding:5px 8px;'>" + t("proposalCopy") + "</button>"
      : "<span style='color:var(--muted);font-size:12px;'>" + t("proposalNotNeeded") + "</span>";
    var btn = cells[10].querySelector(".proposal-btn");
    if (btn) bindProposalBtn(btn);

    var totalCny = rows.reduce(function (s, row) { return s + (Number(row.cnyAmount) || 0); }, 0);
    document.getElementById("totalCny").textContent = totalCny.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function onFieldChange(e) {
    var i = Number(e.target.dataset.i);
    var field = e.target.dataset.field;
    rows[i][field] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (field === "currency" && e.target.value === "CNY") {
      rows[i].cnyAmount = rows[i].amount;
    }
    if (field === "amount" && rows[i].currency === "CNY") {
      rows[i].cnyAmount = e.target.value;
    }
    if (field === "amount" || field === "cnyAmount" || field === "currency") {
      updateRowComputed(i);
    }
    autosave();
  }

  var autosaveTimer = null;
  function autosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      var savedAt = window.saveDraft(dKey, { rows: rows });
      document.getElementById("draftSavedAtWrap").style.display = "block";
      document.getElementById("draftSavedAt").textContent = new Date(savedAt).toLocaleString();
    }, 600);
  }

  function showToast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 2500);
  }

  function validate() {
    if (rows.length === 0) { showToast(t("validationEmptyRows")); return false; }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r.date || !r.amount) {
        showToast(t("validationIncompleteRow", { n: i + 1 }));
        return false;
      }
      var tierKey = window.classifyTier(Number(r.cnyAmount) || 0);
      if (requiresPreApproval(tierKey) && !r.preApproved) {
        showToast(t("validationPreApproval", { n: i + 1 }));
        return false;
      }
    }
    return true;
  }

  function totalCnyValue() {
    return rows.reduce(function (s, r) { return s + (Number(r.cnyAmount) || 0); }, 0);
  }

  function openConfirmModal(action) {
    if (!validate()) return;
    pendingSubmitAction = action;
    document.getElementById("confirmBody").textContent = t("finalConfirmBody", {
      corp: window.corpLabel(ctx.corp), region: window.regionLabel(ctx.region), yearmonth: ctx.yearmonth, submitter: ctx.submitter,
      rows: rows.length, total: totalCnyValue().toLocaleString()
    });
    document.getElementById("confirmModal").classList.add("show");
  }

  function closeModal() {
    document.getElementById("confirmModal").classList.remove("show");
    pendingSubmitAction = null;
  }

  function doExport() {
    window.exportContextRows(ctx, rows);
    showToast(t("exportSuccess"));
  }

  function doServerSubmit() {
    var client = window.getSupabaseClient();
    if (!client) { showToast(t("submitFail")); return; }
    client.rpc("submit_entries", {
      p_corp: ctx.corp, p_region: ctx.region, p_yearmonth: ctx.yearmonth,
      p_office: ctx.office || "", p_submitted_by: ctx.submitter,
      p_submit_key: window.APP_CONFIG.SUBMIT_KEY || "",
      p_rows: rows
    }).then(function (res) {
      if (res.error) throw res.error;
      showToast(t("submitSuccess"));
      window.clearDraft(dKey);
    }).catch(function (err) {
      if (err && String(err.message || "").indexOf("month_closed") !== -1) {
        showToast(t("submitFailClosed"));
        applyMonthClosed();
      } else {
        showToast(t("submitFail"));
      }
    });
  }

  // ===== 월 마감 확인 =====
  function applyMonthClosed() {
    document.getElementById("entryFormArea").style.display = "none";
    document.getElementById("uploadPanelCard").style.display = "none";
    var banner = document.getElementById("monthClosedBanner");
    banner.textContent = t("monthClosedBanner", { yearmonth: ctx.yearmonth, nextYearmonth: window.nextYearMonth(ctx.yearmonth) });
    banner.style.display = "block";
  }

  // ===== 간편 업로드(엑셀 양식으로 일괄 입력) =====
  function downloadUploadTemplate() {
    var header = [t("colDate"), t("colCurrency"), t("colAmount"), t("colCnyAmount"), t("colVendor"), t("colHeadcount"), t("colNote")];
    var example = ["2026-06-01", "CNY", 1000, 1000, "", "", ""];
    var aoa = [header, example];
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 20 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("sheetNameSingle"));
    XLSX.writeFile(wb, t("uploadTemplateFileName") + ".xlsx");
  }

  function normalizeDateCell(v) {
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date) {
      return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
    }
    if (typeof v === "number" && window.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code) {
      var d = XLSX.SSF.parse_date_code(v);
      if (d) return d.y + "-" + String(d.m).padStart(2, "0") + "-" + String(d.d).padStart(2, "0");
    }
    return String(v);
  }

  function handleUploadFile() {
    var fileInput = document.getElementById("uploadFileInput");
    var file = fileInput.files && fileInput.files[0];
    if (!file) { showToast(t("uploadNoFile")); return; }
    file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(buf, { type: "array" });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      var newRows = [];
      for (var i = 1; i < aoa.length; i++) {
        var r = aoa[i];
        if (!r || (!r[0] && !r[2] && !r[4] && !r[6])) continue;
        var currency = r[1] || "CNY";
        var amount = r[2] === undefined ? "" : r[2];
        var cnyAmount = (r[3] === undefined || r[3] === "") ? (currency === "CNY" ? amount : "") : r[3];
        newRows.push({
          date: normalizeDateCell(r[0]), currency: currency, amount: amount, cnyAmount: cnyAmount,
          vendor: r[4] || "", headcount: r[5] === undefined ? "" : r[5], note: r[6] || "", preApproved: false
        });
      }
      if (!newRows.length) { showToast(t("uploadFail")); return; }
      var wasBlank = rows.length === 1 && !rows[0].date && !rows[0].amount && !rows[0].vendor;
      rows = wasBlank ? newRows : rows.concat(newRows);
      renderRows();
      autosave();
      fileInput.value = "";
      showToast(t("uploadSuccess", { n: newRows.length }));
    }).catch(function () {
      showToast(t("uploadFail"));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderContextBar();
    document.addEventListener("langchange", function () {
      renderContextBar();
      renderRows();
      if (document.getElementById("monthClosedBanner").style.display !== "none") applyMonthClosed();
    });
    window.fetchClosedMonths().then(function (closed) {
      if (closed.indexOf(ctx.yearmonth) !== -1) applyMonthClosed();
    });

    var draft = window.loadDraft(dKey);
    if (draft && draft.rows && draft.rows.length) {
      rows = draft.rows;
      showToast(t("draftRestored"));
      if (draft._savedAt) {
        document.getElementById("draftSavedAtWrap").style.display = "block";
        document.getElementById("draftSavedAt").textContent = new Date(draft._savedAt).toLocaleString();
      }
    } else {
      rows = [emptyRow()];
    }
    renderRows();

    document.getElementById("addRowBtn").addEventListener("click", function () {
      rows.push(emptyRow());
      renderRows();
      autosave();
    });
    document.getElementById("draftSaveBtn").addEventListener("click", function () {
      var savedAt = window.saveDraft(dKey, { rows: rows });
      document.getElementById("draftSavedAtWrap").style.display = "block";
      document.getElementById("draftSavedAt").textContent = new Date(savedAt).toLocaleString();
      showToast(t("draftRestored") === t("draftRestored") ? (getLang() === "ko" ? "임시저장 완료" : (getLang() === "zh" ? "已暂存" : "Draft saved")) : "");
    });
    document.getElementById("downloadTemplateBtn").addEventListener("click", downloadUploadTemplate);
    document.getElementById("uploadBtn").addEventListener("click", handleUploadFile);
    document.getElementById("exportBtn").addEventListener("click", function () { openConfirmModal("export"); });
    document.getElementById("serverSubmitBtn").addEventListener("click", function () { openConfirmModal("server"); });
    document.getElementById("confirmNo").addEventListener("click", closeModal);
    document.getElementById("confirmYes").addEventListener("click", function () {
      var action = pendingSubmitAction;
      closeModal();
      if (action === "export") doExport();
      if (action === "server") doServerSubmit();
    });
  });
})();
