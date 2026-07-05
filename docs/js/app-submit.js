(function () {
  var ctx = window.loadContext();
  if (!ctx) { window.location.href = "index.html"; return; }

  var dKey = window.draftKey(ctx.corp, ctx.region, ctx.yearmonth);
  var rows = [];
  var pendingSubmitAction = null; // "server" | "export"

  function emptyRow() {
    return { date: "", currency: "CNY", amount: "", cnyAmount: "", vendor: "", headcount: "", note: "" };
  }

  function renderContextBar() {
    var bar = document.getElementById("contextBar");
    bar.innerHTML =
      "<div>" + t("corp") + ": <b>" + ctx.corp + "</b></div>" +
      "<div>" + t("region") + ": <b>" + ctx.region + "</b></div>" +
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
    body.querySelectorAll(".proposal-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = rows[Number(btn.dataset.i)];
        var text = t("proposalTemplate", { vendor: r.vendor || "-", date: r.date || "-", amount: r.cnyAmount || r.amount || "-", headcount: r.headcount || "-" });
        navigator.clipboard.writeText(text).then(function () { showToast(t("proposalCopied")); });
      });
    });
  }

  function onFieldChange(e) {
    var i = Number(e.target.dataset.i);
    var field = e.target.dataset.field;
    rows[i][field] = e.target.value;
    if (field === "currency" && e.target.value === "CNY") {
      rows[i].cnyAmount = rows[i].amount;
    }
    if (field === "amount" && rows[i].currency === "CNY") {
      rows[i].cnyAmount = e.target.value;
    }
    // 결재구분/품의서 배지만 다시 그리되 입력 포커스를 잃지 않도록 필요한 셀만 갱신
    if (field === "amount" || field === "cnyAmount" || field === "currency") {
      renderRows();
      var target = document.querySelector("[data-field='" + field + "'][data-i='" + i + "']");
      if (target) target.focus();
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
      if (!r.date || !r.amount || !r.vendor || !r.headcount) {
        showToast(t("validationIncompleteRow", { n: i + 1 }));
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
      corp: ctx.corp, region: ctx.region, yearmonth: ctx.yearmonth, submitter: ctx.submitter,
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
    var url = window.APP_CONFIG.WORKER_URL;
    if (!url) { showToast(t("submitFail")); return; }
    fetch(url.replace(/\/$/, "") + "/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        corp: ctx.corp, region: ctx.region, yearmonth: ctx.yearmonth,
        submittedBy: ctx.submitter, office: ctx.office || "",
        submitKey: window.APP_CONFIG.SUBMIT_KEY || "",
        rows: rows
      })
    }).then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    }).then(function () {
      showToast(t("submitSuccess"));
      window.clearDraft(dKey);
    }).catch(function () {
      showToast(t("submitFail"));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderContextBar();
    document.addEventListener("langchange", function () { renderContextBar(); renderRows(); });

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
