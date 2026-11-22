"use strict";

globalThis.StrideCommunityUI = (() => {
  const model = StrideCommunity;
  const tr = model.text;
  const node = (tag, content) => {
    const result = document.createElement(tag);
    if (content !== undefined) result.textContent = content;
    return result;
  };
  let labelCount = 0;
  const titled = (caption, control) => {
    const label = node("label");
    const name = node("span", caption);
    name.id = "guild-field-" + ++labelCount;
    control.setAttribute("aria-labelledby", name.id);
    label.append(name, control);
    return label;
  };
  const button = caption => {
    const element = node("button", caption);
    element.type = "button";
    return element;
  };
  let ui, current, catalog, dispatch, active, seed, art, sourceVersion = 0, lastPalette = "";
  let selected = new Set();
  const nameOf = label => globalThis.StrideLocale.t(label);
  const starter = () => Object.keys(catalog.mural.needs);
  const send = (type, fields) => dispatch({ type, group: active, ...fields });
  function options(select, entries, value) {
    const key = JSON.stringify(entries);
    if (select.dataset.options !== key) {
      select.replaceChildren(...entries.map(([id, label]) => new Option(label, id)));
      select.dataset.options = key;
    }
    if (value !== undefined) select.value = value;
  }
  function initialise(root) {
    const guild = node("select"), work = node("select"), contributions = node("small");
    const bar = node("div");
    bar.className = "guild-controls";
    bar.append(titled(tr("Community", "Comunidade"), guild), titled(tr("Mural", "Mural"), work), contributions);
    guild.onchange = () => send("community-select", { id: guild.value });
    work.onchange = () => send("community-work-select", { id: work.value });

    const groups = node("details"), name = node("input"), addGroup = button(tr("Create community", "Criar comunidade"));
    groups.append(node("summary", tr("Create a local community", "Criar uma comunidade local")));
    name.maxLength = 45;
    const groupForm = node("form");
    groupForm.className = "guild-controls";
    addGroup.type = "submit";
    groupForm.append(titled(tr("Community name", "Nome da comunidade"), name), addGroup);
    groups.append(groupForm);
    groupForm.onsubmit = async event => {
      event.preventDefault();
      if (await send("community-create", { name: name.value })) { name.value = ""; groups.open = false; }
    };

    const studio = node("details");
    studio.append(node("summary", tr("Create an illustrated mural", "Criar um mural ilustrado")));
    const editor = node("div");
    editor.className = "guild-editor";
    const fields = node("div"), source = node("select"), size = node("select"), title = node("input"), file = node("input");
    title.maxLength = 45;
    options(source, [
      ["flower", tr("Lantern blossom · detail", "Flor-lanterna · pormenor")],
      ["lotus", tr("Floating Lotus · full scene study", "Lótus Flutuante · estudo da cena completa")],
      ["file", tr("My illustration", "A minha ilustração")],
    ], "flower");
    options(size, model.sizes.map(n => [n, n + " × " + n]), "16");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    const fileLabel = titled(tr("PNG, JPEG or WebP · up to 5 MB", "PNG, JPEG ou WebP · até 5 MB"), file);
    fields.append(titled(tr("Illustration", "Ilustração"), source), fileLabel, titled(tr("Mural title", "Título do mural"), title), titled(tr("Painting grid", "Grelha de pintura"), size));
    const palette = node("fieldset"), swatches = node("div");
    palette.append(node("legend", tr("Allowed pigments", "Pigmentos permitidos")), node("small", tr("Discover minerals to add their colours and blends.", "Descobre minerais para acrescentar as suas cores e misturas.")), swatches);
    swatches.className = "guild-swatches";
    const backing = node("select");
    backing.onchange = draw;
    fields.append(palette, titled(tr("Free background colour", "Cor de fundo sem custo"), backing));
    const preview = node("div"), original = node("canvas"), canvas = node("canvas"), costs = node("ul"), status = node("p"), launch = button(tr("Start this mural", "Iniciar este mural"));
    launch.disabled = true;
    canvas.width = canvas.height = 192;
    original.width = original.height = 192;
    canvas.setAttribute("aria-label", tr("Preview in game colours", "Pré-visualização nas cores do jogo"));
    original.setAttribute("aria-label", tr("Original illustration", "Ilustração original"));
    status.setAttribute("role", "status");
    preview.className = "guild-preview";
    const comparison = node("div");
    comparison.className = "guild-comparison";
    for (const [picture, caption] of [[original, tr("Original", "Original")], [canvas, tr("In game colours", "Nas cores do jogo")]]) {
      const figure = node("figure");
      figure.append(picture, node("figcaption", caption));
      comparison.append(figure);
    }
    preview.append(comparison, status, costs, launch);
    editor.append(fields, preview);
    studio.append(editor);
    root.append(bar, groups, studio);
    ui = { root, guild, work, contributions, studio, source, file, fileLabel, title, size, swatches, backing, original, canvas, costs, status, launch };
    const changeSource = () => { loadImage(); };
    source.onchange = changeSource;
    file.onchange = changeSource;
    size.onchange = draw;
    title.oninput = () => { launch.disabled = !art || !ui.mural || !title.value.trim(); };
    studio.ontoggle = () => { if (studio.open && !art) loadImage(); };
    launch.onclick = async () => {
      if (!ui.mural) return;
      launch.disabled = true;
      if (await send("community-work-create", { mural: { ...ui.mural, name: title.value } })) {
        studio.open = false;
        ui.root.querySelector("select").focus();
      }
      draw();
    };
  }
  async function loadImage() {
    const version = ++sourceVersion;
    const local = ui.source.value === "file";
    const file = ui.file.files[0];
    ui.fileLabel.hidden = !local;
    art = null;
    ui.title.value = local ? (file?.name.replace(/\.[^.]+$/, "").slice(0, 45) ?? "") : ui.source.value === "flower"
      ? tr("Lantern blossom", "Flor-lanterna") : tr("Floating Lotus study", "Estudo do Lótus Flutuante");
    draw();
    if (local && !file) return;
    if (local && (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      ui.status.textContent = tr("Choose a PNG, JPEG or WebP up to 5 MB.", "Escolhe um PNG, JPEG ou WebP até 5 MB.");
      return;
    }
    const url = local ? URL.createObjectURL(file) : globalThis.StrideLotusArt[ui.source.value];
    try {
      const bitmap = new Image();
      bitmap.src = url;
      await bitmap.decode();
      if (version !== sourceVersion) return;
      if (bitmap.naturalWidth > 4096 || bitmap.naturalHeight > 4096) throw Error();
      art = bitmap;
      draw();
    } catch {
      if (version === sourceVersion) ui.status.textContent = tr("Choose a readable image up to 4096 × 4096.", "Escolhe uma imagem legível até 4096 × 4096.");
    } finally { if (local) URL.revokeObjectURL(url); }
  }
  function updatePalette() {
    const colors = model.availableColors(current, catalog).sort((a, b) => nameOf(catalog.pigments[a].name).localeCompare(nameOf(catalog.pigments[b].name)));
    const signature = JSON.stringify(colors);
    if (lastPalette === signature) return;
    lastPalette = signature;
    ui.swatches.replaceChildren(...colors.map(id => {
      const label = node("label"), check = node("input"), swatch = node("i");
      check.type = "checkbox";
      check.checked = selected.has(id);
      swatch.style.background = catalog.pigments[id].color;
      check.onchange = () => { if (check.checked) selected.add(id); else selected.delete(id); draw(); };
      label.append(check, swatch, node("span", nameOf(catalog.pigments[id].name)));
      return label;
    }));
  }
  function draw() {
    const { canvas, costs, launch, status, backing, original } = ui;
    const sourceCtx = original.getContext("2d");
    sourceCtx.clearRect(0, 0, original.width, original.height);
    if (art) {
      const scale = original.width / Math.max(art.naturalWidth, art.naturalHeight);
      const w = art.naturalWidth * scale, h = art.naturalHeight * scale;
      sourceCtx.drawImage(art, (original.width - w) / 2, (original.height - h) / 2, w, h);
    }
    const background = selected.has(backing.value) ? backing.value : "";
    options(backing, [["", tr("Transparent pixels only", "Apenas píxeis transparentes")], ...[...selected].map(id => [id, nameOf(catalog.pigments[id].name)])], background);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    costs.replaceChildren();
    ui.mural = null;
    launch.disabled = true;
    if (!art || !selected.size) {
      status.textContent = art ? tr("Choose at least one pigment.", "Escolhe pelo menos um pigmento.") : tr("Select an illustration to preview.", "Seleciona uma ilustração para a pré-visualizar.");
      return;
    }
    const gridSize = Number(ui.size.value), sample = node("canvas");
    sample.width = sample.height = gridSize;
    const reader = sample.getContext("2d");
    const scale = gridSize / Math.max(art.naturalWidth, art.naturalHeight);
    const width = Math.max(1, Math.round(art.naturalWidth * scale)), height = Math.max(1, Math.round(art.naturalHeight * scale));
    reader.drawImage(art, Math.floor((gridSize - width) / 2), Math.floor((gridSize - height) / 2), width, height);
    const needs = model.mapImage(reader.getImageData(0, 0, gridSize, gridSize).data, gridSize, [...selected], catalog.pigments);
    if (background) delete needs[background];
    const entries = Object.entries(needs);
    if (!entries.length) { status.textContent = tr("The image has no paintable pixels.", "A imagem não tem píxeis para pintar."); return; }
    const mural = { gridSize, needs, ...(background && { backing: catalog.pigments[background].color }) };
    const filled = {};
    for (const [id, points] of entries) {
      for (const [x, y] of points) filled[y * gridSize + x] = id;
      costs.append(node("li", nameOf(catalog.pigments[id].name) + " × " + points.length));
    }
    drawPlayableMural(ctx, mural, catalog.pigments, filled, null, false);
    status.textContent = tr("Pigment units needed", "Unidades de pigmento necessárias") + " · " + Object.keys(filled).length;
    ui.mural = mural;
    launch.disabled = !ui.title.value.trim();
  }
  function render(state, data, scope, run) {
    const root = document.getElementById("community-studio");
    if (!ui) initialise(root);
    root.hidden = scope !== "community";
    if (root.hidden) return;
    current = state; catalog = data; dispatch = run;
    const directory = model.directory(state);
    const entry = directory.groups[directory.active];
    if (active !== directory.active || seed !== state.personalSeed) {
      active = directory.active;
      seed = state.personalSeed;
      selected = new Set(starter());
      lastPalette = "";
      ui.studio.open = false;
      sourceVersion++;
      art = null;
      ui.source.value = "flower";
      ui.file.value = "";
      ui.fileLabel.hidden = true;
    }
    options(ui.guild, Object.entries(directory.groups).map(([id, entry]) => [id, model.groupTitle(entry)]), active);
    options(ui.work, [["fox", nameOf(data.mural.name)], ...Object.entries(entry.works).map(([id, entry]) => [id, entry.mural.name])], entry.selected);
    ui.contributions.textContent = tr("Pixels you painted here", "Píxeis que pintaste neste mural") + " · " + Object.keys(model.board(state, data).filledPixels).length;
    updatePalette();
  }
  return { render };
})();
