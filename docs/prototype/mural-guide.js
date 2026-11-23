"use strict";

(() => {
  const data = globalThis.StrideData;
  const rules = globalThis.StrideRules;
  const { t } = globalThis.StrideLocale;
  const pt = document.documentElement.lang === "pt-PT";
  const key = text => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  const sources = new Map(Object.values(data.minerals).filter(mineral => mineral.pigment)
    .map(mineral => [mineral.pigment, t(mineral.name)]));

  function swatch(id) {
    const chip = document.createElement("span");
    chip.className = "guide-swatch";
    chip.setAttribute("aria-hidden", "true");
    chip.style.backgroundColor = data.pigments[id].color;
    return chip;
  }

  const pigmentList = document.getElementById("guide-pigment-table");
  if (pigmentList) {
    const filter = document.getElementById("guide-pigment-filter");
    const disclosure = pigmentList.closest("details");
    const table = document.createElement("table");
    const columns = table.createTHead().insertRow();
    heading(columns, pt ? "Cor" : "Colour", "col");
    heading(columns, pt ? "Mineral em bruto" : "Raw mineral", "col");
    const rows = table.createTBody();
    const colours = Array.from(sources, ([id, mineral]) => ({ id, mineral, name: t(data.pigments[id].name) }))
      .sort((a, b) => a.name.localeCompare(b.name, document.documentElement.lang));
    function showPigments() {
      if (!disclosure.open) return;
      const query = key(filter.value);
      rows.replaceChildren();
      for (const { id, mineral, name } of colours) {
        if (!key(name + " " + mineral).includes(query)) continue;
        const row = rows.insertRow();
        heading(row, name, "row");
        row.cells[0].prepend(swatch(id));
        row.insertCell().textContent = mineral;
      }
      if (!rows.rows.length) rows.insertRow().insertCell().textContent = t("No results");
    }
    disclosure.addEventListener("toggle", showPigments);
    filter.addEventListener("input", showPigments);
    pigmentList.append(table);
    showPigments();
  }
  const missions = document.getElementById("guide-missions");
  if (missions) {
    const table = document.createElement("table");
    const columns = table.createTHead().insertRow();
    for (const label of (pt ? ["Nível", "Objetivo", "Moedas"] : ["Level", "Objective", "Coins"])) {
      heading(columns, label, "col");
    }
    const rows = table.createTBody();
    for (const mission of Object.values(data.missions).sort((a, b) => (a.level ?? 1) - (b.level ?? 1))) {
      const row = rows.insertRow();
      row.insertCell().textContent = mission.level ?? 1;
      heading(row, t(mission.name), "row");
      const goal = document.createElement("div");
      goal.textContent = t(mission.text);
      row.cells[1].append(goal);
      row.insertCell().textContent = mission.coins;
    }
    missions.append(table);
  }
  const book = document.getElementById("guide-recipe-book");
  if (book) {
    const table = document.createElement("table");
    const columns = table.createTHead().insertRow();
    heading(columns, pt ? "Cor" : "Colour", "col");
    heading(columns, pt ? "Ingredientes e origem" : "Ingredients and sources", "col");
    const rows = table.createTBody();
    const entries = Object.entries(data.recipes).sort(([, left], [, right]) =>
      t(left.name).localeCompare(t(right.name), document.documentElement.lang));
    for (const [id, recipe] of entries) {
      const row = rows.insertRow();
      row.id = "recipe-" + id;
      heading(row, t(recipe.name), "row");
      row.cells[0].prepend(swatch(id));
      const ingredients = row.insertCell();
      for (const [pigment, quantity] of Object.entries(recipe.ingredients)) {
        const line = document.createElement("div");
        const name = t(data.pigments[pigment].name);
        line.append(quantity + " × ");
        if (data.recipes[pigment]) {
          const link = document.createElement("a");
          link.href = "#recipe-" + pigment;
          link.textContent = name;
          line.append(link);
        } else {
          line.append(name + " · " + sources.get(pigment));
        }
        ingredients.append(line);
      }
    }
    book.append(table);
  }
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
