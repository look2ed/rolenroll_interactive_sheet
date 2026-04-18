// ===============================
// RolEnRoll Dice System Logic – Browser version
// ===============================

let rollHistory = [];
let resultModal;
let openResultModalBtn;
let closeResultModalBtn;
let resultModalBackdrop;
let statOptions = [];
let equipmentDependencySelection = [];
let extraSkillDependencySelection = [];
let extraSkillPointsSelection = 0;
let deleteCharacterModal;
let newCharacterModal;
let specialDiceBuilderState = [];
let specialDieDraftFaces = ["1", "", "", "", "", "R"];
let specialDieEditIndex = -1;
let pendingSheetRoll = null;
let sheetRollSpecialDiceState = [];
let sheetRollIgnoreMentalPenalty = false;

const LEGACY_STORAGE_KEY = "rolenroll_sheet_state_v1";
const SHEET_STORAGE_PREFIX = "rolenroll_sheet_state_v2_";
const SHEET_INDEX_KEY = "rolenroll_sheet_index_v1";
const ACTIVE_SHEET_KEY = "rolenroll_active_sheet_v1";
const DEFAULT_HEART_COUNT = 12;
const MAX_HEART_COUNT = 18;
const MENTAL_MAX_KEY = "mentalMax";
const BASE_HEALTH = 10;
const BASE_WILL_POWER = 8;
const ATTRIBUTE_STARTING_POINTS = 9;
const ATTRIBUTE_DEFAULT_MAX_POINTS = 9;
const ATTRIBUTE_MAX_POINTS_KEY = "attributeMaxPoints";
const GENERAL_ABILITY_STARTING_POINTS = 18;
const GENERAL_ABILITY_MAX_POINTS_KEY = "generalAbilityMaxPoints";
const EXTRA_SKILL_STARTING_POINTS = 6;
const EXTRA_SKILL_MAX_POINTS_KEY = "extraSkillMaxPoints";
const DEFAULT_DEVELOPER_MESSAGE = "Welcome to Role & Roll Unofficial Interactive Character Sheet.\n\nEdit developer-message.txt to announce major changes, updates, or reminders to players.";
const CONTACT_ENDPOINT = "https://formspree.io/f/xdayayrq";
let currentSheetId = "";
let sheetDirectory = [];



// central sheet state
const sheetState = {
  attrs: {},   // e.g. { str: 3, dex: 2, int: 4, ... }
  skills: {},  // e.g. { search: 2, art: 1, ... }
  successChecks: {},
  hearts: [],
  globals: {}, // e.g. { name, health, healthMax, defense, will }
  equipment: [],
  statuses: [],
  items: [],
  note: "",
  extraSkills: []
};

document.addEventListener("DOMContentLoaded", () => {
  initSheetManager();
  setupV5Layout();
  setupCharacterInfoTabs();
  setupFloatingTooltips();
  setupSheetRollModal();
  setupSpecialDiceBuilder();
  setupHeaderMessageControls();

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
  statOptions = collectStatOptions();

  // 7) Header field persistence
  setupGlobalFieldPersistence();

  // 🔥 Ensure HP is saved when user edits it
  const healthInput = document.getElementById("char-health");
  const healthMaxInput = document.getElementById("char-health-max");

  if (healthInput) {
    const saveCurrentHP = () => {
      sheetState.globals.health = healthInput.value;
      saveSheetStateToStorage();
    };
    healthInput.addEventListener("input", saveCurrentHP);
    healthInput.addEventListener("change", saveCurrentHP);
    healthInput.addEventListener("blur", saveCurrentHP);
  }

  if (healthMaxInput) {
    const saveMaxHP = () => {
      sheetState.globals.healthMax = healthMaxInput.value;
      saveSheetStateToStorage();
    };
    healthMaxInput.addEventListener("input", saveMaxHP);
    healthMaxInput.addEventListener("change", saveMaxHP);
    healthMaxInput.addEventListener("blur", saveMaxHP);
  }

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

  // 13) Note block and modal
  setupNotes();

  // 13.5) Editable max HP field
  // setupHealthMaxField();

  // 14) Extra skill block and modal
  setupExtraSkills();

  // 15) Delete character controls
  setupDeleteCharacterControls();
  setupNewCharacterControls();
  updateDeleteCharacterButton();
});

function setupV5Layout() {
  const sheetPanel = document.querySelector(".sheet-panel.sheet-column");
  const characterInfoCard = document.querySelector(".character-info-card");
  const itemsPanel = document.querySelector(".items-panel");
  const notesPanel = document.querySelector(".notes-panel");
  const extraSkillPanel = document.querySelector(".extra-skill-panel");
  const attributesCard = document.querySelector(".attributes-card");

  if (sheetPanel && characterInfoCard && itemsPanel && attributesCard) {
    let lowerLayout = document.querySelector(".lower-sheet-layout");
    if (!lowerLayout) {
      lowerLayout = document.createElement("div");
      lowerLayout.className = "lower-sheet-layout";
    }
    characterInfoCard.after(lowerLayout);
    let inventoryStack = document.querySelector(".inventory-stack");
    if (!inventoryStack) {
      inventoryStack = document.createElement("div");
      inventoryStack.className = "inventory-stack";
    }
    inventoryStack.append(itemsPanel);
    if (notesPanel) inventoryStack.append(notesPanel);
    lowerLayout.append(inventoryStack, attributesCard);
    setupProgressionTabs(attributesCard, extraSkillPanel);
  }

  const rollResultModal = document.getElementById("result-modal");
  if (rollResultModal && rollResultModal.parentElement !== document.body) {
    document.body.append(rollResultModal);
  }

  const toggleBtn = document.getElementById("manual-roll-toggle");
  const closeBtn = document.getElementById("manual-roll-close");
  const drawer = document.getElementById("dice-panel");
  const backdrop = document.getElementById("dice-drawer-backdrop");

  if (!toggleBtn || !drawer) return;

  function setDiceDrawerOpen(isOpen) {
    document.body.classList.toggle("dice-drawer-open", isOpen);
    toggleBtn.setAttribute("aria-expanded", isOpen.toString());
    drawer.setAttribute("aria-hidden", (!isOpen).toString());
    if (backdrop) backdrop.classList.toggle("hidden", !isOpen);
  }

  toggleBtn.addEventListener("click", () => {
    setDiceDrawerOpen(!document.body.classList.contains("dice-drawer-open"));
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => setDiceDrawerOpen(false));
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => setDiceDrawerOpen(false));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("dice-drawer-open")) {
      setDiceDrawerOpen(false);
    }
  });
}

function setupHeaderMessageControls() {
  const announcementBtn = document.getElementById("announcement-btn");
  const developerModal = document.getElementById("developer-message-modal");
  const developerBackdrop = document.getElementById("developer-message-modal-backdrop");
  const closeDeveloperBtn = document.getElementById("close-developer-message-modal");
  const developerContent = document.getElementById("developer-message-content");
  const tipBtn = document.getElementById("tip-me-btn");
  const tipModal = document.getElementById("tip-me-modal");
  const tipBackdrop = document.getElementById("tip-me-modal-backdrop");
  const closeTipBtn = document.getElementById("close-tip-me-modal");
  const contactBtn = document.getElementById("contact-btn");
  const contactModal = document.getElementById("contact-modal");
  const contactBackdrop = document.getElementById("contact-modal-backdrop");
  const closeContactBtn = document.getElementById("close-contact-modal");
  const cancelContactBtn = document.getElementById("cancel-contact-btn");
  const contactForm = document.getElementById("contact-form");

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  async function openDeveloperMessage() {
    if (developerContent) {
      developerContent.textContent = "Loading message...";
      try {
        const messageUrl = new URL("developer-message.txt?v=5.4.0", window.location.href);
        const response = await fetch(messageUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const message = (await response.text()).trim();
        developerContent.textContent = message || DEFAULT_DEVELOPER_MESSAGE;
      } catch (error) {
        console.warn("Could not load developer message:", error);
        developerContent.textContent = DEFAULT_DEVELOPER_MESSAGE;
      }
    }
    openModal(developerModal);
  }

  if (announcementBtn) announcementBtn.addEventListener("click", openDeveloperMessage);
  if (closeDeveloperBtn) closeDeveloperBtn.addEventListener("click", () => closeModal(developerModal));
  if (developerBackdrop) developerBackdrop.addEventListener("click", () => closeModal(developerModal));
  if (tipBtn) tipBtn.addEventListener("click", () => openModal(tipModal));
  if (closeTipBtn) closeTipBtn.addEventListener("click", () => closeModal(tipModal));
  if (tipBackdrop) tipBackdrop.addEventListener("click", () => closeModal(tipModal));
  if (contactBtn) contactBtn.addEventListener("click", () => openModal(contactModal));
  if (closeContactBtn) closeContactBtn.addEventListener("click", () => closeModal(contactModal));
  if (cancelContactBtn) cancelContactBtn.addEventListener("click", () => closeModal(contactModal));
  if (contactBackdrop) contactBackdrop.addEventListener("click", () => closeModal(contactModal));
  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitContactForm(contactForm, contactModal);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (developerModal && !developerModal.classList.contains("hidden")) {
      closeModal(developerModal);
    }
    if (tipModal && !tipModal.classList.contains("hidden")) {
      closeModal(tipModal);
    }
    if (contactModal && !contactModal.classList.contains("hidden")) {
      closeModal(contactModal);
    }
  });
}

async function submitContactForm(form, modal) {
  const name = document.getElementById("contact-name")?.value.trim() || "";
  const email = document.getElementById("contact-email")?.value.trim() || "";
  const details = document.getElementById("contact-details")?.value.trim() || "";
  const messageEl = document.getElementById("contact-form-message");
  const submitBtn = document.getElementById("submit-contact-btn");

  function setMessage(text, type = "") {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.classList.toggle("is-success", type === "success");
    messageEl.classList.toggle("is-error", type === "error");
  }

  if (!name || !email || !details) {
    setMessage("Please fill in Name, Email, and Details.", "error");
    return;
  }

  setMessage("Sending...");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        message: details,
        source: "Role & Roll Interactive Character Sheet"
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    form.reset();
    setMessage("Message sent. Thank you!", "success");
    setTimeout(() => {
      if (modal) modal.classList.add("hidden");
      document.body.style.overflow = "";
      setMessage("");
    }, 900);
  } catch (error) {
    console.warn("Could not submit contact form:", error);
    setMessage("Could not send message right now. Please try again later.", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function setupProgressionTabs(card, extraSkillPanel) {
  if (!card || card.dataset.progressionTabsReady === "true") return;

  const attrTitle = Array.from(card.querySelectorAll(".sheet-section-title"))
    .find((heading) => heading.textContent.trim() === "Attributes");
  const attrSubtitle = attrTitle?.nextElementSibling?.classList.contains("sheet-subtitle")
    ? attrTitle.nextElementSibling
    : null;
  const statSection = card.querySelector(".stat-section");
  const gaTitle = Array.from(card.querySelectorAll(".sheet-section-title"))
    .find((heading) => heading.textContent.trim() === "General Ability");
  const gaColumns = card.querySelector(".ga-columns");

  if (!attrTitle || !statSection || !gaTitle || !gaColumns) return;

  card.dataset.progressionTabsReady = "true";
  card.classList.add("progression-card");

  const tabs = document.createElement("div");
  tabs.className = "progression-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Character stats sections");
  tabs.innerHTML = `
    <button type="button" class="progression-tab is-active" role="tab" aria-selected="true" data-progression-tab="attributes">Attribute</button>
    <button type="button" class="progression-tab" role="tab" aria-selected="false" data-progression-tab="general-ability">General Ability</button>
    <button type="button" class="progression-tab" role="tab" aria-selected="false" data-progression-tab="extra-skill">Extra Skill</button>
  `;

  const attrPanel = document.createElement("div");
  attrPanel.className = "progression-panel is-active";
  attrPanel.dataset.progressionPanel = "attributes";
  attrTitle.remove();
  const attrHeader = document.createElement("div");
  attrHeader.className = "attribute-tab-header";
  if (attrSubtitle) attrHeader.append(attrSubtitle);
  attrHeader.insertAdjacentHTML("beforeend", `
    <div class="attribute-points-box" id="attribute-points-box">
      <span>Remaining</span>
      <strong id="attribute-remaining-points">0</strong>
      <span class="attribute-points-divider">/</span>
      <span>Max</span>
      <strong id="attribute-max-points">${ATTRIBUTE_DEFAULT_MAX_POINTS}</strong>
      <button
        type="button"
        class="inline-help-icon attribute-points-edit"
        data-tooltip="Click to edit maximum Attribute points."
        aria-label="Edit Attribute points"
      >
        ✎
      </button>
    </div>
  `);
  setupAttributePointsBox(attrHeader.querySelector("#attribute-points-box"));
  attrPanel.append(attrHeader);
  attrPanel.append(statSection);
  ensureToughnessAttribute(statSection);
  groupAttributeRows(statSection);

  const gaPanel = document.createElement("div");
  gaPanel.className = "progression-panel hidden";
  gaPanel.dataset.progressionPanel = "general-ability";
  gaTitle.remove();
  const gaHeader = document.createElement("div");
  gaHeader.className = "attribute-tab-header";
  gaHeader.innerHTML = `
    <p class="sheet-subtitle">Click dots to set 1-6 points. Tick checkbox to have +1 Succeed.</p>
    <div class="attribute-points-box" id="general-ability-points-box">
      <span>Remaining</span>
      <strong id="general-ability-remaining-points">${GENERAL_ABILITY_STARTING_POINTS}</strong>
      <span class="attribute-points-divider">/</span>
      <span>Max</span>
      <strong id="general-ability-max-points">${GENERAL_ABILITY_STARTING_POINTS}</strong>
      <button
        type="button"
        class="inline-help-icon attribute-points-edit"
        data-tooltip="Click to edit maximum General Ability points."
        aria-label="Edit General Ability points"
      >
        ✎
      </button>
    </div>
  `;
  setupGeneralAbilityPointsBox(gaHeader.querySelector("#general-ability-points-box"));
  gaPanel.append(gaHeader, gaColumns);

  const extraPanel = document.createElement("div");
  extraPanel.className = "progression-panel hidden";
  extraPanel.dataset.progressionPanel = "extra-skill";
  if (extraSkillPanel) {
    extraSkillPanel.classList.add("progression-extra-skill-panel");
    extraPanel.append(extraSkillPanel);
  }

  card.prepend(tabs);
  card.append(attrPanel, gaPanel, extraPanel);

  const tabButtons = tabs.querySelectorAll(".progression-tab");
  const panels = card.querySelectorAll(".progression-panel");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.progressionTab;
      tabButtons.forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active.toString());
      });
      panels.forEach((panel) => {
        const active = panel.dataset.progressionPanel === target;
        panel.classList.toggle("is-active", active);
        panel.classList.toggle("hidden", !active);
      });
    });
  });
}

function ensureToughnessAttribute(statSection) {
  if (!statSection || statSection.querySelector('[data-role="attr"][data-stat="tou"]')) return;

  const dexRow = statSection.querySelector('[data-role="attr"][data-stat="dex"]');
  if (!dexRow) return;

  const touRow = document.createElement("div");
  touRow.className = "stat-row";
  touRow.dataset.role = "attr";
  touRow.dataset.stat = "tou";
  touRow.innerHTML = `
    <span class="stat-label">Toughness (TOU)</span>
    <div class="stat-dots">
      <button type="button" class="stat-dot" data-index="1"></button>
      <button type="button" class="stat-dot" data-index="2"></button>
      <button type="button" class="stat-dot" data-index="3"></button>
      <button type="button" class="stat-dot" data-index="4"></button>
      <button type="button" class="stat-dot" data-index="5"></button>
      <button type="button" class="stat-dot" data-index="6"></button>
    </div>
    <label class="stat-bonus">
      <input type="checkbox" class="stat-succeed">
      +1 Succeed
    </label>
    <button type="button" class="stat-roll-btn">Roll</button>
  `;
  dexRow.after(touRow);
}

function groupAttributeRows(statSection) {
  if (!statSection || statSection.dataset.groupedAttributes === "true") return;

  const groups = [
    { title: "Physical", keys: ["str", "dex", "tou"] },
    { title: "Intelligent and Emotion", keys: ["int", "apt", "san"] },
    { title: "Personality", keys: ["cha", "rhe", "ego"] }
  ];

  const rows = new Map(
    Array.from(statSection.querySelectorAll('.stat-row[data-role="attr"]'))
      .map((row) => [row.dataset.stat, row])
  );

  statSection.classList.add("attribute-group-grid");
  statSection.dataset.groupedAttributes = "true";
  statSection.innerHTML = "";

  groups.forEach((group) => {
    const column = document.createElement("section");
    column.className = "attribute-group";
    column.innerHTML = `<h4 class="attribute-group-title">${group.title}</h4>`;
    group.keys.forEach((key) => {
      const row = rows.get(key);
      if (row) column.append(row);
    });
    statSection.append(column);
  });
}

function getSpentAttributePoints() {
  return Array.from(document.querySelectorAll('.stat-row[data-role="attr"]'))
    .reduce((total, row) => {
      const key = row.dataset.stat;
      const value = sheetState.attrs[key] ?? 1;
      return total + Math.max(0, value - 1);
    }, 0);
}

function getAttributeMaxPoints() {
  const raw = sheetState.globals?.[ATTRIBUTE_MAX_POINTS_KEY];
  const parsed = parseInt(raw ?? ATTRIBUTE_DEFAULT_MAX_POINTS, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : ATTRIBUTE_DEFAULT_MAX_POINTS;
}

function getRemainingAttributePoints() {
  return Math.max(0, getAttributeMaxPoints() - getSpentAttributePoints());
}

function updateAttributeRemainingDisplay() {
  const remainingOutput = document.getElementById("attribute-remaining-points");
  const maxOutput = document.getElementById("attribute-max-points");
  if (remainingOutput) remainingOutput.textContent = String(getRemainingAttributePoints());
  if (maxOutput) maxOutput.textContent = String(getAttributeMaxPoints());
}

function setupAttributePointsBox(box) {
  if (!box) return;
  const editBtn = box.querySelector(".attribute-points-edit");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    const spent = getSpentAttributePoints();
    const currentMax = getAttributeMaxPoints();
    const next = prompt("Set maximum Attribute points:", String(currentMax));
    if (next == null) return;

    const parsed = parseInt(next, 10);
    if (!Number.isFinite(parsed) || parsed < spent) {
      alert(`Maximum Attribute points cannot be lower than points already spent (${spent}).`);
      return;
    }

    sheetState.globals[ATTRIBUTE_MAX_POINTS_KEY] = String(parsed);
    updateAttributeRemainingDisplay();
    saveSheetStateToStorage();
  });
}

function getSpentGeneralAbilityPoints() {
  return Array.from(document.querySelectorAll('.ga-columns .stat-row[data-role="skill"]'))
    .reduce((total, row) => {
      const key = row.dataset.skill || row.dataset.stat;
      const value = sheetState.skills[key] ?? 0;
      return total + Math.max(0, value);
    }, 0);
}

function getGeneralAbilityMaxPoints() {
  const raw = sheetState.globals?.[GENERAL_ABILITY_MAX_POINTS_KEY];
  const parsed = parseInt(raw ?? GENERAL_ABILITY_STARTING_POINTS, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : GENERAL_ABILITY_STARTING_POINTS;
}

function getRemainingGeneralAbilityPoints() {
  return Math.max(0, getGeneralAbilityMaxPoints() - getSpentGeneralAbilityPoints());
}

function updateGeneralAbilityRemainingDisplay() {
  const remainingOutput = document.getElementById("general-ability-remaining-points");
  const maxOutput = document.getElementById("general-ability-max-points");
  if (remainingOutput) remainingOutput.textContent = String(getRemainingGeneralAbilityPoints());
  if (maxOutput) maxOutput.textContent = String(getGeneralAbilityMaxPoints());
}

function setupGeneralAbilityPointsBox(box) {
  if (!box) return;
  const editBtn = box.querySelector(".attribute-points-edit");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    const spent = getSpentGeneralAbilityPoints();
    const currentMax = getGeneralAbilityMaxPoints();
    const next = prompt("Set maximum General Ability points:", String(currentMax));
    if (next == null) return;

    const parsed = parseInt(next, 10);
    if (!Number.isFinite(parsed) || parsed < spent) {
      alert(`Maximum General Ability points cannot be lower than points already spent (${spent}).`);
      return;
    }

    sheetState.globals[GENERAL_ABILITY_MAX_POINTS_KEY] = String(parsed);
    updateGeneralAbilityRemainingDisplay();
    saveSheetStateToStorage();
  });
}

function setupSheetRollModal() {
  const modal = ensureSheetRollModal();
  const form = modal.querySelector("#sheet-roll-form");
  const closeBtn = modal.querySelector("#close-sheet-roll-modal");
  const cancelBtn = modal.querySelector("#cancel-sheet-roll-btn");
  const backdrop = modal.querySelector("#sheet-roll-modal-backdrop");
  const addSpecialBtn = modal.querySelector("#add-sheet-roll-special-die-btn");
  const specialList = modal.querySelector("#sheet-roll-special-list");

  if (modal.dataset.ready === "true") return;
  modal.dataset.ready = "true";

  function close() {
    modal.classList.add("hidden");
    pendingSheetRoll = null;
    sheetRollIgnoreMentalPenalty = false;
    document.body.style.overflow = "";
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pendingSheetRoll) return;

    const total = modal.querySelector("#sheet-roll-total")?.value || pendingSheetRoll.total;
    const success = modal.querySelector("#sheet-roll-success")?.value || pendingSheetRoll.success;
    const penalty = modal.querySelector("#sheet-roll-penalty")?.value || pendingSheetRoll.penalty;
    let specialStr = modal.querySelector("#sheet-roll-special")?.value ?? pendingSheetRoll.specialStr ?? "";

    if (!sheetRollIgnoreMentalPenalty) {
      const penaltyFaces = getMentalPenaltyFaces();

      if (penaltyFaces > 0) {
        let parsed = [];

        try {
          parsed = specialStr ? JSON.parse(specialStr) : [];
        } catch {
          parsed = [];
        }

        for (let i = 0; i < penaltyFaces; i++) {
        parsed.push({
          kind: "custom",
          faces: ["1", "-", "-", "-", "-", "R"]
        });
      }

        specialStr = JSON.stringify(parsed);
      }
    }
    performRoll({
      total,
      specialStr,
      success,
      penalty,
      equipmentDmg: pendingSheetRoll.equipmentDmg ?? null,
      ignoreMentalPenalty: sheetRollIgnoreMentalPenalty
    });
    close();
  });

  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  addSpecialBtn?.addEventListener("click", () => {
    sheetRollSpecialDiceState.push(["1", "", "", "", "", "R"]);
    renderSheetRollSpecialDice(modal);
  });
  specialList?.addEventListener("click", (event) => {
    const mentalRemoveBtn = event.target.closest("[data-sheet-mental-remove]");
    if (mentalRemoveBtn) {
      if (!confirmRemove("Remove the automatic Mental penalty from this roll?")) return;
      sheetRollIgnoreMentalPenalty = true;
      renderSheetRollSpecialDice(modal);
      return;
    }

    const removeBtn = event.target.closest("[data-sheet-special-remove]");
    if (removeBtn) {
      const index = parseInt(removeBtn.dataset.sheetSpecialRemove || "-1", 10);
      if (index >= 0 && index < sheetRollSpecialDiceState.length) {
        if (!confirmRemove("Remove this special die?")) return;
        sheetRollSpecialDiceState.splice(index, 1);
        renderSheetRollSpecialDice(modal);
      }
      return;
    }

    const faceBtn = event.target.closest("[data-sheet-special-die]");
    if (!faceBtn || faceBtn.disabled) return;

    const dieIndex = parseInt(faceBtn.dataset.sheetSpecialDie || "-1", 10);
    const faceIndex = parseInt(faceBtn.dataset.faceIndex || "-1", 10);
    if (dieIndex < 0 || dieIndex >= sheetRollSpecialDiceState.length) return;
    if (faceIndex < 1 || faceIndex > 4) return;

    const current = sheetRollSpecialDiceState[dieIndex][faceIndex] || "";
    sheetRollSpecialDiceState[dieIndex][faceIndex] = current === "" ? "+" : current === "+" ? "-" : "";
    renderSheetRollSpecialDice(modal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
  });
}

function ensureSheetRollModal() {
  let modal = document.getElementById("sheet-roll-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "sheet-roll-modal";
  modal.className = "result-modal hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "sheet-roll-modal-title");
  modal.innerHTML = `
    <div class="result-modal-backdrop" id="sheet-roll-modal-backdrop"></div>
    <div class="result-modal-panel equipment-modal-panel sheet-roll-modal-panel">
      <div class="result-modal-header">
        <h2 id="sheet-roll-modal-title">Prepare Roll</h2>
        <button type="button" id="close-sheet-roll-modal" class="result-modal-close" aria-label="Close roll form">×</button>
      </div>
      <div class="result-modal-body">
        <form id="sheet-roll-form" class="equipment-form">
          <div class="sheet-roll-context">
            <strong id="sheet-roll-name">Roll</strong>
            <span id="sheet-roll-detail"></span>
          </div>
          <div class="sheet-roll-number-row">
            <label class="equipment-field" for="sheet-roll-total">
              <span>Total dice :</span>
              <input type="number" id="sheet-roll-total" min="1" value="1">
            </label>
            <label class="equipment-field" for="sheet-roll-success">
              <span>Succeed :</span>
              <input type="number" id="sheet-roll-success" min="0" value="0">
            </label>
            <label class="equipment-field" for="sheet-roll-penalty">
              <span>Penalty :</span>
              <input type="number" id="sheet-roll-penalty" min="0" value="0">
            </label>
          </div>
          <div class="sheet-roll-special-builder">
            <div class="special-dice-builder-header">
              <span>Special dice :</span>
              <span id="sheet-roll-special-preview" class="special-preview">None</span>
            </div>
            <input type="hidden" id="sheet-roll-special">
            <div id="sheet-roll-special-list" class="special-dice-list sheet-roll-special-list">
              <p class="special-dice-empty">No special dice.</p>
            </div>
            <button type="button" id="add-sheet-roll-special-die-btn" class="add-special-die-btn">
              + Add Special Die
            </button>
          </div>
          <p class="sheet-roll-note">Adjust Succeed here if you spend Will Power before rolling.</p>
          <div class="equipment-form-actions">
            <button type="submit" id="confirm-sheet-roll-btn">Roll</button>
            <button type="button" id="cancel-sheet-roll-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.append(modal);
  return modal;
}

function openSheetRollModal(payload) {
  const modal = ensureSheetRollModal();
  sheetRollIgnoreMentalPenalty = false;
  pendingSheetRoll = {
    label: payload.label || "Roll",
    detail: payload.detail || "",
    total: payload.total || 1,
    success: payload.success || 0,
    penalty: payload.penalty || 0,
    specialStr: payload.specialStr || "",
    equipmentDmg: payload.equipmentDmg ?? null
  };

  modal.querySelector("#sheet-roll-name").textContent = pendingSheetRoll.label;
  modal.querySelector("#sheet-roll-detail").textContent = pendingSheetRoll.detail;
  modal.querySelector("#sheet-roll-total").value = pendingSheetRoll.total;
  modal.querySelector("#sheet-roll-success").value = pendingSheetRoll.success;
  modal.querySelector("#sheet-roll-penalty").value = pendingSheetRoll.penalty;
  sheetRollSpecialDiceState = getCustomSpecialDiceState(pendingSheetRoll.specialStr);
  renderSheetRollSpecialDice(modal);
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function getCustomSpecialDiceState(specialStr = "") {
  const trimmed = String(specialStr || "").trim();
  if (!trimmed || !trimmed.startsWith("[")) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry?.kind === "custom" && Array.isArray(entry.faces))
      .map((entry) => buildDieFaces(entry));
  } catch (error) {
    return [];
  }
}

function serializeCustomSpecialDice(state = []) {
  const payload = state.map((faces) => ({
    kind: "custom",
    faces: buildDieFaces({ kind: "custom", faces })
  }));
  return payload.length ? JSON.stringify(payload) : "";
}

function renderSheetRollSpecialDice(modal) {
  const input = modal.querySelector("#sheet-roll-special");
  const list = modal.querySelector("#sheet-roll-special-list");
  const preview = modal.querySelector("#sheet-roll-special-preview");
  if (!input || !list) return;

  input.value = serializeCustomSpecialDice(sheetRollSpecialDiceState);
  const mentalPenaltyFaces = sheetRollIgnoreMentalPenalty ? 0 : getMentalPenaltyFaces();
  const mentalPenaltyLabel = mentalPenaltyFaces > 0 ? `Mental penalty n${mentalPenaltyFaces}` : "";
  if (preview) {
    const previewParts = [];
    if (sheetRollSpecialDiceState.length) {
      previewParts.push(`${sheetRollSpecialDiceState.length} custom ${sheetRollSpecialDiceState.length === 1 ? "die" : "dice"}`);
    }
    if (mentalPenaltyLabel) previewParts.push(mentalPenaltyLabel);
    preview.textContent = previewParts.length ? previewParts.join(" + ") : "None";
  }

  const mentalPenaltyCard = mentalPenaltyFaces > 0
    ? `
      <div class="special-die-card sheet-roll-special-die-card mental-penalty-die-card">
        <div class="special-die-card-faces" aria-label="Automatic Mental penalty die">
          ${buildDieFaces({ kind: "neg", minusCount: mentalPenaltyFaces }).map((face, faceIndex) => `
            <button
              type="button"
              class="special-die-editor-face ${getSpecialFaceClass(face)}"
              disabled
            >
              ${getSpecialFaceDisplay(face, faceIndex)}
            </button>
          `).join("")}
        </div>
        <span class="mental-penalty-label">Auto Mental penalty: n${mentalPenaltyFaces}</span>
        <button type="button" class="icon-action-btn equipment-remove-btn" data-sheet-mental-remove aria-label="Remove automatic Mental penalty">⌫</button>
      </div>
    `
    : "";

  if (!sheetRollSpecialDiceState.length && !mentalPenaltyCard) {
    list.innerHTML = '<p class="special-dice-empty">No special dice.</p>';
    return;
  }

  const customDiceHtml = sheetRollSpecialDiceState
    .map((faces, dieIndex) => `
      <div class="special-die-card sheet-roll-special-die-card">
        <div class="special-die-card-faces" aria-label="Special die ${dieIndex + 1} faces">
          ${faces.map((face, faceIndex) => `
            <button
              type="button"
              class="special-die-editor-face ${getSpecialFaceClass(face)}"
              data-sheet-special-die="${dieIndex}"
              data-face-index="${faceIndex}"
              ${faceIndex === 0 || faceIndex === 5 ? "disabled" : ""}
            >
              ${getSpecialFaceDisplay(face, faceIndex)}
            </button>
          `).join("")}
        </div>
        <button type="button" class="icon-action-btn equipment-remove-btn" data-sheet-special-remove="${dieIndex}" aria-label="Remove special die ${dieIndex + 1}">⌫</button>
      </div>
    `)
    .join("");

  list.innerHTML = `${customDiceHtml}${mentalPenaltyCard}`;
}

function setupCharacterInfoTabs() {
  const tabs = document.querySelectorAll(".character-info-tab[data-character-tab]");
  const panels = document.querySelectorAll(".character-info-panel[data-character-panel]");
  if (!tabs.length || !panels.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.characterTab;

      tabs.forEach((button) => {
        const isActive = button === tab;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive.toString());
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.characterPanel === target;
        panel.classList.toggle("is-active", isActive);
        panel.classList.toggle("hidden", !isActive);
      });
    });
  });
}

function setupFloatingTooltips() {
  let tooltip = document.getElementById("floating-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "floating-tooltip";
    tooltip.className = "floating-tooltip hidden";
    document.body.append(tooltip);
  }

  let activeTarget = null;

  function positionTooltip(target) {
    if (!target || !tooltip) return;

    const rect = target.getBoundingClientRect();
    const margin = 12;
    tooltip.classList.remove("hidden");

    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let top = rect.bottom + 8;

    if (top + tooltipRect.height + margin > window.innerHeight) {
      top = rect.top - tooltipRect.height - 8;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function showTooltip(target) {
    const text = target?.dataset?.tooltip || "";
    if (!text || !tooltip) return;

    activeTarget = target;
    tooltip.textContent = "";
    text.split("\n").forEach((line) => {
      const lineEl = document.createElement("div");
      lineEl.textContent = line;
      if (line.trim().toLowerCase() === "click to edit") {
        lineEl.className = "floating-tooltip-action";
      }
      tooltip.append(lineEl);
    });
    positionTooltip(target);
  }

  function hideTooltip(target) {
    if (target && activeTarget !== target) return;
    activeTarget = null;
    if (tooltip) tooltip.classList.add("hidden");
  }

  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (target) showTooltip(target);
  });

  document.addEventListener("mouseout", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (!target || target.contains(event.relatedTarget)) return;
    hideTooltip(target);
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (target) showTooltip(target);
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (target) hideTooltip(target);
  });

  window.addEventListener("scroll", () => positionTooltip(activeTarget), true);
  window.addEventListener("resize", () => positionTooltip(activeTarget));
}

function setupSpecialDiceBuilder() {
  const specialInput = document.getElementById("special");
  const addBtn = document.getElementById("add-special-die-btn");
  const list = document.getElementById("special-dice-list");
  const preview = document.getElementById("special-preview");

  if (!specialInput || !addBtn || !list) return;

  const modal = ensureSpecialDieModal();

  function syncSpecialDiceInput() {
    const payload = specialDiceBuilderState.map((faces) => ({
      kind: "custom",
      faces
    }));

    specialInput.value = payload.length ? JSON.stringify(payload) : "";

    if (preview) {
      preview.textContent = payload.length
        ? `${payload.length} custom ${payload.length === 1 ? "die" : "dice"}`
        : "None";
    }
  }

  function renderSpecialDiceList() {
    if (!specialDiceBuilderState.length) {
      list.innerHTML = '<p class="special-dice-empty">No special dice.</p>';
      syncSpecialDiceInput();
      return;
    }

    list.innerHTML = specialDiceBuilderState
      .map((faces, index) => `
        <div class="special-die-card">
          <div class="special-die-card-faces" aria-label="Special die ${index + 1} faces">
            ${faces.map((face, faceIndex) => `<span class="special-die-face ${getSpecialFaceClass(face)}">${getSpecialFaceDisplay(face, faceIndex)}</span>`).join("")}
          </div>
          <div class="special-die-card-actions">
            <button type="button" class="icon-action-btn" data-special-die-action="edit" data-index="${index}" aria-label="Edit special die ${index + 1}">✎</button>
            <button type="button" class="icon-action-btn equipment-remove-btn" data-special-die-action="remove" data-index="${index}" aria-label="Remove special die ${index + 1}">⌫</button>
          </div>
        </div>
      `)
      .join("");

    syncSpecialDiceInput();
  }

  function openSpecialDieModal(index = -1) {
    specialDieEditIndex = index;
    specialDieDraftFaces = index >= 0
      ? [...specialDiceBuilderState[index]]
      : ["1", "", "", "", "", "R"];

    renderSpecialDieDraft();
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeSpecialDieModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function renderSpecialDieDraft() {
    const title = document.getElementById("special-die-modal-title");
    const saveBtn = document.getElementById("save-special-die-btn");
    const faceButtons = modal.querySelectorAll(".special-die-editor-face");

    if (title) title.textContent = specialDieEditIndex >= 0 ? "Edit Special Die" : "Add Special Die";
    if (saveBtn) saveBtn.textContent = specialDieEditIndex >= 0 ? "Save" : "Add";

    faceButtons.forEach((button) => {
      const faceIndex = parseInt(button.dataset.faceIndex || "0", 10);
      const face = specialDieDraftFaces[faceIndex] || "";
      button.textContent = getSpecialFaceDisplay(face, faceIndex);
      button.className = `special-die-editor-face ${getSpecialFaceClass(face)}`;
    });
  }

  function cycleSpecialFace(faceIndex) {
    const current = specialDieDraftFaces[faceIndex] || "";
    const next = current === "" ? "+" : current === "+" ? "-" : "";
    specialDieDraftFaces[faceIndex] = next;
    renderSpecialDieDraft();
  }

  addBtn.addEventListener("click", () => openSpecialDieModal());

  list.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("button[data-special-die-action]");
    if (!actionBtn) return;

    const index = parseInt(actionBtn.dataset.index || "-1", 10);
    if (index < 0 || index >= specialDiceBuilderState.length) return;

    if (actionBtn.dataset.specialDieAction === "edit") {
      openSpecialDieModal(index);
    } else if (actionBtn.dataset.specialDieAction === "remove") {
      if (!confirmRemove("Remove this special die?")) return;
      specialDiceBuilderState.splice(index, 1);
      renderSpecialDiceList();
    }
  });

  modal.addEventListener("click", (event) => {
    if (
      event.target.id === "special-die-modal-backdrop" ||
      event.target.id === "close-special-die-modal" ||
      event.target.id === "cancel-special-die-btn"
    ) {
      closeSpecialDieModal();
      return;
    }

    const faceBtn = event.target.closest(".special-die-editor-face");
    if (faceBtn && !faceBtn.disabled) {
      const faceIndex = parseInt(faceBtn.dataset.faceIndex || "0", 10);
      if (faceIndex >= 1 && faceIndex <= 4) cycleSpecialFace(faceIndex);
      return;
    }

    if (event.target.id === "save-special-die-btn") {
      if (specialDieEditIndex >= 0) {
        specialDiceBuilderState[specialDieEditIndex] = [...specialDieDraftFaces];
      } else {
        specialDiceBuilderState.push([...specialDieDraftFaces]);
      }
      renderSpecialDiceList();
      closeSpecialDieModal();
    }
  });

  renderSpecialDiceList();
}

function getSpecialFaceDisplay(face, index) {
  if (index === 0 || face === "1") return ".";
  if (face === "R") return "Ⓡ";
  if (face === "+") return "+";
  if (face === "-") return "-";
  return "";
}

function getSpecialFaceClass(face) {
  if (face === "1") return "is-point";
  if (face === "R") return "is-reroll";
  if (face === "+") return "is-plus";
  if (face === "-") return "is-minus";
  return "is-blank";
}

function ensureSpecialDieModal() {
  let modal = document.getElementById("special-die-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "special-die-modal";
  modal.className = "result-modal hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "special-die-modal-title");
  modal.innerHTML = `
    <div class="result-modal-backdrop" id="special-die-modal-backdrop"></div>
    <div class="result-modal-panel special-die-modal-panel">
      <div class="result-modal-header">
        <h2 id="special-die-modal-title">Add Special Die</h2>
        <button type="button" id="close-special-die-modal" class="result-modal-close" aria-label="Close special die form">×</button>
      </div>
      <div class="result-modal-body">
        <p class="special-die-editor-hint">Click to change dice face.</p>
        <div class="special-die-editor" aria-label="Special die faces">
          <button type="button" class="special-die-editor-face is-point" data-face-index="0" disabled>.</button>
          <button type="button" class="special-die-editor-face is-blank" data-face-index="1"></button>
          <button type="button" class="special-die-editor-face is-blank" data-face-index="2"></button>
          <button type="button" class="special-die-editor-face is-blank" data-face-index="3"></button>
          <button type="button" class="special-die-editor-face is-blank" data-face-index="4"></button>
          <button type="button" class="special-die-editor-face is-reroll" data-face-index="5" disabled>R</button>
        </div>
        <div class="equipment-form-actions">
          <button type="button" id="save-special-die-btn">Add</button>
          <button type="button" id="cancel-special-die-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.append(modal);
  return modal;
}

function createSheetId() {
  return `sheet-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getDefaultHearts() {
  return Array.from({ length: MAX_HEART_COUNT }, () => true);
}

function getMentalMax() {
  const raw = sheetState.globals?.[MENTAL_MAX_KEY];
  const parsed = parseInt(raw ?? DEFAULT_HEART_COUNT, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HEART_COUNT;
  return Math.max(1, Math.min(MAX_HEART_COUNT, parsed));
}

function getNormalizedHeartState() {
  const source = Array.isArray(sheetState.hearts) && sheetState.hearts.length
    ? sheetState.hearts
    : getDefaultHearts();
  return Array.from({ length: MAX_HEART_COUNT }, (_, index) => source[index] !== false);
}

function getCurrentMentalValue() {
  const hearts = getNormalizedHeartState();
  const mentalMax = getMentalMax();

  return hearts
    .slice(0, mentalMax)
    .filter(Boolean)
    .length;
}

function getMentalDamage() {
  return Math.max(0, getMentalMax() - getCurrentMentalValue());
}

function getMentalPenaltyFaces() {
  return Math.floor(getMentalDamage() / 3);
}

function createDefaultSheetPayload(name = "") {
  return {
    attrs: {},
    skills: {},
    successChecks: {},
    hearts: getDefaultHearts(),
    globals: {
      name,
      level: "0",
      exp: "0",
      expMax: "0",
      health: String(BASE_HEALTH),
      healthMax: String(BASE_HEALTH),
      defense: "0",
      will: String(BASE_WILL_POWER),
      profile: "",
      gender: "",
      age: "",
      race: "",
      willSource: "",
      background: "",
      image: "",
      [MENTAL_MAX_KEY]: String(DEFAULT_HEART_COUNT),
      [ATTRIBUTE_MAX_POINTS_KEY]: String(ATTRIBUTE_DEFAULT_MAX_POINTS),
      [GENERAL_ABILITY_MAX_POINTS_KEY]: String(GENERAL_ABILITY_STARTING_POINTS),
      [EXTRA_SKILL_MAX_POINTS_KEY]: String(EXTRA_SKILL_STARTING_POINTS)
    },
    equipment: [],
    statuses: [],
    items: [],
    note: "",
    extraSkills: []
  };
}

function getSheetStorageKey(sheetId) {
  return `${SHEET_STORAGE_PREFIX}${sheetId}`;
}

function loadSheetDirectoryFromStorage() {
  try {
    const raw = localStorage.getItem(SHEET_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not load sheet directory:", error);
    return [];
  }
}

function saveSheetDirectoryToStorage() {
  try {
    localStorage.setItem(SHEET_INDEX_KEY, JSON.stringify(sheetDirectory));
  } catch (error) {
    console.warn("Could not save sheet directory:", error);
  }
}

function getSheetDisplayName(sheet) {
  return sheet?.name?.trim() || "Untitled Character";
}

function updateCurrentSheetName(name) {
  const sheet = sheetDirectory.find((entry) => entry.id === currentSheetId);
  if (!sheet) return;
  sheet.name = name?.trim() || "Untitled Character";
  saveSheetDirectoryToStorage();
  renderSheetTabs();
}

function renderSheetTabs() {
  const tabs = document.getElementById("sheet-tabs");
  if (!tabs) return;

  tabs.innerHTML = sheetDirectory
    .map((sheet) => `<button type="button" class="sheet-tab ${sheet.id === currentSheetId ? "is-active" : ""}" data-sheet-id="${sheet.id}" title="${escapeHtml(getSheetDisplayName(sheet))}">${escapeHtml(getSheetDisplayName(sheet))}</button>`)
    .join("");
}

function canDeleteCurrentSheet() {
  return sheetDirectory.length > 1;
}

function updateDeleteCharacterButton() {
  const btn = document.getElementById("delete-character-btn");
  if (!btn) return;
  btn.disabled = !canDeleteCurrentSheet();
  btn.title = canDeleteCurrentSheet()
    ? "Delete this character"
    : "At least one character tab must remain";
}

function openDeleteCharacterModal() {
  if (!canDeleteCurrentSheet()) {
    alert("At least one character tab must remain.");
    return;
  }

  const nameEl = document.getElementById("delete-character-name");
  if (nameEl) {
    const currentSheet = sheetDirectory.find((sheet) => sheet.id === currentSheetId);
    nameEl.textContent = getSheetDisplayName(currentSheet);
  }

  if (!deleteCharacterModal) return;
  deleteCharacterModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeDeleteCharacterModal() {
  if (!deleteCharacterModal) return;
  deleteCharacterModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function deleteCurrentSheet() {
  if (!canDeleteCurrentSheet()) return;

  const currentIndex = sheetDirectory.findIndex((sheet) => sheet.id === currentSheetId);
  if (currentIndex < 0) return;

  const deletedId = currentSheetId;
  const fallbackSheet = sheetDirectory[currentIndex + 1] || sheetDirectory[currentIndex - 1];

  sheetDirectory = sheetDirectory.filter((sheet) => sheet.id !== deletedId);
  saveSheetDirectoryToStorage();
  localStorage.removeItem(getSheetStorageKey(deletedId));

  closeDeleteCharacterModal();

  if (fallbackSheet) {
    currentSheetId = fallbackSheet.id;
    sessionStorage.setItem(ACTIVE_SHEET_KEY, currentSheetId);
    loadSheetStateFromStorage();
    applySheetStateToUI();
  }
}

function setupDeleteCharacterControls() {
  deleteCharacterModal = document.getElementById("delete-character-modal");
  const openBtn = document.getElementById("delete-character-btn");
  const closeBtn = document.getElementById("close-delete-character-modal");
  const cancelBtn = document.getElementById("cancel-delete-character-btn");
  const confirmBtn = document.getElementById("confirm-delete-character-btn");
  const backdrop = document.getElementById("delete-character-modal-backdrop");

  if (openBtn) openBtn.addEventListener("click", openDeleteCharacterModal);
  if (closeBtn) closeBtn.addEventListener("click", closeDeleteCharacterModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeDeleteCharacterModal);
  if (confirmBtn) confirmBtn.addEventListener("click", deleteCurrentSheet);
  if (backdrop) backdrop.addEventListener("click", closeDeleteCharacterModal);
}

function openNewCharacterModal() {
  if (!newCharacterModal) return;
  const nameInput = document.getElementById("new-character-name");
  if (nameInput) nameInput.value = "";
  newCharacterModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => nameInput?.focus(), 0);
}

function closeNewCharacterModal() {
  if (!newCharacterModal) return;
  newCharacterModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function createNewSheetFromModal(event) {
  event.preventDefault();
  const nameInput = document.getElementById("new-character-name");
  const name = nameInput?.value.trim() || "";
  if (!name) {
    nameInput?.focus();
    return;
  }

  const nextId = createNewSheet(name);
  closeNewCharacterModal();
  switchToSheet(nextId);
}

function setupNewCharacterControls() {
  newCharacterModal = document.getElementById("new-character-modal");
  const form = document.getElementById("new-character-form");
  const closeBtn = document.getElementById("close-new-character-modal");
  const cancelBtn = document.getElementById("cancel-new-character-btn");
  const backdrop = document.getElementById("new-character-modal-backdrop");

  if (form) form.addEventListener("submit", createNewSheetFromModal);
  if (closeBtn) closeBtn.addEventListener("click", closeNewCharacterModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeNewCharacterModal);
  if (backdrop) backdrop.addEventListener("click", closeNewCharacterModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && newCharacterModal && !newCharacterModal.classList.contains("hidden")) {
      closeNewCharacterModal();
    }
  });
}

function createNewSheet(initialName = "") {
  const id = createSheetId();
  const fallbackName = `Character ${sheetDirectory.length + 1}`;
  const displayName = initialName.trim() || fallbackName;
  const payload = createDefaultSheetPayload(initialName.trim());

  sheetDirectory.push({ id, name: displayName });
  saveSheetDirectoryToStorage();
  localStorage.setItem(getSheetStorageKey(id), JSON.stringify(payload));
  return id;
}

function migrateLegacySheetIfNeeded() {
  const existingSheets = loadSheetDirectoryFromStorage();
  if (existingSheets.length) return existingSheets;

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return existingSheets;

  try {
    const legacyData = JSON.parse(legacyRaw);
    const migratedId = createSheetId();
    const migratedName = legacyData?.globals?.name?.trim() || "Character 1";
    localStorage.setItem(getSheetStorageKey(migratedId), JSON.stringify({
      ...createDefaultSheetPayload(legacyData?.globals?.name || ""),
      ...legacyData,
      successChecks: legacyData?.successChecks || {},
      hearts: Array.isArray(legacyData?.hearts) ? legacyData.hearts : getDefaultHearts(),
      globals: {
        ...createDefaultSheetPayload("").globals,
        ...(legacyData?.globals || {})
      }
    }));
    const migratedSheets = [{ id: migratedId, name: migratedName }];
    localStorage.setItem(SHEET_INDEX_KEY, JSON.stringify(migratedSheets));
    return migratedSheets;
  } catch (error) {
    console.warn("Could not migrate legacy sheet data:", error);
    return existingSheets;
  }
}

function initSheetManager() {
  sheetDirectory = migrateLegacySheetIfNeeded();
  if (!sheetDirectory.length) {
    createNewSheet("");
  }
  sheetDirectory = loadSheetDirectoryFromStorage();

  const tabs = document.getElementById("sheet-tabs");
  const newSheetBtn = document.getElementById("new-sheet-btn");
  const savedActiveSheetId = sessionStorage.getItem(ACTIVE_SHEET_KEY);
  currentSheetId = sheetDirectory.some((sheet) => sheet.id === savedActiveSheetId)
    ? savedActiveSheetId
    : sheetDirectory[0]?.id || "";

  if (currentSheetId) {
    sessionStorage.setItem(ACTIVE_SHEET_KEY, currentSheetId);
  }

  if (tabs) {
    tabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".sheet-tab[data-sheet-id]");
      if (!tab) return;
      switchToSheet(tab.dataset.sheetId);
    });
  }

  if (newSheetBtn) {
    newSheetBtn.addEventListener("click", openNewCharacterModal);
  }

  renderSheetTabs();
  updateDeleteCharacterButton();
}

function resetSheetState() {
  Object.keys(sheetState.attrs).forEach((key) => delete sheetState.attrs[key]);
  Object.keys(sheetState.skills).forEach((key) => delete sheetState.skills[key]);
  Object.keys(sheetState.successChecks).forEach((key) => delete sheetState.successChecks[key]);
  sheetState.hearts = getDefaultHearts();
  sheetState.globals = {};
  sheetState.equipment = [];
  sheetState.statuses = [];
  sheetState.items = [];
  sheetState.note = "";
  sheetState.extraSkills = [];
}

function applySheetStateToUI() {
  const globalMap = [
    { id: "char-name", key: "name", fallback: "" },
    { id: "char-level", key: "level", fallback: "0" },
    { id: "char-exp", key: "exp", fallback: "0" },
    { id: "char-exp-max", key: "expMax", fallback: "0" },
    { id: "char-health", key: "health", fallback: "0" },
    { id: "char-health-max", key: "healthMax", fallback: "0" },
    { id: "char-defense", key: "defense", fallback: "0" },
    { id: "char-willpower", key: "will", fallback: "0" },
    { id: "profile-char-name", key: "name", fallback: "" },
    { id: "char-gender", key: "gender", fallback: "" },
    { id: "char-age", key: "age", fallback: "" },
    { id: "char-race", key: "race", fallback: "" },
    { id: "char-will-source", key: "willSource", fallback: "" },
    { id: "char-background", key: "background", fallback: "" }
  ];

  globalMap.forEach(({ id, key, fallback }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = sheetState.globals?.[key] != null ? sheetState.globals[key] : fallback;
  });
  clampExpFields();
  // clampHealthFields();

  applyMentalHeartsToUI();

  document.querySelectorAll('.stat-row[data-role="attr"]').forEach((row) => {
    const key = row.dataset.stat;
    if (sheetState.attrs[key] == null || sheetState.attrs[key] < 1) {
      sheetState.attrs[key] = 1;
    }
    updateStatDots(row, sheetState.attrs[key] || 0);
    const checkbox = row.querySelector(".stat-succeed");
    if (checkbox) checkbox.checked = !!sheetState.successChecks[getStatSuccessKey(row)];
  });

  document.querySelectorAll('.stat-row[data-role="skill"]').forEach((row) => {
    const key = row.dataset.skill || row.dataset.stat;
    updateStatDots(row, sheetState.skills[key] || 0);
    const checkbox = row.querySelector(".stat-succeed");
    if (checkbox) checkbox.checked = !!sheetState.successChecks[getStatSuccessKey(row)];
  });

  renderEquipmentList();
  renderStatusList();
  renderItemList();
  renderNotePanel();
  renderExtraSkillList();
  applyCharacterImageFromState();
  updateDerivedCharacterVitals();
  renderSheetTabs();
  updateDeleteCharacterButton();
}

function switchToSheet(sheetId) {
  if (!sheetDirectory.some((sheet) => sheet.id === sheetId)) return;
  saveSheetStateToStorage();
  currentSheetId = sheetId;
  sessionStorage.setItem(ACTIVE_SHEET_KEY, currentSheetId);
  loadSheetStateFromStorage();
  applySheetStateToUI();
}

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
  const deleteBtn = document.getElementById("delete-equipment-btn");
  const backdrop = document.getElementById("equipment-modal-backdrop");
  const form = document.getElementById("equipment-form");
  const list = document.getElementById("equipment-list");
  const equipmentBlock = document.querySelector(".equipment-block");
  const basicGearTags = document.getElementById("basic-gear-tags");
  const openDependencyBtn = document.getElementById("open-equipment-dependency-modal");
  const closeDependencyBtn = document.getElementById("close-equipment-dependency-modal");
  const cancelDependencyBtn = document.getElementById("cancel-equipment-dependency-btn");
  const saveDependencyBtn = document.getElementById("save-equipment-dependency-btn");
  const dependencyBackdrop = document.getElementById("equipment-dependency-modal-backdrop");
  const statToggles = document.querySelectorAll("[data-equipment-stat-toggle]");

  if (!list || !form) return;

  if (openBtn) {
    openBtn.addEventListener("click", () => openEquipmentModal(null, "wearing"));
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeEquipmentModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeEquipmentModal);
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", onEquipmentModalDelete);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeEquipmentModal);
  }

  if (openDependencyBtn) {
    openDependencyBtn.addEventListener("click", openEquipmentDependencyModal);
  }

  if (closeDependencyBtn) {
    closeDependencyBtn.addEventListener("click", closeEquipmentDependencyModal);
  }

  if (cancelDependencyBtn) {
    cancelDependencyBtn.addEventListener("click", closeEquipmentDependencyModal);
  }

  if (saveDependencyBtn) {
    saveDependencyBtn.addEventListener("click", saveEquipmentDependenciesFromModal);
  }

  if (dependencyBackdrop) {
    dependencyBackdrop.addEventListener("click", closeEquipmentDependencyModal);
  }

  statToggles.forEach((toggle) => {
    toggle.addEventListener("change", () => updateEquipmentStatOption(toggle.dataset.equipmentStatToggle));
  });

  // FIX: Ensure form exists before adding listener
  if (form) {
    form.addEventListener("submit", onEquipmentSubmit);
  }

  if (equipmentBlock) {
    equipmentBlock.addEventListener("click", (event) => {
      const addSlotBtn = event.target.closest("button[data-equipment-add-slot]");
      if (addSlotBtn) {
        openEquipmentModal(null, addSlotBtn.dataset.equipmentAddSlot || "wearing");
        return;
      }

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

      if (action === "roll") {
        rollEquipment(item);
        return;
      }

      if (action === "remove") {
        removeEquipment(id);
      }
    });

    equipmentBlock.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-equipment-field][data-equipment-id]");
      if (!input) return;

      updateEquipmentNumberField(
        input.dataset.equipmentId,
        input.dataset.equipmentField,
        input.value
      );
    });

    equipmentBlock.addEventListener("change", (event) => {
      const input = event.target.closest("input[data-equipment-field][data-equipment-id]");
      if (!input) return;

      updateEquipmentNumberField(
        input.dataset.equipmentId,
        input.dataset.equipmentField,
        input.value
      );
    });
  }

  if (basicGearTags) {
    basicGearTags.addEventListener("click", (event) => {

      // 🎲 PRIORITY: Roll button
      const rollBtn = event.target.closest("button[data-basic-equipment-roll-id]");
      if (rollBtn) {
        event.stopPropagation();
        const item = sheetState.equipment.find(
          (entry) => entry.id === rollBtn.dataset.basicEquipmentRollId
        );
        if (item) rollEquipment(item);
        return;
      }

      // ✏️ Click anywhere on tag → edit
      const tag = event.target.closest("[data-basic-equipment-id]");
      if (!tag) return;

      const item = sheetState.equipment.find(
        (entry) => entry.id === tag.dataset.basicEquipmentId
      );
      if (item) openEquipmentModal(item);
    });
  }

  renderEquipmentList();

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("equipment-modal");
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeEquipmentModal();
    }

    const dependencyModal = document.getElementById("equipment-dependency-modal");
    if (event.key === "Escape" && dependencyModal && !dependencyModal.classList.contains("hidden")) {
      closeEquipmentDependencyModal();
    }
  });
}

function openEquipmentModal(item = null, slot = "wearing") {
  const modal = document.getElementById("equipment-modal");
  const title = document.getElementById("equipment-modal-title");
  const saveBtn = document.getElementById("save-equipment-btn");
  const deleteBtn = document.getElementById("delete-equipment-btn");
  const form = document.getElementById("equipment-form");

  if (!modal || !form) return;

  populateEquipmentForm(item, slot);
  equipmentDependencySelection = Array.isArray(item?.dependencies) ? [...item.dependencies] : [];
  renderEquipmentDependencyList();

  if (title) {
    title.textContent = item ? "Edit Equipment" : "Add Equipment";
  }

  if (saveBtn) {
    saveBtn.textContent = item ? "Save" : "Add";
  }

  if (deleteBtn) {
    deleteBtn.classList.toggle("hidden", !item);
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEquipmentModal() {
  const modal = document.getElementById("equipment-modal");
  const dependencyModal = document.getElementById("equipment-dependency-modal");
  const form = document.getElementById("equipment-form");
  const title = document.getElementById("equipment-modal-title");
  const saveBtn = document.getElementById("save-equipment-btn");
  const deleteBtn = document.getElementById("delete-equipment-btn");

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

  if (deleteBtn) {
    deleteBtn.classList.add("hidden");
  }

  if (dependencyModal) {
    dependencyModal.classList.add("hidden");
  }

  equipmentDependencySelection = [];
  renderEquipmentDependencyList();

  document.body.style.overflow = "";
}

function populateEquipmentForm(item, slot = "wearing") {
  const idInput = document.getElementById("equipment-id");
  const nameInput = document.getElementById("equipment-name");
  const descriptionInput = document.getElementById("equipment-description");
  const dmgInput = document.getElementById("equipment-dmg");
  const chargeInput = document.getElementById("equipment-charge");
  const defInput = document.getElementById("equipment-def");
  const toughnessInput = document.getElementById("equipment-toughness");
  const slotInputs = document.querySelectorAll('input[name="equipment-slot"]');

  if (!nameInput) return;

  if (!item) {
    if (idInput) idInput.value = "";
    nameInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    if (dmgInput) dmgInput.value = "";
    if (chargeInput) chargeInput.value = "0";
    if (defInput) defInput.value = "0";
    if (toughnessInput) toughnessInput.value = "0";
    slotInputs.forEach((input) => {
      input.checked = input.value === normalizeEquipmentSlot(slot);
    });
    ["dmg", "charge", "def", "toughness"].forEach((field) => setEquipmentStatChecked(field, false));
    return;
  }

  const normalized = normalizeEquipmentItem(item);
  if (idInput) idInput.value = item.id;
  nameInput.value = normalized.name || "";
  if (descriptionInput) descriptionInput.value = normalized.description || "";
  if (dmgInput) dmgInput.value = normalized.dmg || "";
  if (chargeInput) chargeInput.value = normalized.charge ?? 0;
  if (defInput) defInput.value = normalized.def ?? 0;
  if (toughnessInput) toughnessInput.value = normalized.toughness ?? 0;
  slotInputs.forEach((input) => {
    input.checked = input.value === normalized.slot;
  });
  ["dmg", "charge", "def", "toughness"].forEach((field) => {
    setEquipmentStatChecked(field, !!normalized.stats?.[field]);
  });
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
  const selectedSlot = document.querySelector('input[name="equipment-slot"]:checked');

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter an equipment name.");
    return;
  }

  const stats = {
    dmg: isEquipmentStatChecked("dmg"),
    charge: isEquipmentStatChecked("charge"),
    def: isEquipmentStatChecked("def"),
    toughness: isEquipmentStatChecked("toughness")
  };

  let charge = parseInt(chargeInput?.value || "0", 10);
  if (Number.isNaN(charge) || charge < 0) charge = 0;
  let def = parseInt(defInput?.value || "0", 10);
  if (Number.isNaN(def) || def < 0) def = 0;
  let toughness = parseInt(toughnessInput?.value || "0", 10);
  if (Number.isNaN(toughness) || toughness < 0) toughness = 0;

  const existingId = idInput?.value || "";
  const payload = {
    id: existingId || `equip-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    description: descriptionInput?.value.trim() || "",
    slot: normalizeEquipmentSlot(selectedSlot?.value || "wearing"),
    dmg: stats.dmg ? dmgInput?.value.trim() || "" : "",
    charge: stats.charge ? charge : 0,
    def: stats.def ? def : 0,
    toughness: stats.toughness ? toughness : 0,
    stats,
    dependencies: [...equipmentDependencySelection]
  };

  if (payload.slot === "left-hand" || payload.slot === "right-hand") {
    sheetState.equipment = sheetState.equipment.filter((item) => {
      const normalized = normalizeEquipmentItem(item);
      return normalized.slot !== payload.slot || item.id === payload.id;
    });
  }

  const existingIndex = sheetState.equipment.findIndex((item) => item.id === payload.id);
  if (existingIndex >= 0) {
    sheetState.equipment[existingIndex] = payload;
  } else {
    sheetState.equipment.unshift(payload);
  }

  renderEquipmentList();
  saveSheetStateToStorage();
  closeEquipmentModal();
}

function removeEquipment(id) {
  if (!confirmRemove("Remove this equipment?")) return false;
  sheetState.equipment = sheetState.equipment.filter((item) => item.id !== id);
  renderEquipmentList();
  saveSheetStateToStorage();
  return true;
}

function onEquipmentModalDelete() {
  const idInput = document.getElementById("equipment-id");
  const id = idInput?.value || "";
  if (!id) return;

  if (removeEquipment(id)) {
    closeEquipmentModal();
  }
}

function collectStatOptions() {
  return Array.from(document.querySelectorAll(".stat-row")).map((row) => {
    const role = row.dataset.role || "attr";
    const id = role === "skill" ? row.dataset.skill || "" : row.dataset.stat || "";
    let label = "";

    if (role === "skill") {
      label = row.querySelector(".stat-name")?.textContent?.trim() || id;
    } else {
      label = row.querySelector(".stat-label")?.textContent?.trim() || id;
    }

    return {
      id,
      role,
      label,
      attr: row.dataset.attr || "",
      altAttr: row.dataset.altAttr || row.dataset.altattr || ""
    };
  }).filter((entry) => entry.id);
}

function renderEquipmentDependencyList() {
  const container = document.getElementById("equipment-dependency-list");
  if (!container) return;

  if (!equipmentDependencySelection.length) {
    container.innerHTML = '<p class="equipment-empty equipment-empty-inline">No related stat(s) selected.</p>';
    return;
  }

  container.innerHTML = equipmentDependencySelection
    .map((id) => statOptions.find((option) => option.id === id))
    .filter(Boolean)
    .map((option) => `<span class="dependency-chip">${escapeHtml(option.label)}</span>`)
    .join("");
}

function openEquipmentDependencyModal() {
  const modal = document.getElementById("equipment-dependency-modal");
  const container = document.getElementById("equipment-dependency-options");
  if (!modal || !container) return;

  const attrs = statOptions.filter((option) => option.role === "attr");
  const skills = statOptions.filter((option) => option.role === "skill");

  container.innerHTML = `
    <div class="dependency-group">
      <h3>Attributes</h3>
      <div class="dependency-grid">
        ${attrs.map((option) => `
          <label class="dependency-option">
            <input type="checkbox" value="${option.id}" ${equipmentDependencySelection.includes(option.id) ? "checked" : ""}>
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
    <div class="dependency-group">
      <h3>General Ability</h3>
      <div class="dependency-grid">
        ${skills.map((option) => `
          <label class="dependency-option">
            <input type="checkbox" value="${option.id}" ${equipmentDependencySelection.includes(option.id) ? "checked" : ""}>
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEquipmentDependencyModal() {
  const modal = document.getElementById("equipment-dependency-modal");
  const equipmentModal = document.getElementById("equipment-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  document.body.style.overflow =
    equipmentModal && !equipmentModal.classList.contains("hidden") ? "hidden" : "";
}

function saveEquipmentDependenciesFromModal() {
  const container = document.getElementById("equipment-dependency-options");
  if (!container) return;

  equipmentDependencySelection = Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked')
  ).map((input) => input.value);

  renderEquipmentDependencyList();
  closeEquipmentDependencyModal();
}

function getDependencyRollDice(dependencyIds = []) {
  if (!Array.isArray(dependencyIds) || !dependencyIds.length) return 0;

  let total = 0;
  dependencyIds.forEach((id) => {
    const option = statOptions.find((entry) => entry.id === id);
    if (!option) return;

    if (option.role === "attr") {
      total += sheetState.attrs[id] || 0;
    } else {
      const skillValue = sheetState.skills[id] || 0;
      let attrDice = 0;

      if (option.attr) {
        const primary = sheetState.attrs[option.attr] || 0;
        if (option.altAttr) {
          const alt = sheetState.attrs[option.altAttr] || 0;
          attrDice = Math.max(primary, alt);
        } else {
          attrDice = primary;
        }
      }

      total += skillValue + attrDice;
    }
  });

  return total;
}

function getEquipmentRollDice(item) {
  return getDependencyRollDice(item.dependencies);
}

function getDependencySuccessBonus(dependencyIds = []) {
  if (!Array.isArray(dependencyIds) || !dependencyIds.length) return 0;

  const bonusKeys = new Set();

  dependencyIds.forEach((id) => {
    const option = statOptions.find((entry) => entry.id === id);
    if (!option) return;

    if (option.role === "attr") {
      const row = document.querySelector(`.stat-row[data-role="attr"][data-stat="${id}"]`);
      const checkbox = row?.querySelector(".stat-succeed");
      if (checkbox?.checked) {
        bonusKeys.add(`attr:${id}`);
      }
      return;
    }

    const skillRow = document.querySelector(`.stat-row[data-role="skill"][data-skill="${id}"]`);
    const skillCheckbox = skillRow?.querySelector(".stat-succeed");
    if (skillCheckbox?.checked) {
      bonusKeys.add(`skill:${id}`);
    }

    if (option.attr) {
      const primaryValue = sheetState.attrs[option.attr] || 0;
      let chosenAttr = option.attr;

      if (option.altAttr) {
        const altValue = sheetState.attrs[option.altAttr] || 0;
        if (altValue > primaryValue) {
          chosenAttr = option.altAttr;
        }
      }

      const attrRow = document.querySelector(`.stat-row[data-role="attr"][data-stat="${chosenAttr}"]`);
      const attrCheckbox = attrRow?.querySelector(".stat-succeed");
      if (attrCheckbox?.checked) {
        bonusKeys.add(`attr:${chosenAttr}`);
      }
    }
  });

  return bonusKeys.size;
}

function getEquipmentRollSuccessBonus(item) {
  return getDependencySuccessBonus(item.dependencies);
}

function rollEquipment(item) {
  const totalDice = getEquipmentRollDice(item);
  if (totalDice <= 0) {
    alert("This equipment has no usable related stat(s) yet. Add related stat(s) and make sure those stats have points.");
    return;
  }

  const specialInput = document.getElementById("special");
  const successInput = document.getElementById("success");
  const penaltyInput = document.getElementById("penalty");
  let globalSuccess = parseInt(successInput?.value || "0", 10);
  if (Number.isNaN(globalSuccess) || globalSuccess < 0) globalSuccess = 0;

  openSheetRollModal({
    label: item.name || "Equipment Roll",
    detail: "Equipment",
    total: totalDice,
    specialStr: specialInput?.value || "",
    success: globalSuccess + getEquipmentRollSuccessBonus(item),
    penalty: penaltyInput?.value || "0",
    equipmentDmg: item.dmg
  });
}

function updateEquipmentNumberField(id, field, value) {
  const item = sheetState.equipment.find((entry) => entry.id === id);
  if (!item) return;

  if (!["charge", "def", "toughness"].includes(field)) return;

  let nextValue = parseInt(value ?? "0", 10);
  if (Number.isNaN(nextValue) || nextValue < 0) nextValue = 0;

  item[field] = nextValue;
  item.stats = {
    ...(item.stats || {}),
    [field]: true
  };
  updateDerivedDefenseFromGear();
  renderBasicGearTags();
  saveSheetStateToStorage();
}

function renderEquipmentList() {
  const wearingList = document.getElementById("equipment-list");
  const leftHandList = document.getElementById("left-hand-equipment-list");
  const rightHandList = document.getElementById("right-hand-equipment-list");
  if (!wearingList) return;

  const normalizedEquipment = Array.isArray(sheetState.equipment)
    ? sheetState.equipment.map(normalizeEquipmentItem)
    : [];

  const leftHand = normalizedEquipment.filter((item) => item.slot === "left-hand");
  const rightHand = normalizedEquipment.filter((item) => item.slot === "right-hand");
  const wearing = normalizedEquipment.filter((item) => item.slot === "wearing");

  if (leftHandList) {
    leftHandList.innerHTML = leftHand.length
      ? renderEquipmentCard(leftHand[0])
      : '<p class="equipment-empty">Empty hand.</p>';
  }

  if (rightHandList) {
    rightHandList.innerHTML = rightHand.length
      ? renderEquipmentCard(rightHand[0])
      : '<p class="equipment-empty">Empty hand.</p>';
  }

  wearingList.innerHTML = wearing.length
    ? wearing.map(renderEquipmentCard).join("")
    : '<p class="equipment-empty">No worn equipment yet.</p>';

  updateDerivedDefenseFromGear();
  renderBasicGearTags();
}

function renderEquipmentCard(item) {
  const canRoll = isEquipmentRollable(item);
  return `
      <div class="equipment-item">
        <div class="equipment-item-info">
          <span class="equipment-name">${escapeHtml(item.name || "")}</span>
          <div class="equipment-preview">
            ${renderEquipmentStatPreview(item)}
          </div>
          <div class="equipment-preview equipment-dependency-preview">
            ${Array.isArray(item.dependencies) && item.dependencies.length
              ? item.dependencies
                  .map((id) => statOptions.find((option) => option.id === id))
                  .filter(Boolean)
                  .map((option) => `<span class="dependency-chip">${escapeHtml(option.label)}</span>`)
                  .join("")
              : '<span class="equipment-dependency-empty">No related stat(s)</span>'}
          </div>
        </div>
        <div class="equipment-item-actions">
          ${canRoll ? `<button type="button" class="equipment-roll-btn" data-action="roll" data-id="${item.id}">Roll</button>` : ""}
          <button type="button" class="icon-action-btn" data-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name || "equipment")}">✎</button>
          <button type="button" class="icon-action-btn equipment-remove-btn" data-action="remove" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.name || "equipment")}">⌫</button>
        </div>
      </div>
    `;
}

function isEquipmentRollable(item) {
  return Array.isArray(item?.dependencies) && item.dependencies.length > 0;
}

function renderEquipmentStatPreview(item) {
  const parts = [];
  if (item.stats?.dmg) {
    parts.push(`
      <span class="equipment-number-inline equipment-dmg-inline">
        <span>DMG</span>
        <span class="equipment-dmg-value">${escapeHtml(item.dmg || "-")}</span>
      </span>
    `);
  }
  if (item.stats?.charge) {
    parts.push(`
      <label class="equipment-number-inline">
        <span>Charge</span>
        <input type="number" min="0" value="${escapeHtml(item.charge ?? 0)}" data-equipment-id="${item.id}" data-equipment-field="charge" aria-label="Charge for ${escapeHtml(item.name || "equipment")}">
      </label>
    `);
  }
  if (item.stats?.def) {
    parts.push(`
      <label class="equipment-number-inline">
        <span>DEF</span>
        <input type="number" min="0" value="${escapeHtml(item.def ?? 0)}" data-equipment-id="${item.id}" data-equipment-field="def" aria-label="DEF for ${escapeHtml(item.name || "equipment")}">
      </label>
    `);
  }
  if (item.stats?.toughness) {
    parts.push(`
      <label class="equipment-number-inline">
        <span>TOUGH</span>
        <input type="number" min="0" value="${escapeHtml(item.toughness ?? 0)}" data-equipment-id="${item.id}" data-equipment-field="toughness" aria-label="Toughness for ${escapeHtml(item.name || "equipment")}">
      </label>
    `);
  }

  return parts.length ? parts.join("") : '<span class="equipment-dependency-empty">No visible stats</span>';
}

function normalizeEquipmentSlot(slot) {
  if (slot === "left-hand" || slot === "right-hand" || slot === "wearing") return slot;
  return "wearing";
}

function normalizeEquipmentItem(item) {
  const charge = parseInt(item?.charge ?? "0", 10);
  const def = parseInt(item?.def ?? "0", 10);
  const toughness = parseInt(item?.toughness ?? "0", 10);
  const stats = {
    dmg: item?.stats?.dmg ?? !!item?.dmg,
    charge: item?.stats?.charge ?? (!Number.isNaN(charge) && charge > 0),
    def: item?.stats?.def ?? (!Number.isNaN(def) && def > 0),
    toughness: item?.stats?.toughness ?? (!Number.isNaN(toughness) && toughness > 0)
  };

  return {
    ...item,
    slot: normalizeEquipmentSlot(item?.slot || "wearing"),
    charge: Number.isNaN(charge) || charge < 0 ? 0 : charge,
    def: Number.isNaN(def) || def < 0 ? 0 : def,
    toughness: Number.isNaN(toughness) || toughness < 0 ? 0 : toughness,
    stats
  };
}

function isEquipmentStatChecked(field) {
  const input = document.querySelector(`[data-equipment-stat-toggle="${field}"]`);
  return !!input?.checked;
}

function setEquipmentStatChecked(field, checked) {
  const input = document.querySelector(`[data-equipment-stat-toggle="${field}"]`);
  if (input) input.checked = checked;
  updateEquipmentStatOption(field);
}

function updateEquipmentStatOption(field) {
  const toggle = document.querySelector(`[data-equipment-stat-toggle="${field}"]`);
  const valueInput = document.getElementById(`equipment-${field}`);
  if (!toggle || !valueInput) return;

  valueInput.disabled = !toggle.checked;
  if (!toggle.checked) {
    valueInput.value = field === "dmg" ? "" : "0";
  }
}

function updateDerivedDefenseFromGear() {
  const defenseInput = document.getElementById("char-defense");
  if (!defenseInput) return;

  const totalDef = Array.isArray(sheetState.equipment)
    ? sheetState.equipment
        .map(normalizeEquipmentItem)
        .filter((item) => item.slot === "wearing" && item.stats?.def)
        .reduce((total, item) => total + (item.def || 0), 0)
    : 0;

  defenseInput.value = String(totalDef);
  if (sheetState.globals) sheetState.globals.defense = String(totalDef);
}

function updateDerivedCharacterVitals() {
  const healthInput = document.getElementById("char-health");
  const healthMaxInput = document.getElementById("char-health-max");

  // ✅ Use stored max HP ONLY
  const parsedMax = parseInt(sheetState.globals?.healthMax ?? "", 10);
  const safeHealthMax =
    Number.isFinite(parsedMax) && parsedMax > 0
      ? parsedMax
      : BASE_HEALTH;

  if (healthInput && healthMaxInput) {
    // ✅ Use stored current HP ONLY
    const storedCurrent = parseInt(sheetState.globals?.health ?? "", 10);

    let nextCurrent = Number.isFinite(storedCurrent)
      ? storedCurrent
      : safeHealthMax;

    if (nextCurrent > safeHealthMax) {
      nextCurrent = safeHealthMax;
    }

    healthMaxInput.value = String(safeHealthMax);
    healthInput.value = String(nextCurrent);
  }
}


function renderBasicGearTags() {
  const container = document.getElementById("basic-gear-tags");
  if (!container) return;

  const shownGear = Array.isArray(sheetState.equipment)
    ? sheetState.equipment.map(normalizeEquipmentItem)
    : [];

  if (!shownGear.length) {
    container.innerHTML = '<span class="basic-status-empty">No gear.</span>';
    return;
  }

  container.innerHTML = shownGear.map((item) => {
    const stats = [
      item.stats?.dmg ? `DMG ${item.dmg || "-"}` : "",
      item.stats?.charge ? `Charge ${item.charge || 0}` : "",
      item.stats?.def ? `DEF ${item.def || 0}` : "",
      item.stats?.toughness ? `Tough ${item.toughness || 0}` : ""
    ].filter(Boolean).join(" | ");
    const slotLabel = getEquipmentSlotLabel(item.slot);
    const tooltip = [
      item.name || "Equipment",
      slotLabel,
      stats,
      item.description || "",
      "Click to edit"
    ].filter(Boolean).join("\n");
    const rollButton = isEquipmentRollable(item)
      ? `<button type="button" class="basic-gear-roll-btn" data-basic-equipment-roll-id="${escapeHtml(item.id || "")}" aria-label="Roll ${escapeHtml(item.name || "equipment")}">Roll</button>`
      : "";
    return `
    <span
      class="basic-gear-tag"
      data-basic-equipment-id="${escapeHtml(item.id || "")}"
      data-tooltip="${escapeHtml(tooltip)}"
      role="button"
      tabindex="0"
    >
      <span>${escapeHtml(item.name || "Equipment")}</span>
      <span class="basic-status-turns">${escapeHtml(slotLabel)}</span>

      ${item.slot === "wearing" && item.stats?.def 
        ? `<span class="basic-status-turns">DEF ${escapeHtml(item.def || 0)}</span>` 
        : ""}

      ${rollButton}

      <button
        type="button"
        class="basic-gear-edit-btn"
        data-basic-equipment-edit-id="${escapeHtml(item.id || "")}"
        aria-label="Edit ${escapeHtml(item.name || "equipment")}"
      >
        ✎
      </button>
    </span>
    `;
  }).join("");
}

function getEquipmentSlotLabel(slot) {
  const labels = {
    "left-hand": "Left Hand",
    "right-hand": "Right Hand",
    wearing: "Wearing"
  };
  return labels[normalizeEquipmentSlot(slot)] || "Wearing";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function confirmRemove(message) {
  return window.confirm(message || "Remove this?");
}

function setupStatuses() {
  const openBtn = document.getElementById("open-status-modal");
  const closeBtn = document.getElementById("close-status-modal");
  const cancelBtn = document.getElementById("cancel-status-btn");
  const backdrop = document.getElementById("status-modal-backdrop");
  const form = document.getElementById("status-form");
  const list = document.getElementById("status-list");
  const basicTags = document.getElementById("basic-status-tags");
  const deleteBtn = document.getElementById("delete-status-btn");
  const durationKindInputs = document.querySelectorAll('input[name="status-duration-kind"]');
  const durationModeInputs = document.querySelectorAll('input[name="status-duration-mode"]');

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

  if (deleteBtn) {
    deleteBtn.addEventListener("click", onStatusModalDelete);
  }

  form.addEventListener("submit", onStatusSubmit);
  durationKindInputs.forEach((input) => {
    input.addEventListener("change", updateStatusDurationFormVisibility);
  });
  durationModeInputs.forEach((input) => {
    input.addEventListener("change", updateStatusDurationFormVisibility);
  });

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

  if (basicTags) {
    basicTags.addEventListener("click", (event) => {
      const tag = event.target.closest("[data-basic-status-id]");
      if (!tag) return;

      const item = sheetState.statuses.find((entry) => entry.id === tag.dataset.basicStatusId);
      if (item) openStatusModal(item);
    });
  }

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
  const deleteBtn = document.getElementById("delete-status-btn");
  const form = document.getElementById("status-form");

  if (!modal || !form) return;

  populateStatusForm(item);

  if (title) {
    title.textContent = item ? "Edit Status" : "Add Status";
  }

  if (saveBtn) {
    saveBtn.textContent = item ? "Save" : "Save";
  }

  if (deleteBtn) {
    deleteBtn.classList.toggle("hidden", !item);
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeStatusModal() {
  const modal = document.getElementById("status-modal");
  const form = document.getElementById("status-form");
  const title = document.getElementById("status-modal-title");
  const saveBtn = document.getElementById("save-status-btn");
  const deleteBtn = document.getElementById("delete-status-btn");
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
    title.textContent = "Add Status";
  }

  if (saveBtn) {
    saveBtn.textContent = "Save";
  }

  if (deleteBtn) {
    deleteBtn.classList.add("hidden");
  }

  document.body.style.overflow = "";
}

function populateStatusForm(item) {
  const idInput = document.getElementById("status-id");
  const nameInput = document.getElementById("status-name");
  const detailsInput = document.getElementById("status-details");
  const durationTurnsInput = document.getElementById("status-duration-turns");
  const typeInputs = document.querySelectorAll('input[name="status-type"]');
  const durationKindInputs = document.querySelectorAll('input[name="status-duration-kind"]');
  const durationModeInputs = document.querySelectorAll('input[name="status-duration-mode"]');

  if (!nameInput) return;

  if (!item) {
    if (idInput) idInput.value = "";
    nameInput.value = "";
    if (detailsInput) detailsInput.value = "";
    if (durationTurnsInput) durationTurnsInput.value = "1";
    typeInputs.forEach((input) => {
      input.checked = input.value === "buff";
    });
    durationKindInputs.forEach((input) => {
      input.checked = input.value === "permanent";
    });
    durationModeInputs.forEach((input) => {
      input.checked = input.value === "turns";
    });
    updateStatusDurationFormVisibility();
    return;
  }

  if (idInput) idInput.value = item.id;
  nameInput.value = item.name || "";
  if (detailsInput) detailsInput.value = item.details || "";
  const normalized = normalizeStatusItem(item);
  if (durationTurnsInput) durationTurnsInput.value = normalized.durationTurns ?? 1;
  typeInputs.forEach((input) => {
    input.checked = input.value === normalized.type;
  });
  durationKindInputs.forEach((input) => {
    input.checked = input.value === normalized.durationKind;
  });
  durationModeInputs.forEach((input) => {
    input.checked = input.value === normalized.durationMode;
  });
  updateStatusDurationFormVisibility();
}

function onStatusSubmit(event) {
  event.preventDefault();

  const idInput = document.getElementById("status-id");
  const nameInput = document.getElementById("status-name");
  const detailsInput = document.getElementById("status-details");
  const selectedType = document.querySelector('input[name="status-type"]:checked');
  const selectedDurationKind = document.querySelector('input[name="status-duration-kind"]:checked');
  const selectedDurationMode = document.querySelector('input[name="status-duration-mode"]:checked');
  const durationTurnsInput = document.getElementById("status-duration-turns");

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter a buff or debuff name.");
    return;
  }

  let durationTurns = parseInt(durationTurnsInput?.value || "0", 10);
  if (Number.isNaN(durationTurns) || durationTurns < 0) durationTurns = 0;
  const durationKind = selectedDurationKind?.value === "temporary" ? "temporary" : "permanent";
  const durationMode = selectedDurationMode?.value === "skill-check" ? "skill-check" : "turns";

  const existingId = idInput?.value || "";
  const payload = {
    id: existingId || `status-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    details: detailsInput?.value.trim() || "",
    duration: durationTurns,
    durationKind,
    durationMode,
    durationTurns,
    showOnBasic: true,
    type: normalizeStatusType(selectedType?.value || "buff")
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
  if (!confirmRemove("Remove this status?")) return false;
  sheetState.statuses = sheetState.statuses.filter((item) => item.id !== id);
  saveSheetStateToStorage();
  renderStatusList();
  return true;
}

function onStatusModalDelete() {
  const idInput = document.getElementById("status-id");
  const id = idInput?.value || "";
  if (!id) return;

  if (removeStatus(id)) {
    closeStatusModal();
  }
}

function updateStatusDuration(id, value) {
  const item = sheetState.statuses.find((entry) => entry.id === id);
  if (!item) return;

  let duration = parseInt(value ?? "0", 10);
  if (Number.isNaN(duration) || duration < 0) duration = 0;

  item.duration = duration;
  item.durationTurns = duration;
  saveSheetStateToStorage();
}

function renderStatusList() {
  const list = document.getElementById("status-list");
  renderBasicStatusTags();
  if (!list) return;

  if (!Array.isArray(sheetState.statuses) || sheetState.statuses.length === 0) {
    list.innerHTML = `
      <div class="status-column status-column-buff">
        <p class="equipment-empty">No buffs yet.</p>
      </div>
      <div class="status-column status-column-debuff">
        <p class="equipment-empty">No debuffs yet.</p>
      </div>
    `;
    return;
  }

  const normalizedStatuses = sheetState.statuses.map(normalizeStatusItem);
  const buffs = normalizedStatuses.filter((item) => item.type === "buff");
  const debuffs = normalizedStatuses.filter((item) => item.type !== "buff");

  function renderStatusColumn(kind, items, emptyText) {
    return `
      <div class="status-column status-column-${kind}">
        ${items.length
          ? items.map(renderStatusCard).join("")
          : `<p class="equipment-empty">${emptyText}</p>`}
      </div>
    `;
  }

  list.innerHTML = [
    renderStatusColumn("buff", buffs, "No buffs yet."),
    renderStatusColumn("debuff", debuffs, "No debuffs yet.")
  ].join("");
}

function renderBasicStatusTags() {
  const container = document.getElementById("basic-status-tags");
  if (!container) return;

  const visibleStatuses = Array.isArray(sheetState.statuses)
    ? sheetState.statuses.map(normalizeStatusItem)
    : [];

  if (visibleStatuses.length === 0) {
    container.innerHTML = `<span class="basic-status-empty">No status tags.</span>`;
    return;
  }

  container.innerHTML = visibleStatuses.map(renderBasicStatusTag).join("");
}

function renderBasicStatusTag(item) {
  const tooltip = getStatusTooltipText(item);
  const kind = item.type === "buff" ? "buff" : "debuff";
  const turnBadge = item.durationKind === "temporary" && item.durationMode !== "skill-check"
    ? `<span class="basic-status-turns">${escapeHtml(item.durationTurns || 0)} turn(s)</span>`
    : "";
  return `
    <button
      type="button"
      class="basic-status-tag basic-status-tag-${kind}"
      data-basic-status-id="${escapeHtml(item.id || "")}"
      data-tooltip="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(`Edit ${item.name || "status"}`)}"
    >
      <span>${escapeHtml(item.name || "Status")}</span>
      ${turnBadge}
    </button>
  `;
}

function renderStatusCard(item) {
  return `
      <div class="status-item status-item-${item.type === "buff" ? "buff" : "debuff"}">
        <div class="equipment-item-info">
          <span class="equipment-name">${escapeHtml(item.name || "")}</span>
          <div class="status-preview">
            <span class="dependency-chip">${escapeHtml(getStatusTypeLabel(item.type))}</span>
            <span>${escapeHtml(getStatusDurationText(item))}</span>
          </div>
        </div>
        <div class="status-item-actions">
          <button type="button" class="icon-action-btn" data-status-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name || "status")}">✎</button>
          <button type="button" class="icon-action-btn equipment-remove-btn" data-status-action="remove" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.name || "status")}">⌫</button>
        </div>
      </div>
    `;
}

function normalizeStatusType(type) {
  if (type === "debuff") return "flaw";
  if (["buff", "injuries", "flaw", "psychiatric"].includes(type)) return type;
  return "buff";
}

function normalizeStatusItem(item) {
  const type = normalizeStatusType(item?.type || "buff");
  const duration = parseInt(item?.durationTurns ?? item?.duration ?? "0", 10);
  const durationTurns = Number.isNaN(duration) || duration < 0 ? 0 : duration;
  const hasLegacyTurns = item?.durationKind == null && durationTurns > 0;
  const durationKind = item?.durationKind === "temporary" || hasLegacyTurns ? "temporary" : "permanent";
  const durationMode = item?.durationMode === "skill-check" ? "skill-check" : "turns";
  return {
    ...item,
    type,
    durationKind,
    durationMode,
    durationTurns,
    duration: durationTurns,
    showOnBasic: true
  };
}

function getStatusTypeLabel(type) {
  const labels = {
    buff: "Buff",
    injuries: "Injuries & Disorders",
    flaw: "Flaw",
    psychiatric: "Psychiatric Disorder"
  };
  return labels[normalizeStatusType(type)] || "Buff";
}

function getStatusDurationText(item) {
  if (item.durationKind !== "temporary") return "Permanent";
  if (item.durationMode === "skill-check") return "Until skill check passes";
  return `${item.durationTurns || 0} turn(s)`;
}

function getStatusTooltipText(item) {
  const details = item.details ? `\n${item.details}` : "";
  return `${getStatusTypeLabel(item.type)}\n${getStatusDurationText(item)}${details}\nClick to edit`;
}

function updateStatusDurationFormVisibility() {
  const selectedDurationKind = document.querySelector('input[name="status-duration-kind"]:checked');
  const selectedDurationMode = document.querySelector('input[name="status-duration-mode"]:checked');
  const temporaryOptions = document.getElementById("status-temporary-options");
  const turnsField = document.querySelector(".status-turns-field");
  const isTemporary = selectedDurationKind?.value === "temporary";
  const usesTurns = selectedDurationMode?.value !== "skill-check";

  if (temporaryOptions) temporaryOptions.classList.toggle("hidden", !isTemporary);
  if (turnsField) turnsField.classList.toggle("hidden", !isTemporary || !usesTurns);
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

  // FIX: Ensure form exists before adding listener
  if (form) {
    form.addEventListener("submit", onItemSubmit);
  }

  list.addEventListener("click", (event) => {
  const actionBtn = event.target.closest("button[data-item-action]");
  if (!actionBtn) return;

  event.preventDefault(); // 🔥 important

  const id = actionBtn.dataset.id;
  if (!id) return;

  const action = actionBtn.dataset.itemAction;

  if (action === "edit") {
    const item = sheetState.items.find((entry) => entry.id === id);
    if (item) openItemModal(item);
    return;
  }

  if (action === "remove") {
    if (!confirm("Remove this item?")) return;

    sheetState.items = sheetState.items.filter((item) => item.id !== id);

    renderItemList();
    saveSheetStateToStorage();
    return;
  }
});

  list.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-item-amount-id]");
    if (!input) return;

    updateItemAmount(input.dataset.itemAmountId, input.value);
  });

  list.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-item-amount-id]");
    if (!input) return;

    updateItemAmount(input.dataset.itemAmountId, input.value);
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
    nameInput.focus();
    return;
  }

  let amount = parseInt(amountInput?.value || "1", 10);
  if (Number.isNaN(amount) || amount < 0) amount = 1;

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

function renderItemList() {
  const list = document.getElementById("item-list");
  if (!list) return;

  if (!Array.isArray(sheetState.items) || sheetState.items.length === 0) {
    list.innerHTML = '<p class="equipment-empty">No items yet.</p>';
    return;
  }

  list.innerHTML = sheetState.items
    .map((item) => {
      const tooltip = getItemTooltipText(item);
      return `
      <div class="item-card" data-tooltip="${escapeHtml(tooltip)}" tabindex="0">
        <div class="item-main">
          <div class="equipment-item-info">
            <span class="equipment-name">${escapeHtml(item.name || "")}</span>
            <div class="item-amount-row">
              <span class="item-amount-label">Amount</span>
              <span class="item-amount-control">
                <input
                  type="number"
                  min="0"
                  value="${escapeHtml(String(item.amount ?? 1))}"
                  class="item-amount-input"
                  data-item-amount-id="${escapeHtml(item.id)}"
                  aria-label="Amount for ${escapeHtml(item.name || "item")}"
                >
              </span>
              <div class="item-inline-actions">
                <button type="button" class="icon-action-btn item-inline-btn" data-item-action="edit" data-id="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.name || "item")}">✎</button>
                <button type="button" class="icon-action-btn equipment-remove-btn item-inline-btn" data-item-action="remove" data-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name || "item")}">⌫</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function getItemTooltipText(item) {
  const amount = item?.amount ?? 0;
  const details = item?.details ? `\n${item.details}` : "\nNo details.";
  return `${item?.name || "Item"}\nAmount: ${amount}${details}`;
}

function normalizeSavedNote(note) {
  if (typeof note === "string") return note;
  if (note && typeof note === "object" && typeof note.content === "string") {
    return note.content;
  }
  return "";
}

function setupNotes() {
  const closeBtn = document.getElementById("close-note-modal");
  const cancelBtn = document.getElementById("cancel-note-btn");
  const backdrop = document.getElementById("note-modal-backdrop");
  const form = document.getElementById("note-form");
  const card = document.getElementById("note-card");

  if (!form || !card) return;

  if (closeBtn) {
    closeBtn.addEventListener("click", closeNoteModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeNoteModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeNoteModal);
  }

  form.addEventListener("submit", onNoteSubmit);

  card.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("button[data-note-action]");
    if (!actionBtn) return;

    const action = actionBtn.dataset.noteAction;
    if (action === "view") {
      openNoteModal("view");
      return;
    }
    if (action === "edit") {
      openNoteModal("edit");
      return;
    }
    if (action === "remove") {
      removeNote();
    }
  });

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("note-modal");
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeNoteModal();
    }
  });

  renderNotePanel();
}

function openNoteModal(mode = "edit") {
  const modal = document.getElementById("note-modal");
  const title = document.getElementById("note-modal-title");
  const textarea = document.getElementById("note-content");
  const saveBtn = document.getElementById("save-note-btn");
  const form = document.getElementById("note-form");

  if (!modal || !textarea || !form) return;

  const hasNote = !!normalizeSavedNote(sheetState.note).trim();
  const isView = mode === "view";

  textarea.value = normalizeSavedNote(sheetState.note);
  textarea.readOnly = isView;
  form.dataset.noteMode = mode;

  if (title) {
    title.textContent = isView ? "View Note" : hasNote ? "Edit Note" : "Add Note";
  }
  if (saveBtn) {
    saveBtn.classList.toggle("hidden", isView);
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (!isView) {
    setTimeout(() => textarea.focus(), 0);
  }
}

function closeNoteModal() {
  const modal = document.getElementById("note-modal");
  const form = document.getElementById("note-form");
  const textarea = document.getElementById("note-content");
  const title = document.getElementById("note-modal-title");
  const saveBtn = document.getElementById("save-note-btn");

  if (modal) {
    modal.classList.add("hidden");
  }
  if (textarea) {
    textarea.value = "";
    textarea.readOnly = false;
  }
  if (form) {
    form.dataset.noteMode = "edit";
  }
  if (title) {
    title.textContent = "Add Note";
  }
  if (saveBtn) {
    saveBtn.classList.remove("hidden");
  }

  document.body.style.overflow = "";
}

function onNoteSubmit(event) {
  event.preventDefault();

  const textarea = document.getElementById("note-content");
  if (!textarea) return;

  sheetState.note = textarea.value.trim();
  saveSheetStateToStorage();
  renderNotePanel();
  closeNoteModal();
}

function removeNote() {
  if (!confirmRemove("Delete this note?")) return false;
  sheetState.note = "";
  saveSheetStateToStorage();
  renderNotePanel();
  return true;
}

function renderNotePanel() {
  const card = document.getElementById("note-card");
  if (!card) return;

  const note = normalizeSavedNote(sheetState.note).trim();

  if (!note) {
    card.innerHTML = '<button type="button" class="equipment-empty note-empty-button" data-note-action="edit">No note yet. Click to add note.</button>';
    return;
  }

  const preview = note.length > 320 ? `${note.slice(0, 320)}...` : note;
  card.innerHTML = `
    <div class="note-preview-card">
      <p class="note-preview-text">${escapeHtml(preview)}</p>
      <div class="note-actions" aria-label="Note actions">
        <button type="button" class="note-action-btn" data-note-action="view">View</button>
        <button type="button" class="note-action-btn" data-note-action="edit">Edit</button>
        <button type="button" class="note-action-btn equipment-remove-btn" data-note-action="remove">Delete</button>
      </div>
    </div>
  `;
}

function setupExtraSkills() {
  const openBtn = document.getElementById("open-extra-skill-modal");
  const closeBtn = document.getElementById("close-extra-skill-modal");
  const cancelBtn = document.getElementById("cancel-extra-skill-btn");
  const backdrop = document.getElementById("extra-skill-modal-backdrop");
  const form = document.getElementById("extra-skill-form");
  const list = document.getElementById("extra-skill-list");
  const openDependencyBtn = document.getElementById("open-extra-skill-dependency-modal");
  const closeDependencyBtn = document.getElementById("close-extra-skill-dependency-modal");
  const cancelDependencyBtn = document.getElementById("cancel-extra-skill-dependency-btn");
  const saveDependencyBtn = document.getElementById("save-extra-skill-dependency-btn");
  const dependencyBackdrop = document.getElementById("extra-skill-dependency-modal-backdrop");

  if (!list || !form) return;

  setupExtraSkillPointsBox();

  if (openBtn) {
    openBtn.addEventListener("click", () => openExtraSkillModal());
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeExtraSkillModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeExtraSkillModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeExtraSkillModal);
  }

  if (openDependencyBtn) {
    openDependencyBtn.addEventListener("click", openExtraSkillDependencyModal);
  }

  if (closeDependencyBtn) {
    closeDependencyBtn.addEventListener("click", closeExtraSkillDependencyModal);
  }

  if (cancelDependencyBtn) {
    cancelDependencyBtn.addEventListener("click", closeExtraSkillDependencyModal);
  }

  if (saveDependencyBtn) {
    saveDependencyBtn.addEventListener("click", saveExtraSkillDependenciesFromModal);
  }

  if (dependencyBackdrop) {
    dependencyBackdrop.addEventListener("click", closeExtraSkillDependencyModal);
  }

  form.addEventListener("submit", onExtraSkillSubmit);
  setupExtraSkillPointDots();
  list.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("button[data-extra-skill-action]");
    if (!actionBtn) return;

    const id = actionBtn.dataset.id;
    if (!id) return;

    const item = sheetState.extraSkills.find((entry) => entry.id === id);
    if (!item) return;

    if (actionBtn.dataset.extraSkillAction === "edit") {
      openExtraSkillModal(item);
      return;
    }

    if (actionBtn.dataset.extraSkillAction === "remove") {
      removeExtraSkill(id);
      return;
    }

    if (actionBtn.dataset.extraSkillAction === "roll") {
      rollExtraSkill(item);
    }
  });

  list.addEventListener("click", (event) => {
    const dot = event.target.closest(".extra-skill-card-dot");
    if (!dot) return;

    const id = dot.dataset.extraSkillId;
    const level = parseInt(dot.dataset.index || "0", 10);
    if (!id || Number.isNaN(level)) return;

    updateExtraSkillLevel(id, level);
  });

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("extra-skill-modal");
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeExtraSkillModal();
    }

    const dependencyModal = document.getElementById("extra-skill-dependency-modal");
    if (event.key === "Escape" && dependencyModal && !dependencyModal.classList.contains("hidden")) {
      closeExtraSkillDependencyModal();
    }
  });

  renderExtraSkillList();
  updateExtraSkillRemainingDisplay();

  setupExtraSkillPointsBox(
  document.getElementById("extra-skill-points-box")
);
}

function openExtraSkillModal(item = null) {
  const modal = document.getElementById("extra-skill-modal");
  const title = document.getElementById("extra-skill-modal-title");
  const saveBtn = document.getElementById("save-extra-skill-btn");
  if (!modal) return;

  populateExtraSkillForm(item);
  if (title) title.textContent = item ? "Edit Extra Skill" : "Add Extra Skill";
  if (saveBtn) saveBtn.textContent = item ? "Save" : "Add";

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeExtraSkillModal() {
  const modal = document.getElementById("extra-skill-modal");
  const dependencyModal = document.getElementById("extra-skill-dependency-modal");
  const form = document.getElementById("extra-skill-form");
  const title = document.getElementById("extra-skill-modal-title");
  const saveBtn = document.getElementById("save-extra-skill-btn");
  const idInput = document.getElementById("extra-skill-id");

  if (modal) modal.classList.add("hidden");
  if (dependencyModal) dependencyModal.classList.add("hidden");
  if (form) form.reset();
  if (idInput) idInput.value = "";
  if (title) title.textContent = "Add Extra Skill";
  if (saveBtn) saveBtn.textContent = "Add";

  extraSkillDependencySelection = [];
  extraSkillPointsSelection = 0;
  renderExtraSkillPointDots();
  renderExtraSkillDependencyList();
  document.body.style.overflow = "";
}

function setupExtraSkillPointDots() {
  const dots = document.querySelectorAll("#extra-skill-points-dots .extra-skill-dot");
  dots.forEach((dot, i) => {
    const idx = parseInt(dot.dataset.index || String(i + 1), 10);
    dot.addEventListener("click", () => {
      const idInput = document.getElementById("extra-skill-id");
      const existingId = idInput?.value || "";
      const maxSelectable = Math.min(6, getRemainingExtraSkillPoints(existingId));
      let nextValue = extraSkillPointsSelection === idx ? idx - 1 : idx;
      if (nextValue < 0) nextValue = 0;
      if (nextValue > 6) nextValue = 6;
      if (nextValue > maxSelectable) {
        alert("Not enough remaining Extra Skill points.");
        return;
      }
      extraSkillPointsSelection = nextValue;
      renderExtraSkillPointDots();
    });
  });
  renderExtraSkillPointDots();
}

function renderExtraSkillPointDots() {
  const dots = document.querySelectorAll("#extra-skill-points-dots .extra-skill-dot");
  dots.forEach((dot) => {
    const idx = parseInt(dot.dataset.index || "0", 10);
    if (idx <= extraSkillPointsSelection) dot.classList.add("active");
    else dot.classList.remove("active");
  });
}

function getSpentExtraSkillPoints(excludeId = "") {
  return Array.isArray(sheetState.extraSkills)
    ? sheetState.extraSkills.reduce((total, item) => {
        if (excludeId && item.id === excludeId) return total;
        const points = parseInt(item.points || "0", 10);
        return total + (Number.isNaN(points) || points < 0 ? 0 : points);
      }, 0)
    : 0;
}

function getRemainingExtraSkillPoints(excludeId = "") {
  return Math.max(0, getExtraSkillMaxPoints() - getSpentExtraSkillPoints(excludeId));
}

function updateExtraSkillRemainingDisplay() {
  const remainingOutput = document.getElementById("extra-skill-remaining-points");
  const maxOutput = document.getElementById("extra-skill-max-points");
  if (remainingOutput) remainingOutput.textContent = String(getRemainingExtraSkillPoints());
  if (maxOutput) maxOutput.textContent = String(getExtraSkillMaxPoints());
}

function getExtraSkillMaxPoints() {
  const raw = sheetState.globals?.[EXTRA_SKILL_MAX_POINTS_KEY];
  const parsed = parseInt(raw ?? EXTRA_SKILL_STARTING_POINTS, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : EXTRA_SKILL_STARTING_POINTS;
}

function setupExtraSkillPointsBox(box) {
  if (!box) return;

  const editBtn = box.querySelector(".attribute-points-edit");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    // 🔥 calculate spent points
    const spent = Array.isArray(sheetState.extraSkills)
      ? sheetState.extraSkills.reduce((total, skill) => {
          const value = parseInt(skill.points ?? "0", 10);
          return total + (Number.isFinite(value) ? value : 0);
        }, 0)
      : 0;

    // 🔥 get current max
    const raw = sheetState.globals?.[EXTRA_SKILL_MAX_POINTS_KEY];
    const currentMax = parseInt(raw ?? EXTRA_SKILL_STARTING_POINTS, 10);

    // 🔥 prompt user
    const next = prompt("Set maximum Extra Skill points:", String(currentMax));
    if (next == null) return;

    const parsed = parseInt(next, 10);

    // 🔥 validation
    if (!Number.isFinite(parsed) || parsed < spent) {
      alert(`Maximum Extra Skill points cannot be lower than points already spent (${spent}).`);
      return;
    }

    // 🔥 save new max
    sheetState.globals[EXTRA_SKILL_MAX_POINTS_KEY] = String(parsed);

    // 🔥 update UI immediately
    const remaining = Math.max(0, parsed - spent);

    const remainingEl = document.getElementById("extra-skill-remaining-points");
    const maxEl = document.getElementById("extra-skill-max-points");

    if (remainingEl) remainingEl.textContent = String(remaining);
    if (maxEl) maxEl.textContent = String(parsed);

    saveSheetStateToStorage();
  });
}

function populateExtraSkillForm(item) {
  const idInput = document.getElementById("extra-skill-id");
  const nameInput = document.getElementById("extra-skill-name");
  const levelInput = document.getElementById("extra-skill-level-input");
  const detailsInput = document.getElementById("extra-skill-details");
  const professionInput = document.getElementById("extra-skill-profession");

  if (!nameInput) return;

  if (!item) {
    if (idInput) idInput.value = "";
    nameInput.value = "";
    if (levelInput) levelInput.value = "0";
    if (detailsInput) detailsInput.value = "";
    if (professionInput) professionInput.checked = false;
    extraSkillDependencySelection = [];
    extraSkillPointsSelection = 0;
    renderExtraSkillPointDots();
    renderExtraSkillDependencyList();
    return;
  }

  if (idInput) idInput.value = item.id;
  nameInput.value = item.name || "";
  if (levelInput) levelInput.value = item.level ?? 0;
  if (detailsInput) detailsInput.value = item.details || "";
  if (professionInput) professionInput.checked = !!item.profession;
  extraSkillDependencySelection = Array.isArray(item.dependencies) ? [...item.dependencies] : [];
  extraSkillPointsSelection = item.points || 0;
  renderExtraSkillPointDots();
  renderExtraSkillDependencyList();
}

function renderExtraSkillDependencyList() {
  const container = document.getElementById("extra-skill-dependency-list");
  if (!container) return;

  if (!extraSkillDependencySelection.length) {
    container.innerHTML = '<p class="equipment-empty equipment-empty-inline">No related stat(s) selected.</p>';
    return;
  }

  container.innerHTML = extraSkillDependencySelection
    .map((id) => statOptions.find((option) => option.id === id))
    .filter(Boolean)
    .map((option) => `<span class="dependency-chip">${escapeHtml(option.label)}</span>`)
    .join("");
}

function openExtraSkillDependencyModal() {
  const modal = document.getElementById("extra-skill-dependency-modal");
  const container = document.getElementById("extra-skill-dependency-options");
  if (!modal || !container) return;

  const attrs = statOptions.filter((option) => option.role === "attr");
  const skills = statOptions.filter((option) => option.role === "skill");

  container.innerHTML = `
    <div class="dependency-group">
      <h3>Attributes</h3>
      <div class="dependency-grid">
        ${attrs.map((option) => `
          <label class="dependency-option">
            <input type="checkbox" value="${option.id}" ${extraSkillDependencySelection.includes(option.id) ? "checked" : ""}>
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
    <div class="dependency-group">
      <h3>General Ability</h3>
      <div class="dependency-grid">
        ${skills.map((option) => `
          <label class="dependency-option">
            <input type="checkbox" value="${option.id}" ${extraSkillDependencySelection.includes(option.id) ? "checked" : ""}>
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeExtraSkillDependencyModal() {
  const modal = document.getElementById("extra-skill-dependency-modal");
  const extraSkillModal = document.getElementById("extra-skill-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  document.body.style.overflow =
    extraSkillModal && !extraSkillModal.classList.contains("hidden") ? "hidden" : "";
}

function saveExtraSkillDependenciesFromModal() {
  const container = document.getElementById("extra-skill-dependency-options");
  if (!container) return;

  extraSkillDependencySelection = Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked')
  ).map((input) => input.value);

  renderExtraSkillDependencyList();
  closeExtraSkillDependencyModal();
}

function onExtraSkillSubmit(event) {
  event.preventDefault();

  const idInput = document.getElementById("extra-skill-id");
  const nameInput = document.getElementById("extra-skill-name");
  const levelInput = document.getElementById("extra-skill-level-input");
  const detailsInput = document.getElementById("extra-skill-details");
  const professionInput = document.getElementById("extra-skill-profession");

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter an extra skill name.");
    return;
  }

  let level = parseInt(levelInput?.value || "0", 10);
  if (Number.isNaN(level) || level < 0) level = 0;
  if (level > 6) level = 6;

  const existingId = idInput?.value || "";
  if (extraSkillPointsSelection > getRemainingExtraSkillPoints(existingId)) {
    alert("Not enough remaining Extra Skill points.");
    return;
  }

  const payload = {
    id: existingId || `extra-skill-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    level,
    points: extraSkillPointsSelection,
    details: detailsInput?.value.trim() || "",
    dependencies: [...extraSkillDependencySelection],
    profession: !!professionInput?.checked
  };

  const existingIndex = sheetState.extraSkills.findIndex((item) => item.id === payload.id);
  if (existingIndex >= 0) {
    sheetState.extraSkills[existingIndex] = payload;
  } else {
    sheetState.extraSkills.unshift(payload);
  }

  saveSheetStateToStorage();
  renderExtraSkillList();
  updateExtraSkillRemainingDisplay();
  closeExtraSkillModal();
}

function updateExtraSkillLevel(id, clickedLevel) {
  const item = sheetState.extraSkills.find((entry) => entry.id === id);
  if (!item) return;

  let nextPoints = item.points === clickedLevel ? clickedLevel - 1 : clickedLevel;
  if (nextPoints < 0) nextPoints = 0;
  if (nextPoints > 6) nextPoints = 6;
  const currentPoints = item.points || 0;
  const delta = nextPoints - currentPoints;
  if (delta > getRemainingExtraSkillPoints()) {
    alert("Not enough remaining Extra Skill points.");
    return;
  }

  item.points = nextPoints;
  saveSheetStateToStorage();
  renderExtraSkillList();
  updateExtraSkillRemainingDisplay();
}

function removeExtraSkill(id) {
  if (!confirmRemove("Remove this extra skill?")) return false;
  sheetState.extraSkills = sheetState.extraSkills.filter((item) => item.id !== id);
  saveSheetStateToStorage();
  renderExtraSkillList();
  updateExtraSkillRemainingDisplay();
  return true;
}

function rollExtraSkill(item) {
  const ownLevel = item.points || 0;
  const dependencyDice = getDependencyRollDice(item.dependencies);
  const totalDice = ownLevel + dependencyDice;
  if (totalDice <= 0) {
    alert("This extra skill has no dice yet. Increase its level or add related stat(s) with points.");
    return;
  }

  const specialInput = document.getElementById("special");
  const successInput = document.getElementById("success");
  const penaltyInput = document.getElementById("penalty");
  let globalSuccess = parseInt(successInput?.value || "0", 10);
  if (Number.isNaN(globalSuccess) || globalSuccess < 0) globalSuccess = 0;

  openSheetRollModal({
    label: item.name || "Extra Skill Roll",
    detail: "Extra Skill",
    total: totalDice,
    specialStr: specialInput?.value || "",
    success: globalSuccess + getDependencySuccessBonus(item.dependencies) + (item.profession ? 1 : 0),
    penalty: penaltyInput?.value || "0"
  });
}

function renderExtraSkillList() {
  const list = document.getElementById("extra-skill-list");
  if (!list) return;

  if (!Array.isArray(sheetState.extraSkills) || sheetState.extraSkills.length === 0) {
    list.innerHTML = '<p class="equipment-empty">No extra skills yet.</p>';
    updateExtraSkillRemainingDisplay();
    return;
  }

  list.innerHTML = sheetState.extraSkills
    .map((item) => {
      const tooltip = getExtraSkillTooltipText(item);
      return `
      <div class="extra-skill-card" data-tooltip="${escapeHtml(tooltip)}" tabindex="0">
        <div class="equipment-item-info">
          <span class="equipment-name">${escapeHtml(item.name || "")}</span>
          <div class="extra-skill-meta-row">
            <div class="extra-skill-level-display">LV. ${escapeHtml(String(item.level ?? 0))}</div>
            ${item.profession ? '<div class="extra-skill-profession-badge">PRO</div>' : ""}
          </div>
          <div class="extra-skill-dots">
            ${Array.from({ length: 6 }, (_, index) => {
              const dotIndex = index + 1;
              return `<button type="button" class="stat-dot extra-skill-card-dot ${dotIndex <= (item.points || 0) ? "active" : ""}" data-extra-skill-id="${item.id}" data-index="${dotIndex}"></button>`;
            }).join("")}
          </div>
          <div class="equipment-preview equipment-dependency-preview">
            ${Array.isArray(item.dependencies) && item.dependencies.length
              ? item.dependencies
                  .map((id) => statOptions.find((option) => option.id === id))
                  .filter(Boolean)
                  .map((option) => `<span class="dependency-chip">${escapeHtml(option.label)}</span>`)
                  .join("")
              : '<span class="equipment-dependency-empty">No related stat(s)</span>'}
          </div>
        </div>
        <div class="extra-skill-actions">
          <button type="button" class="equipment-roll-btn" data-extra-skill-action="roll" data-id="${item.id}">Roll</button>
          <button type="button" class="icon-action-btn" data-extra-skill-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name || "extra skill")}">✎</button>
          <button type="button" class="icon-action-btn equipment-remove-btn" data-extra-skill-action="remove" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.name || "extra skill")}">⌫</button>
        </div>
      </div>
    `;
    })
    .join("");
  updateExtraSkillRemainingDisplay();
}

function getExtraSkillTooltipText(item) {
  const dependencies = Array.isArray(item?.dependencies) && item.dependencies.length
    ? item.dependencies
        .map((id) => statOptions.find((option) => option.id === id)?.label)
        .filter(Boolean)
        .join(", ")
    : "No related stat(s)";
  const details = item?.details ? `\n${item.details}` : "\nNo details.";
  return `${item?.name || "Extra Skill"}\nLV. ${item?.level ?? 0} / Points: ${item?.points || 0}\n${dependencies}${details}`;
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

  if (kind === "custom" && Array.isArray(config.faces)) {
    const customFaces = config.faces.slice(0, 6).map((face) => {
      if (face === "1" || face === "R" || face === "+" || face === "-") return face;
      return "";
    });
    while (customFaces.length < 6) customFaces.push("");
    customFaces[0] = "1";
    customFaces[5] = "R";
    return customFaces;
  }

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

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) throw new Error("Expected an array");

      return parsed.map((entry) => {
        if (entry?.kind === "custom" && Array.isArray(entry.faces)) {
          return { kind: "custom", faces: buildDieFaces(entry) };
        }
        if (entry?.kind === "adv") {
          return { kind: "adv", plusCount: entry.plusCount };
        }
        if (entry?.kind === "neg") {
          return { kind: "neg", minusCount: entry.minusCount };
        }
        return { kind: "normal" };
      });
    } catch (error) {
      alert("Invalid special dice data. Please remove and add the special dice again.");
      throw new Error("Invalid special dice JSON");
    }
  }

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

function formatSpecialDiceText(str) {
  const trimmed = (str || "").trim();
  if (!trimmed) return "";

  if (!trimmed.startsWith("[")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return "";
    return parsed
      .map((entry, index) => {
        const faces = buildDieFaces(entry);
        const faceText = faces.map((face, faceIndex) => getSpecialFaceDisplay(face, faceIndex) || "_").join("");
        return `Die ${index + 1}: ${faceText}`;
      })
      .join(" / ");
  } catch (error) {
    return "Custom dice";
  }
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
          <span>Succeed/Pen: +${entry.success} / -${entry.penalty}</span>
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = html;
}

// ---------- core roll executor (used by form + stats) ----------

function performRoll({ total, specialStr, success = 0, penalty = 0, equipmentDmg = null, ignoreMentalPenalty = false }) {
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

  const mentalPenaltyFaces = ignoreMentalPenalty ? 0 : getMentalPenaltyFaces();
  if (mentalPenaltyFaces > 0) {
    specialConfigs.push({ kind: "neg", minusCount: mentalPenaltyFaces });
  }

  if (specialConfigs.length > totalNum) {
    alert("Number of special dice plus Mental penalty die cannot be more than Total dice.");
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

  const equipmentDmgSummary = document.getElementById("equipment-dmg-summary");
  const equipmentTotalDmg = document.getElementById("equipment-total-dmg");
  let parsedEquipmentDmg = parseInt(equipmentDmg ?? "", 10);
  if (Number.isNaN(parsedEquipmentDmg) || parsedEquipmentDmg < 0) {
    parsedEquipmentDmg = null;
  }

  if (equipmentDmgSummary && equipmentTotalDmg) {
    if (parsedEquipmentDmg != null) {
      equipmentDmgSummary.classList.remove("hidden");
      equipmentTotalDmg.textContent = finalTotal * parsedEquipmentDmg;
    } else {
      equipmentDmgSummary.classList.add("hidden");
      equipmentTotalDmg.textContent = "0";
    }
  }

  if (openResultModalBtn) {
    openResultModalBtn.classList.remove("hidden");
  }

  openResultModal();

  // ---- Add to history ----
  const entry = {
    time: Date.now(),
    totalDice: totalNum,
    special: [
      formatSpecialDiceText(specialStr),
      mentalPenaltyFaces ? `Mental penalty: n${mentalPenaltyFaces}` : ""
    ].filter(Boolean).join(" / "),
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

function applyMentalHeartsToUI() {
  const hearts = document.querySelectorAll(".mental-heart");
  if (!hearts.length) return;

  const mentalMax = getMentalMax();
  const heartState = getNormalizedHeartState();
  const mentalMaxInput = document.getElementById("mental-max");

  if (mentalMaxInput) {
    mentalMaxInput.value = String(mentalMax);
  }

  hearts.forEach((btn, idx) => {
    const isVisible = idx < mentalMax;
    const on = heartState[idx] !== false;
    btn.classList.toggle("hidden", !isVisible);
    btn.classList.remove("on", "off");
    btn.classList.add(on ? "on" : "off");
    btn.setAttribute("aria-label", `Mental heart ${idx + 1}`);
    btn.setAttribute("aria-pressed", on.toString());
  });

  updateMentalSummary();
}

function updateMentalSummary() {
  const current = document.getElementById("mental-current");
  if (!current) return;

  const visibleHearts = Array.from(document.querySelectorAll(".mental-heart"))
    .filter((btn) => !btn.classList.contains("hidden"));
  const visibleValue = visibleHearts.length
    ? visibleHearts.filter((btn) => !btn.classList.contains("off")).length
    : getCurrentMentalValue();
  current.textContent = String(visibleValue);
}

function setupMentalHearts() {
  const hearts = document.querySelectorAll(".mental-heart");
  if (!hearts.length) return;
  const mentalMaxInput = document.getElementById("mental-max");

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

      const heartElements = document.querySelectorAll(".mental-heart");
      heartElements.forEach((heart, index) => {
        // ✅ TRUE = has mental (on), FALSE = lost (off)
        sheetState.hearts[index] = !heart.classList.contains("off");
      });
      btn.setAttribute("aria-pressed", btn.classList.contains("on").toString());
      updateMentalSummary();
      saveSheetStateToStorage();
    });
  });

  if (mentalMaxInput) {
    mentalMaxInput.addEventListener("input", () => {
      let nextMax = parseInt(mentalMaxInput.value || String(DEFAULT_HEART_COUNT), 10);
      if (Number.isNaN(nextMax)) nextMax = DEFAULT_HEART_COUNT;
      nextMax = Math.max(1, Math.min(MAX_HEART_COUNT, nextMax));
      mentalMaxInput.value = String(nextMax);
      sheetState.globals[MENTAL_MAX_KEY] = String(nextMax);
      sheetState.hearts = getNormalizedHeartState();
      applyMentalHeartsToUI();
      saveSheetStateToStorage();
    });
  }

  applyMentalHeartsToUI();
}

// ---------- Character sheet: stats (attributes + skills) ----------

function setupStats() {
  const statRows = document.querySelectorAll(".stat-row");
  if (!statRows.length) return;

  statRows.forEach((row) => {
    const bonusCheckbox = row.querySelector(".stat-succeed");
    const successKey = getStatSuccessKey(row);
    if (bonusCheckbox && successKey) {
      bonusCheckbox.checked = !!sheetState.successChecks[successKey];
      bonusCheckbox.addEventListener("change", () => {
        sheetState.successChecks[successKey] = bonusCheckbox.checked;
        saveSheetStateToStorage();
      });
    }

    const role = row.dataset.role || "attr";

    if (role === "skill") {
      setupSkillRow(row);
    } else {
      setupAttrRow(row);
    }
  });
  updateAttributeRemainingDisplay();
  updateGeneralAbilityRemainingDisplay();
}

// --- helpers for attributes and skills ---

function getStatSuccessKey(row) {
  if (!row) return "";
  const role = row.dataset.role || "attr";
  if (role === "skill") {
    return `skill:${row.dataset.skill || row.dataset.stat || ""}`;
  }
  return `attr:${row.dataset.stat || ""}`;
}

function setupAttrRow(row) {
  const key = row.dataset.stat;
  if (!key) return;

  // Attributes must stay at 1 or higher.
  if (sheetState.attrs[key] == null || sheetState.attrs[key] < 1) {
    sheetState.attrs[key] = 1;
  }
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

    openSheetRollModal({
      label: row.querySelector(".stat-label")?.textContent?.trim() || "Attribute Roll",
      detail: "Attribute",
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
  updateGeneralAbilityRemainingDisplay();

  const rollBtn = row.querySelector(".stat-roll-btn");
  if (!rollBtn) return;

  rollBtn.addEventListener("click", () => {
    const skillVal = sheetState.skills[skillKey] || 0;

    const primaryAttrKey = row.dataset.attr; // e.g. "int", "apt"
    const altAttrKey = row.dataset.altAttr || row.dataset.altattr; // e.g. "dex" for Art or Brawl

    let attrDice = 0;
    let chosenAttrKey = primaryAttrKey || "";
    if (primaryAttrKey) {
      const primary = sheetState.attrs[primaryAttrKey] || 0;
      if (altAttrKey) {
        const alt = sheetState.attrs[altAttrKey] || 0;
        attrDice = Math.max(primary, alt); // multi-attr: max(primary, alt)
        chosenAttrKey = alt > primary ? altAttrKey : primaryAttrKey;
      } else {
        attrDice = primary;
        chosenAttrKey = primaryAttrKey;
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
    let statBonus = bonusCheckbox && bonusCheckbox.checked ? 1 : 0;

    if (chosenAttrKey) {
      const attrRow = document.querySelector(
        `.stat-row[data-role="attr"][data-stat="${chosenAttrKey}"]`
      );
      const attrBonusCheckbox = attrRow?.querySelector(".stat-succeed");
      if (attrBonusCheckbox?.checked) {
        statBonus += 1;
      }
    }

    const globalSuccInput = document.getElementById("success");
    const globalPenInput = document.getElementById("penalty");
    let globalSucc = parseInt(globalSuccInput?.value || "0", 10);
    let globalPen = parseInt(globalPenInput?.value || "0", 10);
    if (isNaN(globalSucc)) globalSucc = 0;
    if (isNaN(globalPen)) globalPen = 0;

    const specialInput = document.getElementById("special");
    const specialStr = specialInput ? specialInput.value || "" : "";

    const skillName = row.querySelector(".stat-name")?.textContent?.trim()
      || row.querySelector(".stat-label")?.textContent?.trim()
      || "Skill Roll";
    const attrLabel = chosenAttrKey ? chosenAttrKey.toUpperCase() : "";

    openSheetRollModal({
      label: skillName,
      detail: attrLabel ? `Skill + ${attrLabel}` : "Skill",
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
  const isAttributeRow = (row.dataset.role || "attr") === "attr";
  const isGeneralAbilityRow = (row.dataset.role || "attr") === "skill" && !!row.closest(".ga-columns");
  const minValue = isAttributeRow ? 1 : 0;
  if (store[key] == null || store[key] < minValue) {
    store[key] = minValue;
  }

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
      if (nextVal < minValue) {
        if (isAttributeRow) {
          alert("Each Attribute must have at least 1 point.");
        }
        nextVal = minValue;
      }
      if (nextVal > 6) nextVal = 6;
      if (isAttributeRow) {
        const currentValue = store[key] || minValue;
        const delta = Math.max(0, nextVal - 1) - Math.max(0, currentValue - 1);
        if (delta > getRemainingAttributePoints()) {
          alert("Not enough remaining Attribute points.");
          return;
        }
      }
      if (isGeneralAbilityRow) {
        const currentValue = store[key] || minValue;
        const delta = Math.max(0, nextVal) - Math.max(0, currentValue);
        if (delta > getRemainingGeneralAbilityPoints()) {
          alert("Not enough remaining General Ability points.");
          return;
        }
      }
      store[key] = nextVal;
      updateStatDots(row, nextVal);
      if (isAttributeRow) {
        updateAttributeRemainingDisplay();
        updateDerivedCharacterVitals();
      }
      if (isGeneralAbilityRow) updateGeneralAbilityRemainingDisplay();
      saveSheetStateToStorage();
    });
  });

  updateStatDots(row, store[key]);
  if (isAttributeRow) {
    updateAttributeRemainingDisplay();
    updateDerivedCharacterVitals();
  }
  if (isGeneralAbilityRow) updateGeneralAbilityRemainingDisplay();
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
    if (!currentSheetId) return;
    clampExpFields();
    updateDerivedDefenseFromGear();
    clampHealthFields();

    const hearts = Array.from(document.querySelectorAll(".mental-heart")).map(
      (btn) => !btn.classList.contains("off") // true if ON, false if OFF
    );
    sheetState.hearts = hearts;

    const globals = {};

    const globalMap = [
      { id: "char-name",       key: "name" },
      { id: "char-level",      key: "level" },
      { id: "char-exp",        key: "exp" },
      { id: "char-exp-max",    key: "expMax" },
      { id: "char-health",     key: "health" },
      { id: "char-health-max", key: "healthMax" },
      { id: "char-defense",    key: "defense" },
      { id: "char-willpower",  key: "will" },
      { id: "char-gender",     key: "gender" },
      { id: "char-age",        key: "age" },
      { id: "char-race",       key: "race" },
      { id: "char-will-source", key: "willSource" },
      { id: "char-background", key: "background" }
    ];

    globalMap.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        globals[key] = el.value ?? "";
      }
    });
    globals.image = sheetState.globals?.image || "";
    globals[MENTAL_MAX_KEY] = String(getMentalMax());
    globals[ATTRIBUTE_MAX_POINTS_KEY] = String(getAttributeMaxPoints());
    globals[GENERAL_ABILITY_MAX_POINTS_KEY] = String(getGeneralAbilityMaxPoints());
    globals[EXTRA_SKILL_MAX_POINTS_KEY] = String(getExtraSkillMaxPoints());

    sheetState.globals = globals;
    updateCurrentSheetName(globals.name || "");

    const payload = {
      attrs: sheetState.attrs || {},
      skills: sheetState.skills || {},
      successChecks: sheetState.successChecks || {},
      hearts: sheetState.hearts || [],
      globals,
      equipment: sheetState.equipment || [],
      statuses: sheetState.statuses || [],
      items: sheetState.items || [],
      note: sheetState.note || "",
      extraSkills: sheetState.extraSkills || []
    };

    localStorage.setItem(getSheetStorageKey(currentSheetId), JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save sheet state:", e);
  }
}

function loadSheetStateFromStorage() {
  try {
    resetSheetState();

    if (!currentSheetId) return;

    const raw = localStorage.getItem(getSheetStorageKey(currentSheetId));
    if (!raw) {
      const fallback = createDefaultSheetPayload("");
      localStorage.setItem(getSheetStorageKey(currentSheetId), JSON.stringify(fallback));
      Object.assign(sheetState.attrs, fallback.attrs);
      Object.assign(sheetState.skills, fallback.skills);
      Object.assign(sheetState.successChecks, fallback.successChecks);
      sheetState.hearts = fallback.hearts;
      sheetState.globals = fallback.globals;
      sheetState.note = fallback.note;
      applyMentalHeartsToUI();
      return;
    }

    const data = JSON.parse(raw);


    if (data.attrs && typeof data.attrs === "object") {
      Object.assign(sheetState.attrs, data.attrs);
    }
    if (data.skills && typeof data.skills === "object") {
      Object.assign(sheetState.skills, data.skills);
    }
    if (data.successChecks && typeof data.successChecks === "object") {
      Object.assign(sheetState.successChecks, data.successChecks);
    }
    // 🔥 Load hearts safely (preserve saved data)
    if (Array.isArray(data.hearts) && data.hearts.length > 0) {
      sheetState.hearts = data.hearts;
    } else {
      sheetState.hearts = getDefaultHearts();
    }
    sheetState.globals = {
      ...createDefaultSheetPayload("").globals,
      ...(data.globals || {})
    };
    migrateLegacyExpGlobals(sheetState.globals);
    migrateLegacyProfileGlobals(sheetState.globals);
    sheetState.equipment = Array.isArray(data.equipment) ? data.equipment : [];
    sheetState.statuses = Array.isArray(data.statuses) ? data.statuses : [];
    sheetState.items = Array.isArray(data.items) ? data.items : [];
    sheetState.note = normalizeSavedNote(data.note);
    sheetState.extraSkills = Array.isArray(data.extraSkills) ? data.extraSkills : [];

    const globalMap = [
      { id: "char-name",       key: "name" },
      { id: "char-level",      key: "level" },
      { id: "char-exp",        key: "exp" },
      { id: "char-exp-max",    key: "expMax" },
      { id: "char-health",     key: "health" },
      { id: "char-health-max", key: "healthMax" },
      { id: "char-defense",    key: "defense" },
      { id: "char-willpower",  key: "will" },
      { id: "profile-char-name", key: "name" },
      { id: "char-gender",     key: "gender" },
      { id: "char-age",        key: "age" },
      { id: "char-race",       key: "race" },
      { id: "char-will-source", key: "willSource" },
      { id: "char-background", key: "background" }
    ];

    globalMap.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el && sheetState.globals[key] != null) {
        el.value = sheetState.globals[key];
      }
    });

    applyMentalHeartsToUI();
  } catch (e) {
    console.warn("Could not load sheet state:", e);
  }
}

// watch header fields and save when user edits them
function setupGlobalFieldPersistence() {
  const globalMap = [
      { id: "char-name",       key: "name" },
      { id: "char-level",      key: "level" },
      { id: "char-exp",        key: "exp" },
      { id: "char-exp-max",    key: "expMax" },
      { id: "char-health",     key: "health" },
	      { id: "char-health-max", key: "healthMax" },
	      { id: "char-defense",    key: "defense" },
	      { id: "char-willpower",  key: "will" },
	      { id: "profile-char-name", key: "name" },
	      { id: "char-gender",     key: "gender" },
	      { id: "char-age",        key: "age" },
	      { id: "char-race",       key: "race" },
	      { id: "char-will-source", key: "willSource" },
	      { id: "char-background", key: "background" }
  ];

  globalMap.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;

	    el.addEventListener("input", () => {
	      sheetState.globals[key] = el.value ?? "";
	      if (key === "name") {
	        syncCharacterNameFields(id, el.value ?? "");
	      }
      if (key === "exp" || key === "expMax") {
        clampExpFields();
        sheetState.globals.exp = document.getElementById("char-exp")?.value ?? "0";
        sheetState.globals.expMax = document.getElementById("char-exp-max")?.value ?? "0";
      }
    if (key === "health" || key === "healthMax") {
      clampHealthFields();
      sheetState.globals.health = document.getElementById("char-health")?.value ?? "0";
      sheetState.globals.healthMax = document.getElementById("char-health-max")?.value ?? "0";
    }
      if (key === "will") {
        updateDerivedCharacterVitals();
      }
      saveSheetStateToStorage();
    });
  });

  setupBoundedPairFields();
  setupCharacterImagePersistence();
  applyCharacterImageFromState();
}

function migrateLegacyExpGlobals(globals) {
  if (!globals || typeof globals !== "object") return;

  const rawExp = String(globals.exp ?? "");
  if (!rawExp.includes("/")) {
    if (globals.expMax != null) return;
    globals.expMax = "0";
    return;
  }

  const [current, max] = rawExp.split("/");
  globals.exp = normalizeNonNegativeNumber(current, 0);
  globals.expMax = normalizeNonNegativeNumber(max, 0);
}

function migrateLegacyProfileGlobals(globals) {
  if (!globals || typeof globals !== "object") return;
  if (!globals.background && globals.profile) {
    globals.background = globals.profile;
  }
}

function normalizeNonNegativeNumber(value, fallback = 0) {
  let number = parseInt(value ?? String(fallback), 10);
  if (Number.isNaN(number) || number < 0) number = fallback;
  return String(number);
}

function clampNumberPair(currentId, maxId) {
  const currentInput = document.getElementById(currentId);
  const maxInput = document.getElementById(maxId);
  if (!currentInput || !maxInput) return;

  let current = parseInt(currentInput.value || "0", 10);
  let max = parseInt(maxInput.value || "0", 10);
  if (Number.isNaN(current) || current < 0) current = 0;
  if (Number.isNaN(max) || max < 0) max = 0;
  if (current > max) current = max;

  currentInput.value = String(current);
  maxInput.value = String(max);
}

function clampExpFields() {
  clampNumberPair("char-exp", "char-exp-max");
}

// function clampHealthFields() {
//   clampNumberPair("char-health", "char-health-max");
// }

function setupBoundedPairFields() {
  [
    ["char-exp", "char-exp-max"],
    ["char-health", "char-health-max"]
  ].forEach(([currentId, maxId]) => {
    const currentInput = document.getElementById(currentId);
    const maxInput = document.getElementById(maxId);
    if (!currentInput || !maxInput) return;

    [currentInput, maxInput].forEach((input) => {
      input.addEventListener("change", () => {
        clampNumberPair(currentId, maxId);
        saveSheetStateToStorage();
      });
    });
  });
}

function syncCharacterNameFields(sourceId, value) {
  ["char-name", "profile-char-name"].forEach((id) => {
    if (id === sourceId) return;
    const input = document.getElementById(id);
    if (input && input.value !== value) input.value = value;
  });
}

function applyCharacterImageFromState() {
  const preview = document.getElementById("char-image-preview");
  const placeholder = document.getElementById("char-image-placeholder");
  const profilePreview = document.getElementById("profile-char-image-preview");
  const profilePlaceholder = document.getElementById("profile-char-image-placeholder");
  const clearBtn = document.getElementById("clear-char-image-btn");
  const image = sheetState.globals?.image || "";

  if (!preview || !placeholder || !clearBtn) return;

  if (image) {
    preview.src = image;
    preview.classList.remove("hidden");
    placeholder.classList.add("hidden");
    if (profilePreview) {
      profilePreview.src = image;
      profilePreview.classList.remove("hidden");
    }
    if (profilePlaceholder) profilePlaceholder.classList.add("hidden");
    clearBtn.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
    placeholder.classList.remove("hidden");
    if (profilePreview) {
      profilePreview.removeAttribute("src");
      profilePreview.classList.add("hidden");
    }
    if (profilePlaceholder) profilePlaceholder.classList.remove("hidden");
    clearBtn.classList.add("hidden");
  }
}

function setupCharacterImagePersistence() {
  const input = document.getElementById("char-image-input");
  const clearBtn = document.getElementById("clear-char-image-btn");

  if (input) {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        sheetState.globals.image = typeof reader.result === "string" ? reader.result : "";
        applyCharacterImageFromState();
        saveSheetStateToStorage();
        input.value = "";
      });
      reader.readAsDataURL(file);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!confirmRemove("Remove this character image?")) return;
      sheetState.globals.image = "";
      applyCharacterImageFromState();
      saveSheetStateToStorage();
    });
  }
}
