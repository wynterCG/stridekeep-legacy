"use strict";

(() => {
  const data = globalThis.StrideData;
  const rules = globalThis.StrideRules;
  const { t } = globalThis.StrideLocale;
  const oddsPanel = document.getElementById("guide-pick-odds");
  const oddsTable = document.createElement("table");
  const pickaxes = Object.entries(data.tools);
  const distributions = pickaxes.map(([id]) => rules.miningOdds(data, id));
  const percent = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 6 });
  const header = oddsTable.createTHead().insertRow();
  function heading(row, label, scope) {
    const cell = document.createElement("th");
    cell.scope = scope;
    cell.textContent = label;
    row.appendChild(cell);
  }
  heading(header, "Mineral", "col");
  for (const [, pick] of pickaxes) heading(header, t(pick.name), "col");
  const body = oddsTable.createTBody();
  for (const id of Object.keys(distributions[0])) {
    const row = body.insertRow();
    heading(row, t(data.minerals[id].name), "row");
    for (const odds of distributions) row.insertCell().textContent = percent.format(odds[id]) + "%";
  }
  oddsPanel.appendChild(oddsTable);

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
