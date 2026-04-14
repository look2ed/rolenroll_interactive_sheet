// ===============================
// RolEnRoll Dice System Logic – Browser version
// ===============================

let rollHistory = [];
let resultModal;
let openResultModalBtn;
let closeResultModalBtn;
let resultModalBackdrop;

// key for localStorage
const STORAGE_KEY = "rolenroll_sheet_state_v1";

// central sheet state
const sheetState = {
  attrs: {},   // e.g. { str: 3, dex: 2, int: 4, ... }
  skills: {},  // e.g. { search: 2, art: 1, ... }
  globals: {}, // e.g. { name, health, healthMax, defense, will }
  equipment: [],
  statuses: [],
  items: []
};

document.addEventListener("DOMContentLoaded", () => {
  // 1) Load saved sheet state FIRST (so attrs/skills are ready)
  loadSheetStateFromStorage();

  // 2) Form submit
  const form = document.getElementById("dice-form");
  if (form) form.addEventListener("submit", onSubmit);

  // 3) Help panel toggle
  const helpBtn = document.getElementById("help-toggle");
  const manual = document.getElementById("manual-guide");

  if (helpBtn && manual) {
    helpBtn.addEventListener("click", () => {
      const isNowHidden = manual.classList.toggle("hidden");
      helpBtn.setAttribute("aria-expanded", (!isNowHidden).toString());
    });
  }

  // 4) Language switching (TH / EN)
  const langButtons = document.querySelectorAll(".lang-btn");
  const pageTH = document.getElementById("manual-th");
  const pageEN = document.getElementById("manual-en");

  function setLang(lang) {
    if (!pageTH || !pageEN) return;

    if (lang === "th") {
      pageTH.classList.remove("hidden");
      pageEN.classList.add("hidden");
    } else {
      pageEN.classList.remove("hidden");
      pageTH.classList.add("hidden");
    }

    langButtons.forEach((btn) => {
      const bLang = btn.getAttribute("data-lang");
      if (bLang === lang) btn.classList.add("active");
      else btn.classList.remove("active");
    });
  }

  langButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang") || "th";
      setLang(lang);
    });
  });

  // default language = TH
  setLang("th");

  // 5) History panel toggle
  const historyBtn = document.getElementById("history-toggle");
  const historyPanel = document.getElementById("history-panel");
  if (historyBtn && historyPanel) {
    historyBtn.addEventListener("click", () => {
      const isNowHidden = historyPanel.classList.toggle("hidden");
      historyBtn.setAttribute("aria-expanded", (!isNowHidden).toString());
    });
  }

  // 6) Character-sheet hooks (after state is loaded)
  setupMentalHearts();
  setupStats();

  // 7) Header field persistence
  setupGlobalFieldPersistence();

  // 8) Initial history render
  renderHistory();

  // 9) Result modal controls
  setupResultModal();

  // 10) Equipment block and modal
  setupEquipment();

  // 11) Buff & debuff block and modal
  setupStatuses();

  // 12) Items block and modal
  setupItems();
});

function setupResultModal() {
  resultModal = document.getElementById("result-modal");
  openResultModalBtn = document.getElementById("open-result-modal");
  closeResultModalBtn = document.getElementById("close-result-modal");
  resultModalBackdrop = document.getElementById("result-modal-backdrop");

  if (openResultModalBtn) {
    openResultModalBtn.addEventListener("click", openResultModal);
  }

  if (closeResultModalBtn) {
    closeResultModalBtn.addEventListener("click", closeResultModal);
  }

  if (resultModalBackdrop) {
    resultModalBackdrop.addEventListener("click", closeResultModal);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && resultModal && !resultModal.classList.contains("hidden")) {
      closeResultModal();
    }
  });
}

function openResultModal() {
  if (!resultModal) return;

  resultModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeResultModal() {
  if (!resultModal) return;

  resultModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function setupEquipment() {
  const openBtn = document.getElementById("open-equipment-modal");
  const closeBtn = document.getElementById("close-equipment-modal");
  const cancelBtn = document.getElementById("cancel-equipment-btn");
  const backdrop = document.getElementById("equipment-modal-backdrop");
  const form = document.getElementById("equipment-form");
  const list = document.getElementById("equipment-list");

  if (!list || !form) return;

  if (openBtn) {
    openBtn.addEventListener("click", () => openEquipmentModal());
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeEquipmentModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeEquipmentModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeEquipmentModal);
  }

  form.addEventListener("submit", onEquipmentSubmit);

  list.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("button[data-action]");
    if (!actionBtn) return;

    const id = actionBtn.dataset.id;
    const action = actionBtn.dataset.action;
    const item = sheetState.equipment.find((entry) => entry.id === id);
    if (!item) return;

    if (action === "edit") {
      openEquipmentModal(item);
      return;
    }

    if (action === "remove") {
      removeEquipment(id);
    }
  });

  renderEquipmentList();

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("equipment-modal");
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeEquipmentModal();
    }
  });
}

function openEquipmentModal(item = null) {
  const modal = document.getElementById("equipment-modal");
  const title = document.getElementById("equipment-modal-title");
  const saveBtn = document.getElementById("save-equipment-btn");
  const form = document.getElementById("equipment-form");

  if (!modal || !form) return;

  populateEquipmentForm(item);

  if (title) {
    title.textContent = item ? "Edit Equipment" : "Add Equipment";
  }

  if (saveBtn) {
    saveBtn.textContent = item ? "Save" : "Add";
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEquipmentModal() {
  const modal = document.getElementById("equipment-modal");
  const form = document.getElementById("equipment-form");
  const title = document.getElementById("equipment-modal-title");
  const saveBtn = document.getElementById("save-equipment-btn");

  if (modal) {
    modal.classList.add("hidden");
  }

  if (form) {
    form.reset();
  }

  const idInput = document.getElementById("equipment-id");
  if (idInput) {
    idInput.value = "";
  }

  if (title) {
    title.textContent = "Add Equipment";
  }

  if (saveBtn) {
    saveBtn.textContent = "Add";
  }

  document.body.style.overflow = "";
}

function populateEquipmentForm(item) {
  const idInput = document.getElementById("equipment-id");
  const nameInput = document.getElementById("equipment-name");
  const descriptionInput = document.getElementById("equipment-description");
  const dmgInput = document.getElementById("equipment-dmg");
  const chargeInput = document.getElementById("equipment-charge");
  const defInput = document.getElementById("equipment-def");
  const toughnessInput = document.getElementById("equipment-toughness");

  if (!nameInput) return;

  if (!item) {
    if (idInput) idInput.value = "";
    nameInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    if (dmgInput) dmgInput.value = "";
    if (chargeInput) chargeInput.value = "0";
    if (defInput) defInput.value = "";
    if (toughnessInput) toughnessInput.value = "";
    return;
  }

  if (idInput) idInput.value = item.id;
  nameInput.value = item.name || "";
  if (descriptionInput) descriptionInput.value = item.description || "";
  if (dmgInput) dmgInput.value = item.dmg || "";
  if (chargeInput) chargeInput.value = item.charge ?? 0;
  if (defInput) defInput.value = item.def || "";
  if (toughnessInput) toughnessInput.value = item.toughness || "";
}

function onEquipmentSubmit(event) {
  event.preventDefault();

  const idInput = document.getElementById("equipment-id");
  const nameInput = document.getElementById("equipment-name");
  const descriptionInput = document.getElementById("equipment-description");
  const dmgInput = document.getElementById("equipment-dmg");
  const chargeInput = document.getElementById("equipment-charge");
  const defInput = document.getElementById("equipment-def");
  const toughnessInput = document.getElementById("equipment-toughness");

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter an equipment name.");
    return;
  }

  let charge = parseInt(chargeInput?.value || "0", 10);
  if (Number.isNaN(charge) || charge < 0) charge = 0;

  const existingId = idInput?.value || "";
  const payload = {
    id: existingId || `equip-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    description: descriptionInput?.value.trim() || "",
    dmg: dmgInput?.value.trim() || "",
    charge,
    def: defInput?.value.trim() || "",
    toughness: toughnessInput?.value.trim() || ""
  };

  const existingIndex = sheetState.equipment.findIndex((item) => item.id === payload.id);
  if (existingIndex >= 0) {
    sheetState.equipment[existingIndex] = payload;
  } else {
    sheetState.equipment.unshift(payload);
  }

  saveSheetStateToStorage();
  renderEquipmentList();
  closeEquipmentModal();
}

function removeEquipment(id) {
  sheetState.equipment = sheetState.equipment.filter((item) => item.id !== id);
  saveSheetStateToStorage();
  renderEquipmentList();
}

function renderEquipmentList() {
  const list = document.getElementById("equipment-list");
  if (!list) return;

  if (!Array.isArray(sheetState.equipment) || sheetState.equipment.length === 0) {
    list.innerHTML = '<p class="equipment-empty">No equipment yet.</p>';
    return;
  }

  list.innerHTML = sheetState.equipment
    .map((item) => `
      <div class="equipment-item">
        <div class="equipment-item-info">
          <span class="equipment-name">${escapeHtml(item.name || "")}</span>
          <div class="equipment-preview">
            <span>DMG: ${escapeHtml(item.dmg || "-")}</span>
            <span>Charge: ${escapeHtml(item.charge ?? 0)}</span>
            <span>DEF: ${escapeHtml(item.def || "-")}</span>
            <span>Toughness: ${escapeHtml(item.toughness || "-")}</span>
          </div>
        </div>
        <div class="equipment-item-actions">
          <button type="button" class="icon-action-btn" data-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name || "equipment")}">✎</button>
          <button type="button" class="icon-action-btn equipment-remove-btn" data-action="remove" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.name || "equipment")}">⌫</button>
        </div>
      </div>
    `)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setupStatuses() {
  const openBtn = document.getElementById("open-status-modal");
  const closeBtn = document.getElementById("close-status-modal");
  const cancelBtn = document.getElementById("cancel-status-btn");
  const backdrop = document.getElementById("status-modal-backdrop");
  const form = document.getElementById("status-form");
  const list = document.getElementById("status-list");

  if (!list || !form) return;

  if (openBtn) {
    openBtn.addEventListener("click", () => openStatusModal());
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeStatusModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeStatusModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeStatusModal);
  }

  form.addEventListener("submit", onStatusSubmit);

  list.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("button[data-status-action]");
    if (!actionBtn) return;

    const id = actionBtn.dataset.id;
    const action = actionBtn.dataset.statusAction;
    const item = sheetState.statuses.find((entry) => entry.id === id);
    if (!item) return;

    if (action === "edit") {
      openStatusModal(item);
      return;
    }

    if (action === "remove") {
      removeStatus(id);
    }
  });

  list.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-status-duration-id]");
    if (!input) return;

    updateStatusDuration(input.dataset.statusDurationId, input.value);
  });

  list.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-status-duration-id]");
    if (!input) return;

    updateStatusDuration(input.dataset.statusDurationId, input.value);
  });

  renderStatusList();

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("status-modal");
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeStatusModal();
    }
  });
}

function openStatusModal(item = null) {
  const modal = document.getElementById("status-modal");
  const title = document.getElementById("status-modal-title");
  const saveBtn = document.getElementById("save-status-btn");
  const form = document.getElementById("status-form");

  if (!modal || !form) return;

  populateStatusForm(item);

  if (title) {
    title.textContent = item ? "Edit Buff / Debuff" : "Add Buff / Debuff";
  }

  if (saveBtn) {
    saveBtn.textContent = item ? "Save" : "Save";
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeStatusModal() {
  const modal = document.getElementById("status-modal");
  const form = document.getElementById("status-form");
  const title = document.getElementById("status-modal-title");
  const saveBtn = document.getElementById("save-status-btn");
  const idInput = document.getElementById("status-id");

  if (modal) {
    modal.classList.add("hidden");
  }

  if (form) {
    form.reset();
  }

  if (idInput) {
    idInput.value = "";
  }

  if (title) {
    title.textContent = "Add Buff / Debuff";
  }

  if (saveBtn) {
    saveBtn.textContent = "Save";
  }

  document.body.style.overflow = "";
}

function populateStatusForm(item) {
  const idInput = document.getElementById("status-id");
  const nameInput = document.getElementById("status-name");
  const detailsInput = document.getElementById("status-details");
  const durationInput = document.getElementById("status-duration");
  const typeInputs = document.querySelectorAll('input[name="status-type"]');

  if (!nameInput) return;

  if (!item) {
    if (idInput) idInput.value = "";
    nameInput.value = "";
    if (detailsInput) detailsInput.value = "";
    if (durationInput) durationInput.value = "1";
    typeInputs.forEach((input) => {
      input.checked = input.value === "buff";
    });
    return;
  }

  if (idInput) idInput.value = item.id;
  nameInput.value = item.name || "";
  if (detailsInput) detailsInput.value = item.details || "";
  if (durationInput) durationInput.value = item.duration ?? 1;
  typeInputs.forEach((input) => {
    input.checked = input.value === (item.type || "buff");
  });
}

function onStatusSubmit(event) {
  event.preventDefault();

  const idInput = document.getElementById("status-id");
  const nameInput = document.getElementById("status-name");
  const detailsInput = document.getElementById("status-details");
  const durationInput = document.getElementById("status-duration");
  const selectedType = document.querySelector('input[name="status-type"]:checked');

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter a buff or debuff name.");
    return;
  }

  let duration = parseInt(durationInput?.value || "0", 10);
  if (Number.isNaN(duration) || duration < 0) duration = 0;

  const existingId = idInput?.value || "";
  const payload = {
    id: existingId || `status-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    details: detailsInput?.value.trim() || "",
    duration,
    type: selectedType?.value === "debuff" ? "debuff" : "buff"
  };

  const existingIndex = sheetState.statuses.findIndex((item) => item.id === payload.id);
  if (existingIndex >= 0) {
    sheetState.statuses[existingIndex] = payload;
  } else {
    sheetState.statuses.unshift(payload);
  }

  saveSheetStateToStorage();
  renderStatusList();
  closeStatusModal();
}

function removeStatus(id) {
  sheetState.statuses = sheetState.statuses.filter((item) => item.id !== id);
  saveSheetStateToStorage();
  renderStatusList();
}

function updateStatusDuration(id, value) {
  const item = sheetState.statuses.find((entry) => entry.id === id);
  if (!item) return;

  let duration = parseInt(value ?? "0", 10);
  if (Number.isNaN(duration) || duration < 0) duration = 0;

  item.duration = duration;
  saveSheetStateToStorage();
}

function renderStatusList() {
  const list = document.getElementById("status-list");
  if (!list) return;

  if (!Array.isArray(sheetState.statuses) || sheetState.statuses.length === 0) {
    list.innerHTML = '<p class="equipment-empty">No buffs or debuffs yet.</p>';
    return;
  }

  list.innerHTML = sheetState.statuses
    .map((item) => `
      <div class="status-item status-item-${item.type === "debuff" ? "debuff" : "buff"}">
        <div class="equipment-item-info">
          <span class="equipment-name">${escapeHtml(item.name || "")}</span>
          <div class="status-preview">
            <label class="status-duration-inline">
              <span>Duration</span>
              <input
                type="number"
                min="0"
                value="${escapeHtml(item.duration ?? 0)}"
                data-status-duration-id="${item.id}"
                aria-label="Duration for ${escapeHtml(item.name || "status")}"
              >
              <span>turn(s)</span>
            </label>
          </div>
        </div>
        <div class="status-item-actions">
          <button type="button" class="icon-action-btn" data-status-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name || "status")}">✎</button>
          <button type="button" class="icon-action-btn equipment-remove-btn" data-status-action="remove" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.name || "status")}">⌫</button>
        </div>
      </div>
    `)
    .join("");
}

function setupItems() {
  const openBtn = document.getElementById("open-item-modal");
  const closeBtn = document.getElementById("close-item-modal");
  const cancelBtn = document.getElementById("cancel-item-btn");
  const backdrop = document.getElementById("item-modal-backdrop");
  const form = document.getElementById("item-form");
  const list = document.getElementById("item-list");

  if (!list || !form) return;

  if (openBtn) {
    openBtn.addEventListener("click", () => openItemModal());
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeItemModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeItemModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeItemModal);
  }

  form.addEventListener("submit", onItemSubmit);

  list.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("button[data-item-action]");
    if (!actionBtn) return;

    const id = actionBtn.dataset.id;
    if (!id) return;

    if (actionBtn.dataset.itemAction === "edit") {
      const item = sheetState.items.find((entry) => entry.id === id);
      if (item) openItemModal(item);
      return;
    }

    if (actionBtn.dataset.itemAction === "remove") {
      removeItem(id);
      return;
    }

    if (actionBtn.dataset.itemAction === "decrease") {
      changeItemAmount(id, -1);
      return;
    }

    if (actionBtn.dataset.itemAction === "increase") {
      changeItemAmount(id, 1);
    }
  });

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("item-modal");
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeItemModal();
    }
  });

  renderItemList();
}

function openItemModal(item = null) {
  const modal = document.getElementById("item-modal");
  const title = document.getElementById("item-modal-title");
  const saveBtn = document.getElementById("save-item-btn");
  const form = document.getElementById("item-form");

  if (!modal || !form) return;

  populateItemForm(item);

  if (title) {
    title.textContent = item ? "Edit Item" : "Add Item";
  }

  if (saveBtn) {
    saveBtn.textContent = item ? "Save" : "Add";
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeItemModal() {
  const modal = document.getElementById("item-modal");
  const form = document.getElementById("item-form");
  const title = document.getElementById("item-modal-title");
  const saveBtn = document.getElementById("save-item-btn");
  const idInput = document.getElementById("item-id");

  if (modal) {
    modal.classList.add("hidden");
  }

  if (form) {
    form.reset();
  }

  if (idInput) {
    idInput.value = "";
  }

  if (title) {
    title.textContent = "Add Item";
  }

  if (saveBtn) {
    saveBtn.textContent = "Add";
  }

  document.body.style.overflow = "";
}

function populateItemForm(item) {
  const idInput = document.getElementById("item-id");
  const nameInput = document.getElementById("item-name");
  const detailsInput = document.getElementById("item-details");
  const amountInput = document.getElementById("item-amount");

  if (!nameInput) return;

  if (!item) {
    if (idInput) idInput.value = "";
    nameInput.value = "";
    if (detailsInput) detailsInput.value = "";
    if (amountInput) amountInput.value = "1";
    return;
  }

  if (idInput) idInput.value = item.id;
  nameInput.value = item.name || "";
  if (detailsInput) detailsInput.value = item.details || "";
  if (amountInput) amountInput.value = item.amount ?? 1;
}

function onItemSubmit(event) {
  event.preventDefault();

  const idInput = document.getElementById("item-id");
  const nameInput = document.getElementById("item-name");
  const detailsInput = document.getElementById("item-details");
  const amountInput = document.getElementById("item-amount");

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter an item name.");
    return;
  }

  let amount = parseInt(amountInput?.value || "0", 10);
  if (Number.isNaN(amount) || amount < 0) amount = 0;

  const existingId = idInput?.value || "";
  const payload = {
    id: existingId || `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    details: detailsInput?.value.trim() || "",
    amount
  };

  const existingIndex = sheetState.items.findIndex((item) => item.id === payload.id);
  if (existingIndex >= 0) {
    sheetState.items[existingIndex] = payload;
  } else {
    sheetState.items.unshift(payload);
  }

  saveSheetStateToStorage();
  renderItemList();
  closeItemModal();
}

function changeItemAmount(id, delta) {
  const item = sheetState.items.find((entry) => entry.id === id);
  if (!item) return;

  const next = Math.max(0, Number(item.amount || 0) + delta);
  item.amount = next;
  saveSheetStateToStorage();
  renderItemList();
}

function removeItem(id) {
  sheetState.items = sheetState.items.filter((item) => item.id !== id);
  saveSheetStateToStorage();
  renderItemList();
}

function renderItemList() {
  const list = document.getElementById("item-list");
  if (!list) return;

  if (!Array.isArray(sheetState.items) || sheetState.items.length === 0) {
    list.innerHTML = '<p class="equipment-empty">No items yet.</p>';
    return;
  }

  list.innerHTML = sheetState.items
    .map((item) => `
      <div class="item-card">
        <div class="item-main">
          <div class="equipment-item-info">
            <span class="equipment-name">${escapeHtml(item.name || "")}</span>
            <div class="item-amount-row">
              <span class="item-amount-label">Amount</span>
              <div class="item-stepper">
                <button type="button" class="item-step-btn" data-item-action="decrease" data-id="${item.id}" aria-label="Decrease ${escapeHtml(item.name || "item")}">−</button>
                <span class="item-amount-value">${escapeHtml(item.amount ?? 0)}</span>
                <button type="button" class="item-step-btn" data-item-action="increase" data-id="${item.id}" aria-label="Increase ${escapeHtml(item.name || "item")}">+</button>
              </div>
            </div>
          </div>
        </div>
        <div class="item-side-actions">
          <button type="button" class="icon-action-btn item-side-btn" data-item-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name || "item")}">✎</button>
          <button type="button" class="icon-action-btn equipment-remove-btn item-side-btn" data-item-action="remove" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.name || "item")}">⌫</button>
        </div>
      </div>
    `)
    .join("");
}

// ---------- helpers from your Foundry logic ----------

// Keep value between min and max
function clamp(v, min, max) {
  v = Number(v ?? 0);
  if (Number.isNaN(v)) v = 0;
  return Math.max(min, Math.min(max, v));
}

// Build the 6 faces for a single die configuration.
// kind = "normal" | "adv" | "neg"
function buildDieFaces(config = {}) {
  const kind = config.kind ?? "normal";
  const faces = ["1", "", "", "", "", "R"]; // sides 1..6

  if (kind === "adv") {
    let plusCount = config.plusCount ?? 1;
    if (plusCount > 4) {
      alert("Advantage die: max plus faces is 4. Using 4.");
    }
    plusCount = clamp(plusCount, 1, 4);
    for (let i = 0; i < plusCount; i++) {
      faces[1 + i] = "+"; // positions 2–5
    }
  } else if (kind === "neg") {
    let minusCount = config.minusCount ?? 1;
    if (minusCount > 4) {
      alert("Negative die: max minus faces is 4. Using 4.");
    }
    minusCount = clamp(minusCount, 1, 4);
    for (let i = 0; i < minusCount; i++) {
      faces[1 + i] = "-"; // positions 2–5
    }
  }

  return faces;
}

// Convert numeric d6 result (1–6) to face label
function faceForRoll(config, value) {
  const faces = buildDieFaces(config);
  const index = clamp(value, 1, 6) - 1;
  return faces[index];
}

// Score faces using your rules:
// - "1" = 1 point
// - "R" = 1 point + 1 reroll
// - "+" / "-" only affect score if basePoints > 0
// - blank = 0
function scoreFaces(faces) {
  let basePoints = 0;
  let plusCount = 0;
  let minusCount = 0;
  let rerollCount = 0;

  for (const f of faces) {
    if (f === "1") {
      basePoints++;
    } else if (f === "R") {
      basePoints++;
      rerollCount++;
    } else if (f === "+") {
      plusCount++;
    } else if (f === "-") {
      minusCount++;
    }
  }

  let total = 0;
  if (basePoints > 0) {
    total = basePoints + plusCount - minusCount;
    if (total < 0) total = 0; // no negative totals
  }

  return { basePoints, plusCount, minusCount, rerollCount, total };
}

// Simple d6 roll
function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

// ---------- main pool roller with automatic rerolls ----------

function rollRolenrollPoolBrowser(dice) {
  if (!Array.isArray(dice) || dice.length === 0) {
    dice = Array.from({ length: 5 }, () => ({ kind: "normal" }));
  }

  const rounds = [];
  let current = dice.map((config) => ({ config }));
  let safety = 0;

  while (current.length > 0 && safety < 100) {
    safety++;

    const thisRound = [];
    const next = [];

    for (const { config } of current) {
      const value = rollD6();
      const face = faceForRoll(config, value);
      thisRound.push({ config, roll: value, face });

      if (face === "R") {
        // R → another die of the same config in the next round
        next.push({ config: { ...config } });
      }
    }

    rounds.push(thisRound);
    current = next;
  }

  const baseFaces = rounds[0] ? rounds[0].map((r) => r.face) : [];
  const rerollFaces = rounds.slice(1).flat().map((r) => r.face);
  const allFaces = baseFaces.concat(rerollFaces);

  const scoring = scoreFaces(allFaces);

  const basedScore = baseFaces.reduce(
    (s, f) => s + (f === "1" || f === "R" ? 1 : 0),
    0
  );
  const rerollPoints = rerollFaces.reduce(
    (s, f) => s + (f === "1" || f === "R" ? 1 : 0),
    0
  );
  const plusTokens = allFaces.filter((f) => f === "+").length;
  const minusTokens = allFaces.filter((f) => f === "-").length;
  const rerollCount = allFaces.filter((f) => f === "R").length;

  // ---- Build HTML: one row per round ----
  let html = `
<div class="role-roll-chat">
  <div class="role-roll-header"><strong>Role&amp;Roll Dice Pool</strong></div>
`;

  rounds.forEach((round, idx) => {
    if (!round.length) return;
    const facesHtml = round.map((r) => faceToDieHtml(r.face)).join("");

    let label = "";
    if (idx === 0) {
      label = "";
    } else {
      label = `<em>(reroll ${idx})</em>&nbsp;`;
    }

    html += `
  <div class="role-roll-dice-row">
    ${label}${facesHtml}
  </div>
`;
  });

  html += `</div>`;

  return {
    html,
    scoring,
    basedScore,
    rerollPoints,
    rerollCount,
    plusTokens,
    minusTokens,
  };
}

// Render a single die as HTML span
function faceToDieHtml(f) {
  let symbol = "&nbsp;";
  let extraClass = "";

  if (f === "1") {
    symbol = "●"; // 1 point = dot
    extraClass = "role-roll-face-point";
  } else if (f === "R") {
    symbol = "Ⓡ"; // reroll symbol
    extraClass = "role-roll-face-reroll";
  } else if (f === "+") {
    symbol = "+"; // advantage
    extraClass = "role-roll-face-plus";
  } else if (f === "-") {
    symbol = "−"; // negative
    extraClass = "role-roll-face-minus";
  } else {
    extraClass = "role-roll-face-blank"; // blank
  }

  return `<span class="role-roll-die ${extraClass}">${symbol}</span>`;
}

// ---------- parse "Special dice" like aX / nY ----------

function parseSpecialDice(str) {
  const configs = [];
  const trimmed = str.trim();
  if (!trimmed) return configs;

  const tokens = trimmed
    .split(/[, ]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    let m = token.match(/^a(\d+)$/i);
    if (m) {
      const plusCount = parseInt(m[1], 10);
      configs.push({ kind: "adv", plusCount }); // 1 ADV die with plusCount faces
      continue;
    }
    m = token.match(/^n(\d+)$/i);
    if (m) {
      const minusCount = parseInt(m[1], 10);
      configs.push({ kind: "neg", minusCount }); // 1 NEG die with minusCount faces
      continue;
    }

    alert(
      `Invalid special dice token: "${token}". Use aX or nY, e.g. "a1, n2".`
    );
    throw new Error("Invalid special dice format");
  }

  return configs;
}

// ---------- history rendering ----------

function renderHistory() {
  const container = document.getElementById("history-list");
  if (!container) return;

  if (!rollHistory.length) {
    container.innerHTML = '<p class="history-empty">No rolls yet.</p>';
    return;
  }

  const html = rollHistory
    .map((entry) => {
      const date = new Date(entry.time);
      const timeStr = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const dateStr = date.toLocaleDateString();

      const specialText = entry.special || "-";

      return `
      <div class="history-item">
        <div class="history-header-line">
          <span class="history-time">${dateStr} ${timeStr}</span>
          <span class="history-total">Total: ${entry.finalTotal}</span>
        </div>
        <div class="history-row">
          <span>Dice: ${entry.totalDice}</span>
          <span>Special: ${specialText}</span>
        </div>
        <div class="history-row">
          <span>Base: ${entry.baseScore}</span>
          <span>R&amp;R: ${entry.rerollCount} (+${entry.rerollPoints})</span>
        </div>
        <div class="history-row">
          <span>Tokens: +${entry.plusTokens} / -${entry.minusTokens}</span>
          <span>Succ/Pen: +${entry.success} / -${entry.penalty}</span>
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = html;
}

// ---------- core roll executor (used by form + stats) ----------

function performRoll({ total, specialStr, success = 0, penalty = 0 }) {
  const totalNum = parseInt(total ?? 0, 10);
  if (isNaN(totalNum) || totalNum <= 0) {
    alert("Please enter a valid total number of dice (at least 1).");
    return;
  }

  // 3D dice visual (if available)
  if (window.roll3dDice) {
    window.roll3dDice(totalNum);
  }

  let succ = parseInt(success ?? 0, 10);
  let pen = parseInt(penalty ?? 0, 10);
  if (isNaN(succ)) succ = 0;
  if (isNaN(pen)) pen = 0;
  if (succ < 0) succ = 0;
  if (pen < 0) pen = 0;

  let specialConfigs;
  try {
    specialConfigs = parseSpecialDice(specialStr || "");
  } catch (e) {
    // parseSpecialDice already alerts on error
    return;
  }

  if (specialConfigs.length > totalNum) {
    alert("Number of special dice (a/n) cannot be more than Total dice.");
    return;
  }

  const dice = [...specialConfigs];
  const normalCount = totalNum - specialConfigs.length;
  for (let i = 0; i < normalCount; i++) {
    dice.push({ kind: "normal" });
  }

  if (dice.length > 50) {
    alert("RolEnRoll: Too many dice requested (max 50).");
    return;
  }

  // Roll dice (all rerolls handled inside)
  const {
    html,
    scoring,
    basedScore,
    rerollPoints,
    rerollCount,
    plusTokens,
    minusTokens,
  } = rollRolenrollPoolBrowser(dice);

  const diceTotal = scoring.total;
  let finalTotal = diceTotal + succ - pen;
  if (finalTotal < 0) finalTotal = 0;

  // Show dice faces
  const resultDiv = document.getElementById("result");
  if (resultDiv) resultDiv.innerHTML = html;

  // Summary
  const elBase = document.getElementById("based-score");
  if (elBase) elBase.textContent = basedScore;

  const elRrCount = document.getElementById("rr-count");
  if (elRrCount) elRrCount.textContent = rerollCount;

  const elRrPoints = document.getElementById("rr-points");
  if (elRrPoints) elRrPoints.textContent = rerollPoints;

  const elPlus = document.getElementById("plus-tokens");
  if (elPlus) elPlus.textContent = plusTokens;

  const elMinus = document.getElementById("minus-tokens");
  if (elMinus) elMinus.textContent = minusTokens;

  const elSucc = document.getElementById("stat-success");
  if (elSucc) elSucc.textContent = succ;

  const elPen = document.getElementById("stat-penalty");
  if (elPen) elPen.textContent = pen;

  const elTotal = document.getElementById("total-points");
  if (elTotal) elTotal.textContent = finalTotal;

  if (openResultModalBtn) {
    openResultModalBtn.classList.remove("hidden");
  }

  openResultModal();

  // ---- Add to history ----
  const entry = {
    time: Date.now(),
    totalDice: totalNum,
    special: (specialStr || "").trim(),
    success: succ,
    penalty: pen,
    diceTotal,
    finalTotal,
    baseScore: basedScore,
    rerollPoints,
    rerollCount,
    plusTokens,
    minusTokens,
  };

  // latest roll at top
  rollHistory.unshift(entry);
  if (rollHistory.length > 50) rollHistory.length = 50;

  renderHistory();
}

// ---------- form handler ----------

function onSubmit(e) {
  e.preventDefault();

  const totalInput =
    document.getElementById("total-dice") ||
    document.getElementById("total"); // fallback

  const specialInput = document.getElementById("special");
  const successInput = document.getElementById("success");
  const penaltyInput = document.getElementById("penalty");

  const total = totalInput ? totalInput.value : "0";
  const specialStr = specialInput ? specialInput.value : "";
  const success = successInput ? successInput.value : "0";
  const penalty = penaltyInput ? penaltyInput.value : "0";

  performRoll({
    total,
    specialStr,
    success,
    penalty,
  });
}

// ---------- Character sheet: mental hearts ----------

function setupMentalHearts() {
  const hearts = document.querySelectorAll(".mental-heart");
  if (!hearts.length) return;

  hearts.forEach((btn, idx) => {
    btn.dataset.index = String(idx + 1);

    // if no saved state was applied, default to "on"
    if (!btn.classList.contains("on") && !btn.classList.contains("off")) {
      btn.classList.add("on");
    }

    btn.addEventListener("click", () => {
      if (btn.classList.contains("on")) {
        btn.classList.remove("on");
        btn.classList.add("off");
      } else {
        btn.classList.remove("off");
        btn.classList.add("on");
      }
      saveSheetStateToStorage();
    });
  });
}

// ---------- Character sheet: stats (attributes + skills) ----------

function setupStats() {
  const statRows = document.querySelectorAll(".stat-row");
  if (!statRows.length) return;

  statRows.forEach((row) => {
    const role = row.dataset.role || "attr";

    if (role === "skill") {
      setupSkillRow(row);
    } else {
      setupAttrRow(row);
    }
  });
}

// --- helpers for attributes and skills ---

function setupAttrRow(row) {
  const key = row.dataset.stat;
  if (!key) return;

  // use loaded value if present, else 0
  sheetState.attrs[key] = sheetState.attrs[key] ?? 0;
  initDotsForRow(row, sheetState.attrs, key);

  const rollBtn = row.querySelector(".stat-roll-btn");
  if (!rollBtn) return;

  rollBtn.addEventListener("click", () => {
    const value = sheetState.attrs[key] || 0;
    if (value <= 0) {
      alert(
        "This attribute has 0 points. Click the dots to set points before rolling."
      );
      return;
    }

    const bonusCheckbox = row.querySelector(".stat-succeed");
    const statBonus =
      bonusCheckbox && bonusCheckbox.checked ? 1 : 0;

    const globalSuccInput = document.getElementById("success");
    const globalPenInput = document.getElementById("penalty");
    let globalSucc = parseInt(globalSuccInput?.value || "0", 10);
    let globalPen = parseInt(globalPenInput?.value || "0", 10);
    if (isNaN(globalSucc)) globalSucc = 0;
    if (isNaN(globalPen)) globalPen = 0;

    const specialInput = document.getElementById("special");
    const specialStr = specialInput ? specialInput.value || "" : "";

    performRoll({
      total: value,
      specialStr,
      success: globalSucc + statBonus,
      penalty: globalPen,
    });
  });
}

function setupSkillRow(row) {
  const skillKey = row.dataset.skill || row.dataset.stat;
  if (!skillKey) return;

  sheetState.skills[skillKey] = sheetState.skills[skillKey] ?? 0;
  initDotsForRow(row, sheetState.skills, skillKey);

  const rollBtn = row.querySelector(".stat-roll-btn");
  if (!rollBtn) return;

  rollBtn.addEventListener("click", () => {
    const skillVal = sheetState.skills[skillKey] || 0;

    const primaryAttrKey = row.dataset.attr; // e.g. "int", "apt"
    const altAttrKey = row.dataset.altAttr || row.dataset.altattr; // e.g. "dex" for Art or Brawl

    let attrDice = 0;
    if (primaryAttrKey) {
      const primary = sheetState.attrs[primaryAttrKey] || 0;
      if (altAttrKey) {
        const alt = sheetState.attrs[altAttrKey] || 0;
        attrDice = Math.max(primary, alt); // multi-attr: max(primary, alt)
      } else {
        attrDice = primary;
      }
    }

    const totalDice = skillVal + attrDice;
    if (totalDice <= 0) {
      alert(
        "This skill currently has 0 dice. Increase the skill or its linked Attribute first."
      );
      return;
    }

    const bonusCheckbox = row.querySelector(".stat-succeed");
    const statBonus =
      bonusCheckbox && bonusCheckbox.checked ? 1 : 0;

    const globalSuccInput = document.getElementById("success");
    const globalPenInput = document.getElementById("penalty");
    let globalSucc = parseInt(globalSuccInput?.value || "0", 10);
    let globalPen = parseInt(globalPenInput?.value || "0", 10);
    if (isNaN(globalSucc)) globalSucc = 0;
    if (isNaN(globalPen)) globalPen = 0;

    const specialInput = document.getElementById("special");
    const specialStr = specialInput ? specialInput.value || "" : "";

    performRoll({
      total: totalDice,
      specialStr,
      success: globalSucc + statBonus,
      penalty: globalPen,
    });
  });
}

// initialize dots & clicking for a single row
function initDotsForRow(row, store, key) {
  const dots = row.querySelectorAll(".stat-dot");
  store[key] = store[key] ?? 0;

  dots.forEach((dot, i) => {
    const idxAttr = dot.dataset.index || dot.dataset.value;
    const idx = idxAttr ? parseInt(idxAttr, 10) : i + 1;
    dot.dataset.index = String(idx);
    dot.addEventListener("click", () => {
      const current = store[key] || 0;
      let nextVal;
      if (current === idx) {
        nextVal = idx - 1; // clicking highest again lowers by 1
      } else {
        nextVal = idx;
      }
      if (nextVal < 0) nextVal = 0;
      if (nextVal > 6) nextVal = 6;
      store[key] = nextVal;
      updateStatDots(row, nextVal);
      saveSheetStateToStorage();
    });
  });

  updateStatDots(row, store[key]);
}

function updateStatDots(row, value) {
  const dots = row.querySelectorAll(".stat-dot");
  dots.forEach((dot) => {
    const idxAttr = dot.dataset.index || dot.dataset.value;
    const idx = idxAttr ? parseInt(idxAttr, 10) : 0;
    if (idx && idx <= value) dot.classList.add("active");
    else dot.classList.remove("active");
  });
}

// ---------- localStorage: save / load sheet state ----------

function saveSheetStateToStorage() {
  try {
    const hearts = Array.from(document.querySelectorAll(".mental-heart")).map(
      (btn) => !btn.classList.contains("off") // true if ON, false if OFF
    );

    const globals = {};

    // 👉 Make sure IDs match your HTML
    const globalMap = [
      { id: "char-name",       key: "name" },
      { id: "char-health",     key: "health" },
      { id: "char-health-max", key: "healthMax" },
      { id: "char-defense",    key: "defense" },
      { id: "char-willpower",  key: "will" }
    ];

    globalMap.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        globals[key] = el.value ?? "";
      }
    });

    sheetState.globals = globals;

    const payload = {
      attrs: sheetState.attrs || {},
      skills: sheetState.skills || {},
      hearts,
      globals,
      equipment: sheetState.equipment || [],
      statuses: sheetState.statuses || [],
      items: sheetState.items || []
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save sheet state:", e);
  }
}

function loadSheetStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);

    // Mutate existing objects, do NOT reassign
    if (data.attrs && typeof data.attrs === "object") {
      Object.assign(sheetState.attrs, data.attrs);
    }
    if (data.skills && typeof data.skills === "object") {
      Object.assign(sheetState.skills, data.skills);
    }
    sheetState.globals = data.globals || {};
    sheetState.equipment = Array.isArray(data.equipment) ? data.equipment : [];
    sheetState.statuses = Array.isArray(data.statuses) ? data.statuses : [];
    sheetState.items = Array.isArray(data.items) ? data.items : [];

    // restore header fields
    const globalMap = [
      { id: "char-name",       key: "name" },
      { id: "char-health",     key: "health" },
      { id: "char-health-max", key: "healthMax" },
      { id: "char-defense",    key: "defense" },
      { id: "char-willpower",  key: "will" }
    ];

    globalMap.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el && data.globals && data.globals[key] != null) {
        el.value = data.globals[key];
      }
    });

    // restore hearts (classes only; click handlers added later)
    if (Array.isArray(data.hearts)) {
      const hearts = document.querySelectorAll(".mental-heart");
      hearts.forEach((btn, idx) => {
        const on = data.hearts[idx];
        btn.classList.remove("on", "off");
        if (on === false) btn.classList.add("off");
        else btn.classList.add("on");
      });
    }
    // attribute/skill dots are re-applied in setupStats()
  } catch (e) {
    console.warn("Could not load sheet state:", e);
  }
}

// watch header fields and save when user edits them
function setupGlobalFieldPersistence() {
  const globalMap = [
    { id: "char-name",       key: "name" },
    { id: "char-health",     key: "health" },
    { id: "char-health-max", key: "healthMax" },
    { id: "char-defense",    key: "defense" },
    { id: "char-willpower",  key: "will" }
  ];

  globalMap.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", () => {
      sheetState.globals[key] = el.value ?? "";
      saveSheetStateToStorage();
    });
  });
}
