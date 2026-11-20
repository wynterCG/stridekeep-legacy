"use strict";

(() => {
  const data = globalThis.StrideData;
  const rules = globalThis.StrideRules;
  const { t } = globalThis.StrideLocale;
  const example = document.getElementById("mural-example");
  const context = document.getElementById("mural-example-canvas").getContext("2d");
  const status = document.getElementById("mural-example-status");
  const button = document.getElementById("mural-example-paint");
  const applyLabel = button.textContent;
  const pigment = "mintwash";
  const initial = rules.create(data);
  initial.pigments[pigment] = 1;
  let state = initial;

  function render() {
    const stock = state.pigments[pigment];
    drawPlayableCopperwing(context, data.mural, data.pigments, state.painted);
    status.textContent = `${t(data.pigments[pigment].name)} ×${stock} · ${rules.muralProgress(state, data).percent}%`;
    button.textContent = stock ? applyLabel : button.dataset.reset;
  }

  button.addEventListener("click", () => {
    state = state.pigments[pigment] ? rules.apply(state, data, { type: "paint", pigment }).state : initial;
    render();
  });
  render();
  example.hidden = false;
})();
