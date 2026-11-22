"use strict";

const data = globalThis.StrideData;
const rules = globalThis.StrideRules;
const { language, t } = globalThis.StrideLocale;
const storageKey = "stridekeep.expedition-playtest.v1";
const mission = data.expedition;
const byId = (id) => document.getElementById(id);
const write = (id, value) => { byId(id).textContent = t(value); };
const decimal = (value, digits) => value.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (purity) => `${decimal(purity / 100, 2)}%`;
const grams = (weight) => `${decimal(weight / 10, 1)} g`;
const amount = (map, id) => map[id] ?? 0;
const muralContext = byId("mural-canvas").getContext("2d");
let muralSize, muralTargets;
let muralScope = location.hash === "#personal-mural" ? "personal" : "community";
const dialog = byId("action-dialog");
const gameGrid = document.querySelector(".game-grid");
const viewLinks = document.querySelectorAll("[data-game-view]");
const gameViews = {
  home: ["mine", "missions", "find", "collection"],
  "edit-character": ["edit-character"],
  journal: ["journal"],
  workshop: ["workshop", "gear"],
  missions: ["missions", "contracts"],
  mural: ["mural"],
  "guild-expedition": ["guild-expedition"],
};
const homeAnchors = new Set(["watch", "character", "profile", "mine", "collection", "find"]);
const inventoryTabs = [...document.querySelectorAll("[data-inventory-tab]")];
const inventoryAnchors = new Map(inventoryTabs.map(tab => [tab.getAttribute("aria-controls"), tab.dataset.inventoryTab]));
const catalogue = Object.entries(data.minerals);
const sourceMinerals = new Map(catalogue.filter(([, mineral]) => mineral.pigment).map(([id, mineral]) => [mineral.pigment, id]));
const listPages = { odds: 0, journal: 0, recipe: 0, palette: 0 };
const journalPageSize = 12;
const searchKey = value => String(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const percentages = new Intl.NumberFormat(language, { maximumFractionDigits: 10 });
const chanceLabel = chance => `${percentages.format(chance)}%`;
const rarityOrder = ["Common", "Uncommon", "Rare", "Very Rare", "Exceptional", "Legendary", "Mythic", "Artifact"];
let storageOn = true;
let lockingOn = true;
let state = readSave(rules.create(data), true);
let selected = state.latest;
let inspectedPigment = null;
let journalSelection = null;
let selectedPigment = Object.keys(data.mural.needs)[0];
let selectedPixel = null;
let pendingAction;
let draftBackground;
let previewDye = null;

function announce(message) {
  write("feedback", message);
}

function syncLanguageLink() {
  const url = new URL(location.href);
  url.searchParams.set("lang", language === "pt-PT" ? "en" : "pt-PT");
  byId("language-switch").href = url.href;
}

function setInventoryTab(id, updateLocation = false) {
  if (id !== "pigments" && inspectedPigment) {
    inspectedPigment = null;
    renderFind();
    renderCollection();
  }
  for (const tab of inventoryTabs) {
    const active = tab.dataset.inventoryTab === id;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    byId(tab.getAttribute("aria-controls")).hidden = !active;
  }
  if (updateLocation && gameGrid.dataset.homeMode !== "watch") {
    history.replaceState(history.state, "", `#inventory-${id}`);
    syncLanguageLink();
  }
}

function showGameView() {
  const anchor = location.hash.slice(1);
  const previous = gameGrid.dataset.view;
  const inventoryTab = inventoryAnchors.get(anchor);
  const view = homeAnchors.has(anchor) || inventoryTab ? "home" : anchor === "personal-mural" ? "mural" : Object.hasOwn(gameViews, anchor) ? anchor
    : Object.keys(gameViews).find((id) => gameViews[id].includes(anchor)) ?? "home";
  const panels = gameViews[view];
  if (view === "mural") {
    const scope = anchor === "personal-mural" ? "personal" : "community";
    if (muralScope !== scope) {
      muralScope = scope;
      selectedPixel = null;
      byId("pixel-pulse").hidden = true;
    }
    renderMural();
  }
  const watch = anchor === "watch";
  if (watch && gameGrid.dataset.homeMode !== "watch") byId("collection").after(byId("find"));
  if (!watch && gameGrid.dataset.homeMode === "watch") byId("collection").before(byId("find"));
  gameGrid.dataset.homeMode = watch ? "watch" : "play";
  byId("home-bar").hidden = view !== "home";
  for (const link of document.querySelectorAll("a[data-home-mode]")) {
    if (link.dataset.homeMode === gameGrid.dataset.homeMode) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  for (const panel of gameGrid.children) panel.hidden = panel.hasAttribute("data-watch-only") ? !watch : !panels.includes(panel.id);
  gameGrid.dataset.view = view;
  if (view === "edit-character" && previous !== view) openWardrobe();
  if (view === "home") {
    if (inventoryTab || anchor === "collection") setInventoryTab(inventoryTab ?? "minerals");
    if (anchor === "find") {
      setInventoryTab("minerals");
      byId("find-more").open = true;
    }
  }
  if (view === "home" || view === "missions") renderMissions();
  if (view === "journal") {
    if (previous !== view && !journalSelection && !byId("journal-query").value && !byId("journal-discovered").checked) {
      const latestId = state.items.find(item => item.id === state.latest)?.mineral;
      const index = catalogue.findIndex(([id]) => latestId ? id === latestId : state.records[id]);
      if (index >= 0) {
        listPages.journal = Math.floor(index / journalPageSize);
        journalSelection = catalogue[index][0];
      }
    }
    renderJournal();
  }
  if (view === "workshop") {
    renderRecipes();
    renderPalette();
    renderGear();
  }
  const active = view === "edit-character" ? "home" : view;
  for (const link of viewLinks) {
    if (link.hash === `#${active}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  syncLanguageLink();
  requestAnimationFrame(() => {
    if (location.hash.slice(1) !== anchor) return;
    const target = inventoryTab ? "collection" : anchor === "character" ? "profile" : anchor;
    if (target !== view && panels.includes(target)) byId(target).scrollIntoView();
    else window.scrollTo(0, 0);
    if (view === "edit-character" && previous !== view) byId("edit-character-title").focus({ preventScroll: true });
    if (view === "home" && previous === "edit-character") byId("profile-name").focus({ preventScroll: true });
    if (anchor === "find") byId("find-context").focus({ preventScroll: true });
    if (anchor === "journal") byId("journal-title").focus({ preventScroll: true });
  });
}

function readSave(fallback, initialise = false) {
  if (storageOn) {
    try {
      const raw = localStorage.getItem(storageKey);
      const restored = rules.restore(raw, data, fallback);
      if (initialise && (raw === null || restored !== fallback) && raw !== JSON.stringify(restored)) {
        try { localStorage.setItem(storageKey, JSON.stringify(restored)); } catch { storageOn = false; }
      }
      return restored;
    } catch {
      storageOn = false;
    }
  }
  return fallback;
}

function save() {
  if (storageOn) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      storageOn = false;
    }
  }
  write("save-status", storageOn ? "Progress is stored in this browser." : "Progress lasts while this tab is open.");
}

function run(action) {
  if (action.type === "paint") action.muralId = rules.muralBoard(state, data, action.scope)?.mural.id;
  const applyAction = () => {
    let success = false;
    try {
      state = readSave(state);
      if (action.type === "reset") {
        state = { ...rules.create(data), nextId: state.nextId };
        selected = null;
        inspectedPigment = null;
        selectedPigment = Object.keys(data.mural.needs)[0];
        selectedPixel = null;
        if (gameGrid.dataset.view === "edit-character") openWardrobe();
        announce("A new playtest has started.");
      } else {
        const consumed = action.type === "crush" ? state.items.find((item) => item.id === action.id) : undefined;
        const landing = action.type === "paint" ? action.pixel ?? rules.nextMuralPixel(state, data, action.pigment, action.scope) : null;
        const result = rules.apply(state, data, action);
        state = result.state;
        if (action.type === "barter") inspectedPigment = rules.crewOffers[action.pigment];
        if (action.type === "wash-brush") selectedPixel = null;
        if (landing !== null) {
          selectedPixel = null;
          selectedPigment = action.pigment;
          muralScope = action.scope ?? "community";
          if (action.pixel === undefined && gameGrid.dataset.homeMode !== "watch") location.hash = muralScope === "personal" ? "personal-mural" : "mural";
          muralSize = rules.muralBoard(state, data, muralScope).mural.gridSize;
          pulseMuralPixel(landing, action.pigment);
        }
        if (["mine", "collect", "expedition-claim"].includes(action.type)) {
          selected = state.latest;
          inspectedPigment = null;
          byId("find-more").open = false;
        }
        const acquired = consumed ? data.minerals[consumed.mineral].pigment : action.type === "mix" ? action.recipe : null;
        if (action.type === "mix" && inspectedPigment && !amount(state.pigments, inspectedPigment)) inspectedPigment = acquired;
        if (acquired && Object.hasOwn(rules.muralBoard(state, data, muralScope).mural.needs, acquired)) {
          selectedPigment = acquired;
          selectedPixel = null;
        }
        if (action.type === "new-personal-mural" || action.type.startsWith("community-")) selectedPixel = null;
        if (result.message) announce(result.message);
      }
      save();
      success = true;
    } catch (error) {
      announce(error.message);
    }
    render();
    return success;
  };
  if (storageOn && lockingOn && navigator.locks) {
    let started = false;
    return navigator.locks.request(storageKey, () => {
      started = true;
      return applyAction();
    }).catch((error) => {
      if (started) {
        announce(error.message);
        return false;
      }
      lockingOn = false;
      return applyAction();
    });
  }
  return applyAction();
}

function element(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = t(text);
  return node;
}

function button(label, disabled = false) {
  const node = element("button", "", label);
  node.type = "button";
  node.disabled = disabled;
  return node;
}

function option(value, label) {
  const node = element("option", "", label);
  node.value = value;
  return node;
}

function sprite(item) {
  return `mineral-art/${item.polished ? "polished/" : ""}${item.mineral}.png`;
}

function specimenFinish(item) {
  if (item.finish === "high-gloss") return "High gloss";
  return item.polished ? "Polished" : "Raw";
}

function current() {
  return state.items.find((item) => item.id === selected);
}

function listPage(key, matches, size) {
  const pages = Math.max(1, Math.ceil(matches.length / size));
  const page = listPages[key] = Math.min(listPages[key], pages - 1);
  const controls = byId(key + "-pages");
  // Keep the same buttons when changing pages so keyboard focus stays on the pager.
  if (!controls.firstChild) {
    for (const [direction, label] of [[-1, "Previous"], [1, "Next"]]) {
      const control = button(label);
      control.addEventListener("click", () => {
        listPages[key] += direction;
        ({ odds: renderOdds, recipe: renderRecipes, journal: renderJournal, palette: renderPalette })[key]();
      });
      controls.append(control);
      if (direction < 0) {
        const status = element("span");
        status.setAttribute("aria-live", "polite");
        controls.append(status);
      }
    }
  }
  const [previous, count, next] = controls.children;
  previous.disabled = page <= 0;
  next.disabled = page >= pages - 1;
  previous.hidden = next.hidden = pages === 1;
  const start = page * size;
  count.textContent = matches.length ? t`${start + 1}–${Math.min(start + size, matches.length)} of ${matches.length}` : t("No results");
  return matches.slice(start, start + size);
}

function renderMine() {
  byId("mine").style.setProperty("--mine-art", `url("${new URL(data.mine.art, document.baseURI).href}")`);
  write("equipped-pick", data.tools[state.equipped].name);
  write("mine-interval", t`${data.mine.seconds}s between strikes`);
  renderOdds();
  tickMining();
}

function renderOdds() {
  if (!byId("mine-odds").closest("details").open) return;
  const chances = rules.miningOdds(data, state.equipped);
  const slots = catalogue.map(([id, mineral], index) => ({ id, mineral, index })).filter(({ id }) => Object.hasOwn(chances, id));
  const rows = listPage("odds", slots, 16).map(({ id, mineral, index }) => {
    const slot = `#${String(index + 1).padStart(2, "0")}`;
    const name = state.records[id] ? t(mineral.name) : t("Unknown mineral");
    const row = element("div");
    const term = element("dt");
    term.append(element("span", "odds-slot", slot), document.createTextNode(name));
    row.append(term, element("dd", "", chanceLabel(chances[id])));
    return row;
  });
  byId("mine-odds").replaceChildren(...rows);
}

function tickMining() {
  const control = byId("mine-button");
  const cooldown = Math.max(0, state.mineReadyAt - Date.now());
  byId("mining-status").hidden = !state.mining && !cooldown;
  byId("mining-meter").hidden = !state.mining;
  if (!state.mining) {
    control.disabled = cooldown > 0;
    control.textContent = t("Mine");
    const label = cooldown ? t`Ready to mine again in ${Math.ceil(cooldown / 1000)}s` : "";
    if (byId("mining-label").textContent !== label) write("mining-label", label);
    return;
  }
  const remaining = Math.max(0, state.mining.endsAt - Date.now());
  const label = remaining ? t`${Math.ceil(remaining / 1000)}s remaining` : t("Find ready");
  if (byId("mining-label").textContent !== label) write("mining-label", label);
  byId("mining-meter").value = Math.max(0, 1 - remaining / (data.mine.seconds * 1000));
  control.disabled = remaining > 0;
  control.textContent = t(remaining > 0 ? "Mining…" : "Collect find");
}

function renderFind() {
  if (!current()) selected = state.items.find((item) => item.id === state.latest)?.id ?? state.items[0]?.id;
  const item = current();
  if (!amount(state.pigments, inspectedPigment)) inspectedPigment = null;
  byId("pigment-details").hidden = !inspectedPigment;
  if (inspectedPigment) {
    byId("empty-find").hidden = byId("find-details").hidden = true;
    byId("show-latest-find").hidden = !state.items.some(candidate => candidate.id === state.latest);
    write("find-context", "Inventory pigment");
    renderPigmentDetails(inspectedPigment);
    return;
  }
  byId("find-details").hidden = !item;
  byId("empty-find").hidden = Boolean(item);
  byId("find-rarity").hidden = !item;
  byId("show-latest-find").hidden = !item || item.id === state.latest || !state.items.some(candidate => candidate.id === state.latest);
  if (!item) {
    write("find-context", "Latest find");
    write("find-name", "Your next find");
    write("empty-find", state.stats.mined > 0 ? "Mine again to inspect another mineral." : "Mine to see your first raw mineral, its purity and weight.");
    return;
  }
  const mineral = data.minerals[item.mineral];
  const record = state.records[item.mineral] ?? item;
  const finish = specimenFinish(item);
  const image = byId("find-sprite");
  image.setAttribute("src", sprite(item));
  image.alt = `${t(mineral.name)} · ${t(finish)}`;
  image.parentElement.style.setProperty("--purity", item.purity / 10000);
  image.parentElement.dataset.finish = item.finish ?? "";
  write("find-context", item.origin ?? (item.id === state.latest ? "Latest find" : "From your collection"));
  write("find-name", mineral.name);
  write("find-state", finish);
  write("find-rarity", mineral.rarity);
  byId("find-rarity").dataset.rarity = mineral.rarity;
  byId("find-purity").value = item.purity / 100;
  byId("find-purity").textContent = percent(item.purity);
  write("purity-label", percent(item.purity));
  write("find-weight", grams(item.weight));
  write("find-best", percent(record.purity));
  write("find-heaviest", grams(record.weight));
  byId("polish-button").disabled = item.polished;
  byId("collector-note").hidden = !mineral.collectibleOnly;
  byId("crush-button").hidden = Boolean(mineral.collectibleOnly);
  byId("crush-button").disabled = item.polished || Boolean(mineral.collectibleOnly) || Boolean(item.protected);
  byId("sell-button").disabled = Boolean(item.protected);
  byId("protect-button").setAttribute("aria-pressed", String(Boolean(item.protected)));
  write("protect-button", item.protected ? "Remove protection" : "Protect specimen");
  write("crush-button", mineral.material ? "Crush for powder" : "Crush");
  write("sell-button", t`Sell · ${rules.salePrice(item, data)}`);
  const powder = amount(state.materials, "diamond-powder");
  byId("finish-controls").hidden = !item.polished || item.finish === "high-gloss";
  byId("finish-button").disabled = powder === 0;
  write("finish-stock", t`Diamond Powder · ${powder} available`);
}

function renderCollection() {
  const items = state.items.map((item) => {
    const mineral = data.minerals[item.mineral];
    const stateLabel = specimenFinish(item);
    const control = button("");
    control.dataset.specimen = item.id;
    control.tabIndex = item.id === selected ? 0 : -1;
    control.dataset.state = stateLabel;
    control.setAttribute("aria-pressed", String(item.id === selected));
    control.setAttribute("aria-label", t`${mineral.name}, ${t(stateLabel)}, ${percent(item.purity)} purity, ${grams(item.weight)}`);
    const icon = element("span", "specimen-icon");
    icon.style.backgroundImage = `url("${sprite(item)}")`;
    icon.style.filter = `contrast(${.64 + item.purity / 10000 * .57})`;
    control.title = control.getAttribute("aria-label");
    icon.setAttribute("aria-hidden", "true");
    control.append(icon);
    return control;
  });
  fillSlots("specimens", items);
  byId("empty-collection").hidden = items.length > 0;
  write("collection-count", `${items.length} ${t(items.length === 1 ? "piece" : "pieces")}`);
  const pigments = Object.entries(data.pigments).filter(([id]) => amount(state.pigments, id) > 0).map(([id, pigment], index) => {
    const stock = amount(state.pigments, id);
    const control = button("");
    control.dataset.stockPigment = id;
    control.setAttribute("aria-pressed", String(inspectedPigment === id));
    control.tabIndex = (inspectedPigment ? inspectedPigment === id : index === 0) ? 0 : -1;
    control.title = t`${pigment.name} · ${stock} in stock`;
    control.setAttribute("aria-label", control.title);
    control.append(swatch(element("span", "swatch"), pigment), element("span", "pigment-quantity", `×${stock}`));
    return control;
  });
  fillSlots("pigment-stock", pigments);
  byId("empty-pigment-stock").hidden = pigments.length > 0;

  const materials = Object.entries(data.materials).filter(([id]) => amount(state.materials, id) > 0).map(([id, material]) => {
    const chip = element("li", "stock-pigment stock-material");
    chip.dataset.stockMaterial = id;
    chip.append(element("span", "stock-material-icon"), element("span", "stock-name", material.name),
      element("strong", "stock-quantity", `×${amount(state.materials, id)}`));
    return chip;
  });
  byId("material-stock").replaceChildren(...materials);
  byId("empty-material-stock").hidden = materials.length > 0;
}

function fillSlots(id, cells) {
  const slots = cells.slice();
  while (slots.length < 28) {
    const empty = element("span", "empty-slot");
    empty.setAttribute("aria-hidden", "true");
    slots.push(empty);
  }
  byId(id).replaceChildren(...slots);
}

function renderPigmentDetails(id) {
  const pigment = data.pigments[id];
  write("stock-pigment-name", pigment.name);
  write("stock-pigment-count", t`${amount(state.pigments, id)} in stock`);
  swatch(byId("stock-pigment-swatch"), pigment);
  const actions = byId("pigment-actions");
  actions.replaceChildren();
  const uses = element("div", "pigment-uses");
  for (const scope of ["personal", "community"]) {
    if (rules.nextMuralPixel(state, data, id, scope) === null) continue;
    const place = button(scope === "personal" ? "Paint personal mural" : "Paint community mural");
    place.dataset.place = id;
    place.dataset.scope = scope;
    uses.append(place);
  }
  const dye = button("Try clothing dye");
  dye.dataset.dye = id;
  uses.append(dye);
  actions.append(uses);
  if (Object.hasOwn(rules.crewOffers, id)) {
    const received = data.pigments[rules.crewOffers[id]];
    const offer = element("div", "pigment-uses");
    const exchange = button(t`Trade 2 for 1 × ${received.name}`, amount(state.pigments, id) < 2);
    exchange.addEventListener("click", () => ask({ type: "barter", pigment: id }, "Crew exchange",
      t`Give the simulated crew 2 × ${pigment.name} for 1 × ${received.name}?`, "Trade"));
    offer.append(swatch(element("i", "art swatch"), received), exchange);
    actions.append(offer);
  }
  for (const [recipeId, recipe] of Object.entries(data.recipes)) {
    if (Object.hasOwn(recipe.ingredients, id)) actions.append(recipeRow(recipeId, recipe));
  }
  for (const [contractId, contract] of Object.entries(data.contracts)) {
    if (contract.pigment === id && !state.contracts.includes(contractId)) actions.append(contractRow(contractId, contract));
  }
}

function swatch(node, pigment) {
  node.style.setProperty("--pigment", pigment.color);
  node.setAttribute("aria-hidden", "true");
  return node;
}

function pulseMuralPixel(pixel, pigment) {
  const pulse = byId("pixel-pulse");
  pulse.hidden = false;
  pulse.style.left = (pixel % muralSize) * 100 / muralSize + "%";
  pulse.style.top = Math.floor(pixel / muralSize) * 100 / muralSize + "%";
  pulse.style.width = 100 / muralSize + "%";
  pulse.style.setProperty("--pigment", data.pigments[pigment].color);
  for (const animation of pulse.getAnimations()) animation.cancel();
  const animation = pulse.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 850,
  });
  animation.onfinish = () => { pulse.hidden = true; };
}

function selectPixel(pixel) {
  if (!muralTargets[pixel]) return;
  selectedPixel = pixel;
  selectedPigment = muralTargets[pixel];
  renderMural();
}

function pointerPixel(event) {
  const bounds = muralContext.canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - bounds.left) * muralSize / bounds.width);
  const y = Math.floor((event.clientY - bounds.top) * muralSize / bounds.height);
  return x >= 0 && x < muralSize && y >= 0 && y < muralSize ? y * muralSize + x : null;
}

muralContext.canvas.addEventListener("pointermove", event => {
  muralContext.canvas.style.cursor = muralTargets[pointerPixel(event)] ? "crosshair" : "";
});
muralContext.canvas.addEventListener("pointerleave", () => { muralContext.canvas.style.cursor = ""; });
muralContext.canvas.addEventListener("click", event => selectPixel(pointerPixel(event)));
muralContext.canvas.addEventListener("keydown", event => {
  const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (Object.hasOwn(steps, event.key)) {
    event.preventDefault();
    const [dx, dy] = steps[event.key];
    if (selectedPixel === null) {
      selectPixel(muralTargets.findIndex(Boolean));
      return;
    }
    let x = selectedPixel % muralSize + dx;
    let y = Math.floor(selectedPixel / muralSize) + dy;
    while (x >= 0 && x < muralSize && y >= 0 && y < muralSize) {
      const pixel = y * muralSize + x;
      if (muralTargets[pixel]) {
        selectPixel(pixel);
        break;
      }
      x += dx;
      y += dy;
    }
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    byId("paint-button").click();
  }
});
byId("mural-guide-toggle").addEventListener("change", renderMural);
byId("mural-zoom").addEventListener("change", event => {
  byId("mural").classList.toggle("zoomed", event.target.checked);
});

function renderMural() {
  StrideCommunityUI.render(state, data, muralScope, run);
  const board = rules.muralBoard(state, data, muralScope);
  const { mural, painted, filledPixels } = board;
  muralSize = mural.gridSize;
  muralTargets = [];
  for (const [id, cells] of Object.entries(mural.needs)) {
    for (const [x, y] of cells) muralTargets[y * muralSize + x] = id;
  }
  if (!muralTargets[selectedPixel]) selectedPixel = null;
  if (!Object.hasOwn(mural.needs, selectedPigment)) selectedPigment = Object.keys(mural.needs)[0];
  const progress = rules.muralProgress(state, data, muralScope);
  for (const link of document.querySelectorAll(".mural-tabs [data-scope]")) {
    if (link.dataset.scope === muralScope) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const rows = Object.entries(mural.needs).map(([id, pixels]) => {
    const pigment = data.pigments[id];
    const remaining = pixels.length - amount(painted, id);
    const row = element("li");
    const control = button("");
    control.dataset.pigment = id;
    control.setAttribute("aria-pressed", String(id === selectedPigment));
    control.append(swatch(element("i"), pigment), t(pigment.name),
      element("small", "", t`${amount(state.pigments, id)} owned · ${remaining} left`));
    row.append(control);
    return row;
  });
  byId("pigments").replaceChildren(...rows);
  const percentage = decimal(progress.filled * 100 / progress.needed, progress.left && progress.filled ? 1 : 0);
  write("mural-title", mural.name);
  write("mural-progress", `${percentage}%`);
  write("mural-status", progress.left ? t`${progress.left} ${progress.left === 1 ? "pixel" : "pixels"} to paint` : "Mural complete");
  const target = muralTargets[selectedPixel];
  const filled = Object.hasOwn(filledPixels, selectedPixel);
  byId("paint-button").disabled = !target || filled || !amount(state.pigments, target);
  write("paint-button", "Apply pigment");
  const stroke = rules.brushStroke(board, target, selectedPixel);
  const wash = byId("wash-brush");
  wash.hidden = stroke.length < 2;
  wash.disabled = stroke.length > amount(state.pigments, target);
  if (!wash.hidden) write("wash-brush", t`Wide brush · ${stroke.length} units`);
  write("pixel-selection", selectedPixel === null ? "" : filled ? "This pixel is already painted." :
    t`Column ${selectedPixel % muralSize + 1}, row ${Math.floor(selectedPixel / muralSize) + 1} · ${data.pigments[target].name} · In stock: ${amount(state.pigments, target)}`);
  const complete = progress.left === 0;
  byId("paint-button").hidden = complete;
  byId("equip-mural").hidden = !complete;
  const backgroundId = mural.id;
  write("equip-mural", state.background === backgroundId ? "View on character" : "Use as background");
  byId("next-personal-mural").hidden = !complete || muralScope !== "personal";
  byId("pixel-help").hidden = complete;
  byId("mural-canvas").setAttribute("aria-label", t`${mural.name}, ${percentage}% complete`);
  drawPlayableMural(muralContext, mural, data.pigments, filledPixels, complete ? null : selectedPixel, byId("mural-guide-toggle").checked);
}

function renderBackgroundPicker() {
  byId("mural-background-option").value = data.mural.id;
  byId("mural-background-option").disabled = !rules.backgroundMural(state, data, data.mural.id);
  write("mural-background-option", byId("mural-background-option").disabled ? t`${data.mural.name} — complete the mural` : data.mural.name);
  const backgrounds = byId("character-background");
  while (backgrounds.options.length > 2) backgrounds.remove(2);
  for (const entry of StrideCommunity.allBoards(state, data)) {
    if (entry.mural.id !== data.mural.id && StrideCommunity.complete(entry)) backgrounds.append(option(entry.mural.id, entry.mural.name));
  }
  const currentPersonal = state.personal.mural;
  const activeOption = option(currentPersonal.id, currentPersonal.name);
  activeOption.disabled = rules.muralProgress(state, data, "personal").left > 0;
  if (activeOption.disabled) activeOption.textContent = t`${currentPersonal.name} — complete the mural`;
  backgrounds.append(activeOption);
  for (const previous of Object.values(state.personalHistory)) {
    backgrounds.append(option(previous.mural.id, previous.mural.name));
  }
  backgrounds.value = draftBackground;
  updateBackgroundLink();
}

function updateBackgroundLink() {
  byId("background-mural-link").hash = draftBackground === state.personal.mural.id ? "personal-mural" : "mural";
}

function renderRecipes() {
  const query = searchKey(byId("recipe-query").value);
  const ready = byId("recipe-ready").checked;
  const matches = Object.entries(data.recipes).filter(([, recipe]) => {
    if (ready && !rules.hasStock(state, recipe.ingredients)) return false;
    const names = [recipe.name, ...Object.keys(recipe.ingredients).map(id => data.pigments[id].name)];
    return names.some(name => searchKey(t(name)).includes(query));
  });
  byId("recipe-list").replaceChildren(...listPage("recipe", matches, 8).map(([id, recipe]) => recipeRow(id, recipe)));
}

function renderPalette() {
  if (!byId("palette-book").open) return;
  const query = searchKey(byId("palette-query").value);
  const source = byId("palette-source").value;
  const matches = Object.entries(data.pigments).filter(([id, pigment]) =>
    (!source || source === (data.recipes[id] ? "recipe" : "base")) && searchKey(t(pigment.name)).includes(query));
  const rows = listPage("palette", matches, 16).map(([id, pigment]) => {
    const row = element("li");
    const detail = element("div");
    detail.append(element("strong", "", pigment.name));
    const mineral = sourceMinerals.get(id);
    if (data.recipes[id]) {
      const parts = Object.entries(data.recipes[id].ingredients).map(([ingredient, n]) => `${n} × ${t(data.pigments[ingredient].name)}`);
      detail.append(element("small", "", parts.join(" + ")));
    } else {
      detail.append(element("small", "", state.records[mineral] ? t`Crush ${data.minerals[mineral].name}` : "Mineral source undiscovered"));
    }
    row.append(swatch(element("i", "swatch"), pigment), detail);
    return row;
  });
  byId("palette-list").replaceChildren(...rows);
}

function recipeRow(id, recipe) {
  const row = element("div", "work-row");
  const detail = element("div");
  detail.append(element("strong", "", recipe.name));
  for (const [pigment, parts] of Object.entries(recipe.ingredients)) {
    const owned = amount(state.pigments, pigment);
    detail.append(element("small", owned < parts ? "missing" : "", t`${parts} × ${data.pigments[pigment].name} · ${owned} owned`));
  }
  const mix = button("Mix", !rules.hasStock(state, recipe.ingredients));
  mix.dataset.recipe = id;
  row.append(swatch(element("i", "art swatch"), data.pigments[id]), detail, mix);
  return row;
}

function renderGear() {
  const rows = Object.entries(data.tools).map(([id, tool]) => {
    const row = element("div", "work-row");
    const detail = element("div");
    const owned = state.owned.includes(id);
    const equipped = state.equipped === id;
    const blocked = tool.requires && !state.owned.includes(tool.requires);
    const label = owned ? (equipped ? "Equipped" : "Equip") : t`Buy · ${tool.cost}`;
    const control = button(label, equipped || (!owned && (blocked || state.coins < tool.cost)));
    control.dataset.tool = id;
    detail.append(element("strong", "", tool.name), element("small", "", tool.detail));
    if (blocked) detail.append(element("small", "missing", t`Requires ${t(data.tools[tool.requires].name)}`));
    const art = element("i", "art");
    art.style.backgroundImage = `url("${tool.art}")`;
    art.setAttribute("aria-hidden", "true");
    row.append(art, detail, control);
    return row;
  });
  byId("tool-list").replaceChildren(...rows);
  const compare = byId("compare-pick");
  const alternatives = Object.entries(data.tools).filter(([id]) => id !== state.equipped);
  const previous = compare.value;
  compare.replaceChildren(...alternatives.map(([id, tool]) => option(id, tool.name)));
  const next = alternatives.find(([, tool]) => tool.tier > data.tools[state.equipped].tier);
  compare.value = alternatives.some(([id]) => id === previous) ? previous : (next ?? alternatives.at(-1))[0];
  renderGearComparison();
}

function chancesByRarity(toolId) {
  const totals = {};
  for (const [id, chance] of Object.entries(rules.miningOdds(data, toolId))) {
    const rarity = data.minerals[id].rarity;
    totals[rarity] = (totals[rarity] ?? 0) + chance;
  }
  return totals;
}

function renderGearComparison() {
  const preview = byId("compare-pick").value;
  const equipped = chancesByRarity(state.equipped);
  const compared = chancesByRarity(preview);
  write("comparison-equipped", t`Equipped · ${data.tools[state.equipped].name}`);
  write("comparison-preview", data.tools[preview].name);
  const rows = rarityOrder.filter(tier => tier in equipped || tier in compared).map(tier => {
    const row = element("tr");
    const label = element("th", "", tier);
    label.scope = "row";
    row.append(label, element("td", "", chanceLabel(equipped[tier])), element("td", "", chanceLabel(compared[tier])));
    return row;
  });
  byId("gear-odds").replaceChildren(...rows);
}

function renderMissions() {
  const home = gameGrid.dataset.view === "home";
  write("mission-title", home ? "Current mission" : "Missions");
  const missions = Object.entries(data.missions).map(([id, mission]) => ({
    id, mission, progress: rules.missionProgress(state, data, id), claimed: state.claimed.includes(id),
  }));
  const pending = missions.filter(entry => !entry.claimed);
  const featured = pending.find(entry => entry.progress >= entry.mission.goal) ?? pending[0];
  const visible = home ? (featured ? [featured] : []) : missions;
  const rows = visible.map(({ id, mission, progress, claimed }) => {
    const row = element("div", "work-row mission-row");
    const detail = element("span");
    detail.append(element("strong", "", mission.name), element("small", "", mission.text));
    const readout = element("small", "", t`${progress}/${mission.goal} · ${mission.coins} coins`);
    if (home) {
      const meter = element("progress", "mission-meter");
      meter.max = mission.goal;
      meter.value = progress;
      meter.setAttribute("aria-label", t(mission.name));
      const line = element("div", "mission-progress");
      line.append(meter, readout);
      detail.append(line);
    } else detail.append(readout);
    const claim = button(claimed ? "Claimed" : "Claim", claimed || progress < mission.goal);
    claim.dataset.mission = id;
    row.append(detail, claim);
    return row;
  });
  byId("mission-list").replaceChildren(...rows);
  byId("view-all-missions").hidden = !home;
  byId("rank-progress").hidden = home;
  byId("empty-home-missions").hidden = !home || rows.length > 0;
}

function renderContracts() {
  const contracts = Object.entries(data.contracts);
  byId("contract-list").replaceChildren(...contracts.map(([id, contract]) => contractRow(id, contract)));
  write("contract-progress", t`${state.contracts.length}/${contracts.length} complete`);
}

function contractRow(id, contract) {
  const row = element("div", "work-row contract-row");
  const detail = element("div", "contract-detail");
  const fulfilled = state.contracts.includes(id);
  const specimens = contract.pigment ? [] : rules.contractSpecimens(state, contract);
  const ready = contract.pigment ? amount(state.pigments, contract.pigment) >= contract.quantity : specimens.length > 0;
  const requirement = contract.pigment ?
    t`${contract.quantity} × ${data.pigments[contract.pigment].name} · ${amount(state.pigments, contract.pigment)} in stock` :
    [`${t(data.minerals[contract.mineral].name)} (${t(contract.finish === "polished" ? "Polished" : "Raw")})`,
      contract.minPurity && t`${percent(contract.minPurity)}+ purity`,
      contract.minWeight && t`${grams(contract.minWeight)}+ weight`].filter(Boolean).join(" · ");
  const consumes = contract.pigment || contract.consume;
  const action = button(fulfilled ? "Complete" : consumes ? "Deliver" : "Show", fulfilled || !ready);
  action.dataset.contract = id;
  detail.append(element("strong", "", contract.name), element("small", "", requirement),
    element("small", "contract-effect", `${t(consumes ? "Uses up the delivery" : "Keep the specimen")} · +${t`${contract.coins} coins`}`));
  row.append(detail, action);
  // Keep the selected inventory ID when another action refreshes this panel.
  const prior = byId(`contract-${id}`)?.value;
  const select = element("select");
  if (specimens.length && !fulfilled) {
    select.id = `contract-${id}`;
    select.setAttribute("aria-label", t`Specimen for ${t(contract.name)}`);
    select.replaceChildren(...specimens.map((item) => option(item.id, `#${item.id} · ${percent(item.purity)} · ${grams(item.weight)}`)));
    if (specimens.some((item) => String(item.id) === prior)) select.value = prior;
    detail.append(select);
  }
  action.addEventListener("click", () => {
    const claim = { type: "claim-contract", contract: id, id: Number(select.value) };
    if (consumes) ask(claim, t`Deliver for ${t(contract.name)}?`,
      t`${requirement}. The delivery leaves your inventory and pays ${contract.coins} coins.`, "Deliver supplies");
    else run(claim);
  });
  return row;
}

function renderJournal() {
  const discoveries = catalogue.filter(([id]) => state.records[id]).length;
  const query = searchKey(byId("journal-query").value).replace(/^#/, "");
  const discoveredOnly = byId("journal-discovered").checked;
  const matches = catalogue.map(([id, mineral], index) => ({ id, mineral, index })).filter(({ id, mineral, index }) => {
    if (!state.records[id] && discoveredOnly) return false;
    return String(index + 1).padStart(3, "0").includes(query) || (state.records[id] && searchKey(t(mineral.name)).includes(query));
  });
  const page = listPage("journal", matches, journalPageSize);
  if (!page.some(({ id }) => id === journalSelection && state.records[id])) {
    journalSelection = page.find(({ id }) => state.records[id])?.id ?? null;
  }
  const entries = page.map(({ id, mineral, index }) => {
    const found = Boolean(state.records[id]);
    const row = element("li", "journal-entry");
    row.dataset.slot = index + 1;
    row.dataset.discovered = found;
    const slot = found ? button("") : element("div");
    slot.className = "journal-slot";
    const number = "#" + String(index + 1).padStart(3, "0");
    slot.append(element("span", "journal-number", number));
    if (found) {
      const icon = element("img");
      icon.src = sprite({ mineral: id });
      icon.alt = "";
      slot.dataset.mineral = id;
      slot.setAttribute("aria-pressed", String(id === journalSelection));
      slot.append(icon, element("strong", "journal-name", mineral.name));
    } else {
      row.setAttribute("aria-label", number + " · " + t("Unknown mineral"));
      slot.append(element("span", "journal-mystery", "?"));
    }
    row.append(slot);
    return row;
  });
  byId("journal-list").replaceChildren(...entries);
  renderJournalDetail();
  const progress = t`${discoveries}/${catalogue.length} discovered`;
  write("journal-progress", progress);
  const meter = byId("journal-meter");
  meter.max = catalogue.length;
  meter.value = discoveries;
  meter.setAttribute("aria-valuetext", progress);
}

function renderJournalDetail() {
  const record = state.records[journalSelection];
  byId("journal-species").hidden = !record;
  byId("journal-empty").hidden = Boolean(record);
  if (!record) {
    write("journal-empty", Object.keys(state.records).length ? "No discoveries on this page." : "Mine a mineral to reveal its collection entry.");
    return;
  }
  const mineral = data.minerals[journalSelection];
  write("journal-name", mineral.name);
  write("journal-rarity", mineral.rarity);
  byId("journal-rarity").dataset.rarity = mineral.rarity;
  byId("journal-raw").src = sprite({ mineral: journalSelection });
  byId("journal-polished").src = sprite({ mineral: journalSelection, polished: true });
  write("journal-purity", percent(record.purity));
  write("journal-weight", grams(record.weight));
  byId("journal-purity-meter").value = record.purity;
}

byId("journal-list").addEventListener("click", event => {
  const slot = event.target.closest("button[data-mineral]");
  if (!slot) return;
  journalSelection = slot.dataset.mineral;
  for (const entry of byId("journal-list").querySelectorAll("button")) {
    entry.setAttribute("aria-pressed", String(entry === slot));
  }
  renderJournalDetail();
  if (matchMedia("(max-width: 760px)").matches) byId("journal-species").scrollIntoView({ block: "start" });
});

const crewMembers = [{ name: "You", role: "Miner" }, ...mission.crew];
const crewBadges = crewMembers.map((member) => {
  const row = element("li");
  const badge = element("span");
  row.append(element("strong", "", `${t(member.name)} · ${t(member.role)}`), badge);
  byId("expedition-crew").append(row);
  return badge;
});

function renderExpedition() {
  const group = state.expedition;
  const complete = group?.phase === "complete" || group?.phase === "claimed";
  const active = group?.phase === "active";
  const currentStage = active ? mission.stages[group.stage] : undefined;
  write("expedition-stage", currentStage?.text ?? "Take a crew into Silver Fault to survey a silver seam and recover a sample.");
  byId("expedition-stages").replaceChildren(...mission.stages.map((stage, index) => {
    const row = element("li", "", stage.name);
    if (active && index === group.stage) row.setAttribute("aria-current", "step");
    if (complete || (active && index < group.stage)) row.dataset.done = "true";
    return row;
  }));
  byId("expedition-leave").hidden = group?.phase !== "lobby";
  tickExpedition();
}

function tickExpedition() {
  const group = state.expedition;
  const phase = group?.phase;
  const remaining = group ? Math.max(0, group.readyAt - Date.now()) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const access = state.stats.mined >= mission.minFinds;
  let type = "expedition-join";
  let text = "Join crew";
  let disabled = !access;
  let status = access ? "Ready to join the guild survey." : "Collect your first personal mining find to join.";

  if (phase === "lobby") {
    type = "expedition-depart";
    text = "Depart";
    disabled = remaining > 0;
    status = remaining ? t`Crew assembling · ${seconds}s` : "The full crew is ready to depart.";
  } else if (phase === "active") {
    type = group.worked ? "expedition-advance" : "expedition-contribute";
    const last = group.stage === mission.stages.length - 1;
    text = group.worked ? (last ? "Finish survey" : "Next stage") : mission.stages[group.stage].action;
    disabled = group.worked && remaining > 0;
    const step = t`Stage ${group.stage + 1}/${mission.stages.length}`;
    status = !group.worked ? t`${step} · Your action is needed.` :
      (remaining ? t`${step} · Crew working · ${seconds}s` : t`${step} · Crew finished.`);
  } else if (phase === "claimed") {
    text = StrideCommunity.text("Join another survey", "Participar noutra expedição");
    status = "Reward claimed";
  } else if (phase === "complete") {
    type = "expedition-claim";
    text = "Claim reward";
    disabled = false;
    status = "Silver Fault Survey complete.";
  }
  const control = byId("expedition-button");
  control.dataset.action = type;
  if (control.textContent !== t(text)) control.textContent = t(text);
  control.disabled = disabled;
  if (byId("expedition-status").textContent !== t(status)) write("expedition-status", status);
  crewBadges.forEach((badge, index) => {
    const ready = Boolean(group) && (index === 0 ?
      (phase !== "active" || group.worked) : remaining <= crewMembers[index].leadSeconds * 1000);
    const label = !group ? "Waiting" : phase === "lobby" ? (ready ? "Ready" : "Joining") :
      (ready ? "Contributed" : index === 0 ? "Action needed" : "Working");
    if (badge.textContent !== t(label)) badge.textContent = t(label);
    badge.dataset.ready = String(ready);
  });
}

function render() {
  const usingPigmentAction = byId("pigment-actions").contains(document.activeElement);
  renderMural();
  renderCharacter();
  const rank = rules.rank(state);
  write("rank-progress", t`${rank.name} · ${rank.xp} total XP`);
  write("coins", t`${state.coins} coins`);
  write("gear-coins", t`${state.coins} coins`);
  renderMine();
  renderFind();
  renderCollection();
  if (usingPigmentAction && gameGrid.dataset.view === "home") byId("find-context").focus({ preventScroll: true });
  if (gameGrid.dataset.view === "workshop") {
    renderRecipes();
    renderPalette();
    renderGear();
  }
  renderMissions();
  renderContracts();
  if (gameGrid.dataset.view === "journal") renderJournal();
  renderExpedition();
  write("save-status", storageOn ? "Progress is stored in this browser." : "Progress lasts while this tab is open.");
}

function renderExperience(rank, meterId, textId) {
  const meter = byId(meterId);
  meter.max = rank.next === undefined ? 1 : rank.next - rank.start;
  meter.value = rank.next === undefined ? 1 : rank.xp - rank.start;
  const experience = rank.next === undefined ? t`Max level · ${rank.xp} XP` : t`${meter.value}/${meter.max} XP`;
  write(textId, experience);
  meter.setAttribute("aria-valuetext", experience);
}

const starterLook = { name: "", skin: "Ochre", hair: "Long braid", face: "Freckles", jacket: "Field jacket", hat: "Miner’s cap", scarf: "undyed" };
const slotLabels = { skin: "Skin tone", hair: "Hair", face: "Face", jacket: "Clothing", hat: "Headwear" };
const wardrobe = byId("wardrobe-form");
for (const [slot, choices] of Object.entries(rules.styles)) {
  const label = element("label");
  const control = element("select");
  control.id = "look-" + slot;
  control.replaceChildren(...choices.map((choice) => option(choice, choice === "Field jacket" ? "Field shirt" : choice)));
  label.append(element("span", "", slotLabels[slot]), control);
  byId("look-options").append(label);
}
function prepareDyes() {
  const unlocked = new Set(state.scarfDyes);
  const groups = ["Unlocked dyes", "Pigments in stock", "Preview colours"].map(label => {
    const group = element("optgroup");
    group.label = t(label);
    return group;
  });
  const pigments = Object.entries(data.pigments).sort(([, a], [, b]) => t(a.name).localeCompare(t(b.name), language));
  for (const [id, pigment] of pigments) {
    const group = unlocked.has(id) ? 0 : amount(state.pigments, id) > 0 ? 1 : 2;
    groups[group].append(option(id, pigment.name));
  }
  const available = groups.filter(group => group.children.length);
  byId("scarf-dye").replaceChildren(option("undyed", "Natural linen"), ...available.map(group => group.cloneNode(true)));
  byId("cloth-dye").replaceChildren(option("undyed", "Undyed fabric"), ...available);
}

function selectGarmentDye() {
  byId("cloth-dye").value = state.character?.clothDyes?.[byId("look-jacket").value] ?? "undyed";
}

function openWardrobe() {
  prepareDyes();
  const look = state.character ?? starterLook;
  draftBackground = state.background;
  byId("character-name").value = look.name;
  for (const slot of Object.keys(rules.styles)) byId("look-" + slot).value = look[slot];
  byId("scarf-dye").value = look.scarf;
  byId("wardrobe-feedback").hidden = true;
  selectGarmentDye();
  if (previewDye) {
    byId("cloth-dye").value = previewDye;
    previewDye = null;
  }
  renderBackgroundPicker();
  previewOutfit();
}

function readOutfit() {
  const look = { name: byId("character-name").value.trim(), scarf: byId("scarf-dye").value, cloth: byId("cloth-dye").value };
  for (const slot of Object.keys(rules.styles)) look[slot] = byId("look-" + slot).value;
  return look;
}

const backgroundImages = new Map();
function completedBackground(background) {
  const mural = rules.backgroundMural(state, data, background);
  if (!mural) return null;
  const key = JSON.stringify([mural.id, Object.keys(mural.needs)]);
  if (!backgroundImages.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = mural.gridSize * 4;
    const filled = {};
    for (const [id, cells] of Object.entries(mural.needs)) {
      for (const [x, y] of cells) filled[y * mural.gridSize + x] = id;
    }
    drawPlayableMural(canvas.getContext("2d"), mural, data.pigments, filled, null, false);
    backgroundImages.set(key, canvas);
  }
  return backgroundImages.get(key);
}

function drawLook(canvas, look, backgroundId = state.background, portrait = false) {
  const cloth = look.cloth ?? look.clothDyes?.[look.jacket];
  const background = completedBackground(backgroundId);
  const carry = data.tools[state.equipped].carry ?? state.equipped;
  globalThis.drawStrideCharacter(canvas, look, data.pigments[look.scarf]?.color ?? "#d8b48b", carry, portrait, data.pigments[cloth]?.color, background)
    .catch(() => announce("The character art could not be loaded."));
}

function previewOutfit() {
  const look = readOutfit();
  drawLook(byId("outfit-preview"), look, draftBackground);
  write("wardrobe-tool", data.tools[state.equipped].name);
  const unlocks = rules.newOutfitDyes(state, look);
  write("dye-cost", unlocks.length ? unlocks.map(id =>
    t`Unlock for 1 × ${data.pigments[id].name}. In stock: ${amount(state.pigments, id)}.`).join(" ") : "These colours are free to wear.");
  byId("save-outfit").disabled = !look.name || unlocks.some(id => !amount(state.pigments, id));
}

function renderProfile() {
  const rank = rules.rank(state);
  drawLook(byId("profile-avatar"), state.character ?? starterLook, state.background, true);
  byId("profile-name").textContent = state.character?.name ?? t("New miner");
  write("profile-level", t`Level ${rank.level}`);
  renderExperience(rank, "profile-meter", "profile-xp");
}

function renderCharacter() {
  renderProfile();
  if (gameGrid.dataset.view === "edit-character") {
    renderBackgroundPicker();
    previewOutfit();
  }
}

byId("look-jacket").addEventListener("input", selectGarmentDye);
byId("character-background").addEventListener("change", event => {
  draftBackground = event.target.value;
  byId("wardrobe-feedback").hidden = true;
  updateBackgroundLink();
  previewOutfit();
});
byId("equip-mural").addEventListener("click", async () => {
  const id = rules.muralBoard(state, data, muralScope).mural.id;
  await run({ type: "background", background: id });
  if (state.background === id) location.hash = "home";
});
byId("next-personal-mural").addEventListener("click", () => run({ type: "new-personal-mural" }));
byId("background-mural-link").addEventListener("click", event => {
  const archive = state.personalHistory[draftBackground] ?? StrideCommunity.allBoards(state, data).find(entry => entry.mural.id === draftBackground && StrideCommunity.complete(entry));
  if (!archive) return;
  event.preventDefault();
  write("archived-mural-name", archive.mural.name);
  const sheet = byId("archived-mural");
  drawPlayableMural(sheet.querySelector("canvas").getContext("2d"), archive.mural, data.pigments, archive.filledPixels);
  sheet.showModal();
});
wardrobe.addEventListener("input", () => {
  byId("wardrobe-feedback").hidden = true;
  previewOutfit();
});
async function saveOutfit() {
  if (!wardrobe.reportValidity() || byId("save-outfit").disabled) return;
  const saved = await run({ type: "wardrobe", look: readOutfit(), background: draftBackground });
  if (gameGrid.dataset.view !== "edit-character") return;
  if (saved) {
    location.hash = "home";
  } else {
    write("wardrobe-feedback", byId("feedback").textContent);
    byId("wardrobe-feedback").hidden = false;
  }
}
byId("save-outfit").addEventListener("click", saveOutfit);
wardrobe.addEventListener("submit", (event) => {
  event.preventDefault();
  saveOutfit();
});
byId("character-name").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  saveOutfit();
});

function ask(action, title, copy, confirm) {
  pendingAction = action;
  write("action-title", title);
  write("action-copy", copy);
  write("action-confirm", confirm);
  dialog.showModal();
}

function onChoice(id, attribute, handler) {
  byId(id).addEventListener("click", (event) => {
    const target = event.target.closest(`[data-${attribute}]`);
    if (target && !target.disabled) handler(target.getAttribute(`data-${attribute}`), target);
  });
}

byId("compare-pick").addEventListener("change", renderGearComparison);
byId("mine-button").addEventListener("click", () => run({ type: state.mining ? "collect" : "mine" }));
byId("expedition-button").addEventListener("click", (event) => run({ type: event.currentTarget.dataset.action }));
byId("expedition-leave").addEventListener("click", () => run({ type: "expedition-leave" }));

function inspectSpecimen(id) {
  selected = id;
  inspectedPigment = null;
  renderFind();
  renderCollection();
  focusInspector();
}

function focusInspector() {
  byId("find").scrollIntoView({ block: "nearest" });
  byId("find-context").focus({ preventScroll: true });
}

onChoice("specimens", "specimen", id => inspectSpecimen(Number(id)));
onChoice("pigment-stock", "stock-pigment", id => {
  inspectedPigment = id;
  renderFind();
  renderCollection();
  focusInspector();
});
function navigateSlots(event) {
  const cells = [...event.currentTarget.querySelectorAll("button")];
  const current = cells.indexOf(event.target);
  if (current < 0) return;
  const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.split(" ").length;
  const positions = {
    ArrowLeft: current - 1, ArrowRight: current + 1, ArrowUp: current - columns,
    ArrowDown: current + columns, Home: 0, End: cells.length - 1,
  };
  if (!Object.hasOwn(positions, event.key)) return;
  event.preventDefault();
  cells[Math.min(cells.length - 1, Math.max(0, positions[event.key]))].focus();
}
byId("specimens").addEventListener("keydown", navigateSlots);
byId("pigment-stock").addEventListener("keydown", navigateSlots);
byId("show-latest-find").addEventListener("click", () => inspectSpecimen(state.latest));
for (const tab of inventoryTabs) tab.addEventListener("click", () => setInventoryTab(tab.dataset.inventoryTab, true));
byId("inventory-tabs").addEventListener("keydown", event => {
  const current = inventoryTabs.indexOf(event.target);
  if (current < 0) return;
  let index;
  if (event.key === "Home") index = 0;
  else if (event.key === "End") index = inventoryTabs.length - 1;
  else if (event.key === "ArrowLeft") index = (current - 1 + inventoryTabs.length) % inventoryTabs.length;
  else if (event.key === "ArrowRight") index = (current + 1) % inventoryTabs.length;
  else return;
  event.preventDefault();
  const tab = inventoryTabs[index];
  setInventoryTab(tab.dataset.inventoryTab, true);
  tab.focus();
});
onChoice("pigments", "pigment", (id) => {
  selectedPigment = id;
  selectedPixel = rules.nextMuralPixel(state, data, id, muralScope);
  renderMural();
  byId("pigments").querySelector("[aria-pressed=true]").focus({ preventScroll: true });
});
onChoice("recipe-list", "recipe", (recipe) => run({ type: "mix", recipe }));
for (const [key, renderList, controls] of [
  ["journal", renderJournal, ["journal-query", "journal-discovered"]],
  ["recipe", renderRecipes, ["recipe-query", "recipe-ready"]],
  ["palette", renderPalette, ["palette-query", "palette-source"]],
]) {
  for (const id of controls) byId(id).addEventListener("input", () => {
    listPages[key] = 0;
    renderList();
  });
}
byId("mine-odds").closest("details").addEventListener("toggle", renderOdds);
byId("palette-book").addEventListener("toggle", renderPalette);
onChoice("pigment-actions", "recipe", (recipe) => run({ type: "mix", recipe }));
onChoice("pigment-actions", "dye", (pigment) => {
  previewDye = pigment;
  location.hash = "edit-character";
});
onChoice("tool-list", "tool", (tool) => run({ type: state.owned.includes(tool) ? "equip" : "buy", tool }));
onChoice("mission-list", "mission", (mission) => run({ type: "claim", mission }));
onChoice("pigment-actions", "place", (pigment, target) => run({ type: "paint", pigment, scope: target.dataset.scope }));
byId("paint-button").addEventListener("click", () => run({ type: "paint", pigment: muralTargets[selectedPixel], pixel: selectedPixel, scope: muralScope, boardId: rules.muralBoard(state, data, muralScope).mural.id }));
byId("wash-brush").addEventListener("click", () => {
  const board = rules.muralBoard(state, data, muralScope);
  const pigment = muralTargets[selectedPixel];
  const units = rules.brushStroke(board, pigment, selectedPixel).length;
  if (units < 2) return;
  ask({ type: "wash-brush", pigment, pixel: selectedPixel, scope: muralScope, boardId: board.mural.id, units },
    "Wide brush", t`Paint ${units} consecutive pixels to the right using ${units} × ${data.pigments[pigment].name}?`, "Apply pigment");
});
byId("polish-button").addEventListener("click", () => {
  const item = current();
  if (item) run({ type: "polish", id: item.id });
});
byId("protect-button").addEventListener("click", () => {
  const item = current();
  if (item) run({ type: "toggle-protection", id: item.id });
});
byId("finish-button").addEventListener("click", () => {
  const item = current();
  if (!item) return;
  ask({ type: "finish", id: item.id }, "Apply high-gloss finish?",
    t`Finish ${data.minerals[item.mineral].name} using 1 unit of Diamond Powder.`, "Apply finish");
});
byId("crush-button").addEventListener("click", () => {
  const item = current();
  if (!item) return;
  const mineral = data.minerals[item.mineral];
  const output = rules.crushOutput(item, data);
  if (!output) return;
  const { name, amount, material } = output;
  ask({ type: "crush", id: item.id }, "Crush this specimen?",
    t`${mineral.name} will be consumed to make ${amount} × ${name}.`, material ? "Crush for powder" : "Crush for pigment");
});
byId("sell-button").addEventListener("click", () => {
  const item = current();
  if (!item) return;
  ask({ type: "sell", id: item.id }, "Sell this specimen?",
    t`${data.minerals[item.mineral].name} will leave your collection for ${rules.salePrice(item, data)} coins.`, "Sell specimen");
});
byId("reset-button").addEventListener("click", () => ask(
  { type: "reset" }, "Reset the local playtest?", "This clears your character, wardrobe, collection, journal, equipment, contracts, expedition and mural progress.", "Reset progress"
));
byId("action-cancel").addEventListener("click", () => {
  pendingAction = null;
  dialog.close();
});
byId("action-confirm").addEventListener("click", () => {
  if (!pendingAction) return;
  const action = pendingAction;
  pendingAction = null;
  dialog.close();
  run(action);
});
dialog.addEventListener("cancel", () => { pendingAction = null; });
window.addEventListener("storage", (event) => {
  if (event.key === storageKey) {
    state = readSave(state);
    render();
  }
});

document.documentElement.lang = language;
document.title = t(document.title);
for (const node of document.querySelectorAll("[data-text]")) node.textContent = t(node.textContent);
for (const node of document.querySelectorAll("[aria-label]")) node.setAttribute("aria-label", t(node.getAttribute("aria-label")));
if (language === "pt-PT") {
  const switchLink = byId("language-switch");
  switchLink.setAttribute("href", "?lang=en");
  switchLink.lang = switchLink.hreflang = "en";
  switchLink.textContent = "English";
  for (const guide of document.querySelectorAll("[data-guide]")) {
    guide.setAttribute("href", `play-guide.pt-PT.html${guide.hash}`);
  }
}
window.addEventListener("hashchange", showGameView);
window.addEventListener("pageshow", () => {
  const hash = location.hash;
  if (hash !== "#home" && hash !== "#watch" && hash !== "#edit-character" && hash !== "#journal") return;
  requestAnimationFrame(() => {
    if (location.hash === hash) window.scrollTo(0, 0);
  });
}, { once: true });
showGameView();
const expeditionArt = byId("expedition-art");
expeditionArt.src = mission.art;
expeditionArt.alt = t(expeditionArt.alt);
write("expedition-name", mission.name);
write("expedition-loot", t`Reward · ${data.minerals[mission.reward.mineral].name} specimen + ${mission.reward.coins} coins`);
render();
setInterval(() => {
  tickMining();
  tickExpedition();
}, 250);
