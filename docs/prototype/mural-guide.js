"use strict";

(() => {
  const data = globalThis.StrideData;
  const rules = globalThis.StrideRules;
  const { t } = globalThis.StrideLocale;
  const oddsPanel = document.getElementById("guide-pick-odds");
  const oddsTable = document.createElement("table");
  const pickaxes = Object.entries(data.tools);
  const percent = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 10 });
  const header = oddsTable.createTHead().insertRow();
  function heading(row, label, scope) {
    const cell = document.createElement("th");
    cell.scope = scope;
    cell.textContent = label;
    row.appendChild(cell);
  }
  heading(header, "Mineral", "col");
  heading(header, t("Find chances"), "col");
  const prices = document.getElementById("guide-pick-prices");
  const priceHeader = prices.createTHead().insertRow();
  for (const label of ["Pickaxe", "Price (coins)", "Rare or higher"]) heading(priceHeader, t(label), "col");
  const priceRows = prices.createTBody();
  const priceFormat = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 2 });
  for (const [id, pick] of pickaxes) {
    const chance = Object.entries(rules.miningOdds(data, id)).reduce((sum, [key, odds]) =>
      sum + (["Common", "Uncommon"].includes(data.minerals[key].rarity) ? 0 : odds), 0);
    const row = priceRows.insertRow();
    heading(row, t(pick.name), "row");
    row.insertCell().textContent = priceFormat.format(pick.cost);
    row.insertCell().textContent = priceFormat.format(chance) + "%";
  }
  const body = oddsTable.createTBody();
  const picker = document.createElement("select");
  for (const [id, pick] of pickaxes) picker.add(new Option(t(pick.name), id));
  const query = document.createElement("input");
  query.type = "search";
  for (const [control, title] of [[picker, "Pickaxe"], [query, "Mineral name"]]) {
    const label = document.createElement("label");
    label.append(t(title) + " ", control);
    const line = document.createElement("p");
    line.append(label);
    oddsPanel.append(line);
  }
  const key = text => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  function showOdds() {
    if (!oddsPanel.closest("details").open) return;
    const filter = key(query.value);
    body.replaceChildren();
    for (const [id, chance] of Object.entries(rules.miningOdds(data, picker.value))) {
      const name = t(data.minerals[id].name);
      if (!key(name).includes(filter)) continue;
      const row = body.insertRow();
      heading(row, name, "row");
      row.insertCell().textContent = percent.format(chance) + "%";
    }
    if (!body.rows.length) body.insertRow().insertCell().textContent = t("No results");
  }
  query.addEventListener("input", showOdds);
  picker.addEventListener("change", showOdds);
  oddsPanel.closest("details").addEventListener("toggle", showOdds);
  oddsPanel.appendChild(oddsTable);
  showOdds();

  const example = document.getElementById("mural-example");
  const context = document.getElementById("mural-example-canvas").getContext("2d");
  const status = document.getElementById("mural-example-status");
  const button = document.getElementById("mural-example-paint");
  const applyLabel = button.textContent;
  const pigment = "iron-red";
  const initial = rules.create(data);
  initial.pigments[pigment] = 1;
  let state = initial;

  function render() {
    const stock = state.pigments[pigment];
    drawPlayableMural(context, data.mural, data.pigments, state.filledPixels);
    const { filled, needed } = rules.muralProgress(state, data);
    status.textContent = `${t(data.pigments[pigment].name)} ×${stock} · ${filled}/${needed}`;
    button.textContent = stock ? applyLabel : button.dataset.reset;
  }

  button.addEventListener("click", () => {
    state = state.pigments[pigment] ? rules.apply(state, data, { type: "paint", pigment }).state : initial;
    render();
  });
  render();
  example.hidden = false;
})();
