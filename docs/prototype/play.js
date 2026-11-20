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
const dialog = byId("action-dialog");
const mineSelect = byId("mine-select");
const routeSelect = byId("route-select");
let storageOn = true;
let lockingOn = true;
let state = readSave(rules.create(data));
let selected = state.latest;
let selectedPigment = Object.keys(data.mural.needs)[0];
let pendingAction;

function announce(message) {
  write("feedback", message);
}

function readSave(fallback) {
  if (storageOn) {
    try {
      return rules.restore(localStorage.getItem(storageKey), data, fallback);
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
  const applyAction = () => {
    try {
      state = readSave(state);
      if (action.type === "reset") {
        state = { ...rules.create(data), nextId: state.nextId };
        selected = null;
        selectedPigment = Object.keys(data.mural.needs)[0];
        announce("A new playtest has started.");
      } else {
        const consumed = action.type === "crush" ? state.items.find((item) => item.id === action.id) : undefined;
        const result = rules.apply(state, data, action);
        state = result.state;
        if (["mine", "collect", "expedition-claim"].includes(action.type)) selected = state.latest;
        if (consumed) {
          const pigment = data.minerals[consumed.mineral].pigment;
          if (Object.hasOwn(data.mural.needs, pigment)) selectedPigment = pigment;
        }
        if (action.type === "mix" && Object.hasOwn(data.mural.needs, action.recipe)) selectedPigment = action.recipe;
        if (result.message) announce(result.message);
      }
      save();
    } catch (error) {
      announce(error.message);
    }
    render();
  };
  if (storageOn && lockingOn && navigator.locks) {
    let started = false;
    return navigator.locks.request(storageKey, () => {
      started = true;
      return applyAction();
    }).catch((error) => {
      if (started) return announce(error.message);
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

function current() {
  return state.items.find((item) => item.id === selected);
}

function pickNeeded(power) {
  return Object.values(data.tools).find((tool) => tool.power === power)?.name;
}

function renderRoute() {
  const route = data.routes[state.route];
  const mine = data.mines[route.mine];
  mineSelect.value = route.mine;
  routeSelect.replaceChildren(...Object.entries(data.routes).filter(([, entry]) => entry.mine === route.mine)
    .map(([id, entry]) => option(id, entry.power > data.tools[state.equipped].power ? t`${t(entry.name)} · Locked` : entry.name)));
  routeSelect.value = state.route;
  byId("mine").style.setProperty("--mine-art", `url("${new URL(mine.art, document.baseURI).href}")`);
  write("mine-title", mine.name);
  write("mine-district", mine.district);
  write("equipped-pick", data.tools[state.equipped].name);
  const possible = [...new Set(route.finds)].map((id) => t(data.minerals[id].name)).join(" · ");
  const requirement = route.power > data.tools[state.equipped].power ? t`Requires ${t(pickNeeded(route.power))}` : "";
  write("route-info", [requirement, possible, t`${route.seconds}s between strikes`].filter(Boolean).join(" · "));
  tickMining();
}

function tickMining() {
  const control = byId("mine-button");
  const cooldown = Math.max(0, state.mineReadyAt - Date.now());
  byId("mining-status").hidden = !state.mining && !cooldown;
  byId("mining-meter").hidden = !state.mining;
  if (!state.mining) {
    const locked = data.routes[state.route].power > data.tools[state.equipped].power;
    control.disabled = locked || cooldown > 0;
    control.textContent = t(locked ? "Seam locked" : "Mine seam");
    const label = cooldown ? t`Ready to mine again in ${Math.ceil(cooldown / 1000)}s` : "";
    if (byId("mining-label").textContent !== label) write("mining-label", label);
    return;
  }
  const route = data.routes[state.mining.route];
  const remaining = Math.max(0, state.mining.endsAt - Date.now());
  const label = remaining ? t`${t(route.name)} · ${Math.ceil(remaining / 1000)}s remaining` : t`${t(route.name)} · Find ready`;
  if (byId("mining-label").textContent !== label) write("mining-label", label);
  byId("mining-meter").value = Math.max(0, 1 - remaining / (route.seconds * 1000));
  control.disabled = remaining > 0;
  control.textContent = t(remaining > 0 ? "Mining…" : "Collect find");
}

function renderFind() {
  if (!current()) selected = state.items.find((item) => item.id === state.latest)?.id ?? state.items[0]?.id;
  const item = current();
  byId("find-details").hidden = !item;
  byId("empty-find").hidden = Boolean(item);
  byId("find-rarity").hidden = !item;
  if (!item) {
    write("find-context", "Latest find");
    write("find-name", "Your next find");
    return;
  }
  const mineral = data.minerals[item.mineral];
  const record = state.records[item.mineral] ?? item;
  const finish = item.polished ? "Polished" : "Raw";
  const image = byId("find-sprite");
  image.setAttribute("src", sprite(item));
  image.alt = `${t(mineral.name)} · ${t(finish)}`;
  image.parentElement.style.setProperty("--purity", item.purity / 10000);
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
  byId("crush-button").disabled = item.polished;
  write("sell-button", t`Sell · ${rules.salePrice(item, data)}`);
}

function renderCollection() {
  const items = state.items.map((item) => {
    const mineral = data.minerals[item.mineral];
    const stateLabel = item.polished ? "Polished" : "Raw";
    const control = button("");
    control.dataset.specimen = item.id;
    control.dataset.state = stateLabel;
    control.setAttribute("aria-pressed", String(item.id === selected));
    control.setAttribute("aria-label", t`${mineral.name}, ${t(stateLabel)}, ${percent(item.purity)} purity, ${grams(item.weight)}`);
    const icon = element("span", "specimen-icon");
    icon.style.backgroundImage = `url("${sprite(item)}")`;
    icon.style.filter = `contrast(${.64 + item.purity / 10000 * .57})`;
    control.append(icon, element("span", "title", mineral.name), element("span", "specimen-meta", percent(item.purity)));
    return control;
  });
  byId("specimens").replaceChildren(...items);
  byId("empty-collection").hidden = items.length > 0;
  write("collection-count", `${items.length} ${t(items.length === 1 ? "piece" : "pieces")}`);
  const latest = state.items.find((item) => item.id === state.latest && !item.origin);
  write("mine-inventory-link", latest ? t`${data.minerals[latest.mineral].name} added · Inventory (${items.length})` : t`Inventory · ${items.length}`);

  const pigments = Object.entries(data.pigments).filter(([id]) => amount(state.pigments, id) > 0).map(([id, pigment]) => {
    const chip = element("li", "stock-pigment");
    chip.dataset.stockPigment = id;
    chip.append(swatch(element("span", "swatch"), pigment), element("span", "stock-name", pigment.name),
      element("strong", "stock-quantity", `×${amount(state.pigments, id)}`));
    return chip;
  });
  byId("pigment-stock").replaceChildren(...pigments);
  byId("empty-pigment-stock").hidden = pigments.length > 0;
}

function swatch(node, pigment) {
  node.style.setProperty("--pigment", pigment.color);
  node.setAttribute("aria-hidden", "true");
  return node;
}

function renderMural() {
  const progress = rules.muralProgress(state, data);
  const art = {};
  const left = {};
  const rows = Object.entries(data.mural.needs).map(([id, patches]) => {
    const pigment = data.pigments[id];
    const remaining = patches.length - amount(state.painted, id);
    art[id] = { ...pigment, patches };
    left[id] = remaining;
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
  write("mural-progress", `${progress.percent}%`);
  write("mural-status", progress.left ? t`${progress.left} ${t(progress.left === 1 ? "patch" : "patches")} to paint` : "Mural complete");
  byId("paint-button").disabled = !amount(state.pigments, selectedPigment) || !left[selectedPigment];
  write("paint-button", left[selectedPigment] ? "Apply pigment" : "Color complete");
  byId("mural-canvas").setAttribute("aria-label", t`Copperwing mural, ${progress.percent}% complete`);
  drawPlayableCopperwing(muralContext, art, left);
}

function renderRecipes() {
  const rows = Object.entries(data.recipes).map(([id, recipe]) => {
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
  });
  byId("recipe-list").replaceChildren(...rows);
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
}

function renderMissions() {
  const rows = Object.entries(data.missions).map(([id, mission]) => {
    const progress = Math.min(state.stats[mission.metric], mission.goal);
    const claimed = state.claimed.includes(id);
    const row = element("div", "work-row mission-row");
    const detail = element("span");
    detail.append(element("strong", "", mission.name), element("small", "", mission.text),
      element("small", "", t`${progress}/${mission.goal} · ${mission.coins} coins`));
    const claim = button(claimed ? "Claimed" : "Claim", claimed || progress < mission.goal);
    claim.dataset.mission = id;
    row.append(detail, claim);
    return row;
  });
  byId("mission-list").replaceChildren(...rows);
}

function renderContracts() {
  const contracts = Object.entries(data.contracts);
  const rows = contracts.map(([id, contract]) => {
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
  });
  byId("contract-list").replaceChildren(...rows);
  write("contract-progress", t`${state.contracts.length}/${contracts.length} complete`);
}

function renderJournal() {
  const discoveries = Object.entries(state.records).sort(([a], [b]) =>
    t(data.minerals[a].name).localeCompare(t(data.minerals[b].name), language));
  const entries = discoveries.map(([id, record]) => {
    const mineral = data.minerals[id];
    const row = element("li", "journal-entry");
    const icon = element("img");
    icon.src = sprite({ mineral: id });
    icon.alt = "";
    icon.width = icon.height = 24;
    icon.loading = "lazy";
    const detail = element("div");
    detail.append(element("strong", "", mineral.name), element("small", "", t`${percent(record.purity)} best · ${grams(record.weight)} heaviest`));
    row.append(icon, detail);
    return row;
  });
  byId("journal-list").replaceChildren(...entries);
  write("journal-progress", t`${entries.length}/${Object.keys(data.minerals).length} discovered`);
}

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
  } else if (phase === "complete" || phase === "claimed") {
    type = "expedition-claim";
    text = phase === "claimed" ? "Reward claimed" : "Claim reward";
    disabled = phase === "claimed";
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
  const rank = rules.rank(state);
  write("rank", t`${t(rank.name)} · Lv ${rank.level}`);
  write("rank-progress", rank.next === undefined ? t`${rank.xp} XP` : t`${rank.xp}/${rank.next} XP`);
  write("coins", t`${state.coins} coins`);
  write("gear-coins", t`${state.coins} coins`);
  renderRoute();
  renderFind();
  renderCollection();
  renderMural();
  renderRecipes();
  renderGear();
  renderMissions();
  renderContracts();
  renderJournal();
  renderExpedition();
  write("save-status", storageOn ? "Progress is stored in this browser." : "Progress lasts while this tab is open.");
}

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
    if (target && !target.disabled) handler(target.dataset[attribute], target);
  });
}

mineSelect.replaceChildren(...Object.entries(data.mines).map(([id, mine]) => option(id, mine.name)));
mineSelect.addEventListener("change", () => {
  const route = Object.keys(data.routes).find((id) => data.routes[id].mine === mineSelect.value);
  run({ type: "select", route });
});
routeSelect.addEventListener("change", () => run({ type: "select", route: routeSelect.value }));
byId("mine-button").addEventListener("click", () => run({ type: state.mining ? "collect" : "mine" }));
byId("expedition-button").addEventListener("click", (event) => run({ type: event.currentTarget.dataset.action }));
byId("expedition-leave").addEventListener("click", () => run({ type: "expedition-leave" }));

onChoice("specimens", "specimen", (id, target) => {
  selected = Number(id);
  renderFind();
  for (const control of byId("specimens").children) control.setAttribute("aria-pressed", String(control === target));
  if (window.matchMedia("(max-width: 710px)").matches) byId("find").scrollIntoView({ block: "start" });
});
onChoice("pigments", "pigment", (id) => {
  selectedPigment = id;
  renderMural();
  byId("pigments").querySelector("[aria-pressed=true]").focus({ preventScroll: true });
});
onChoice("recipe-list", "recipe", (recipe) => run({ type: "mix", recipe }));
onChoice("tool-list", "tool", (tool) => run({ type: state.owned.includes(tool) ? "equip" : "buy", tool }));
onChoice("mission-list", "mission", (mission) => run({ type: "claim", mission }));
byId("paint-button").addEventListener("click", () => run({ type: "paint", pigment: selectedPigment }));
byId("polish-button").addEventListener("click", () => {
  const item = current();
  if (item) run({ type: "polish", id: item.id });
});
byId("crush-button").addEventListener("click", () => {
  const item = current();
  if (!item) return;
  const mineral = data.minerals[item.mineral];
  const pigment = data.pigments[mineral.pigment].name;
  ask({ type: "crush", id: item.id }, "Crush this specimen?",
    t`${mineral.name} will be consumed to make ${rules.yieldFrom(item)} × ${pigment}.`, "Crush for pigment");
});
byId("sell-button").addEventListener("click", () => {
  const item = current();
  if (!item) return;
  ask({ type: "sell", id: item.id }, "Sell this specimen?",
    t`${data.minerals[item.mineral].name} will leave your collection for ${rules.salePrice(item, data)} coins.`, "Sell specimen");
});
byId("reset-button").addEventListener("click", () => ask(
  { type: "reset" }, "Reset the local playtest?", "This clears the collection, journal, equipment, contracts, expedition and mural progress.", "Reset progress"
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
