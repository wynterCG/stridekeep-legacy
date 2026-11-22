"use strict";

globalThis.StrideCommunity = (() => {
  const HOME = "home";
  const FOX = "fox";
  const sizes = [12, 16, 24, 32];
  const maxGroups = 8;
  const maxWorks = 6;
  const text = (en, pt) => globalThis.StrideLocale?.language === "pt-PT" ? pt : en;
  const fail = (en, pt) => { throw Error(text(en, pt)); };
  const cleanName = value => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 45;
  const group = name => ({ name, selected: FOX, works: {}, fox: { painted: {}, filledPixels: {} } });
  const initial = () => ({ active: HOME, groups: { home: group("") } });
  const directory = state => state.communities ?? initial();
  const groupTitle = entry => entry.name || text("Starter guild", "Comunidade inicial");

  function availableColors(state, data) {
    const colors = new Set(Object.keys(data.mural.needs));
    for (const mineral of Object.keys(state.records)) {
      const pigment = data.minerals[mineral]?.pigment;
      if (pigment) colors.add(pigment);
    }
    for (const [id, quantity] of Object.entries(state.pigments)) if (quantity > 0) colors.add(id);
    let previous;
    do {
      previous = colors.size;
      for (const [id, recipe] of Object.entries(data.recipes)) {
        if (Object.keys(recipe.ingredients).every(ingredient => colors.has(ingredient))) colors.add(id);
      }
    } while (previous !== colors.size);
    return [...colors].filter(id => Object.hasOwn(data.pigments, id));
  }

  function board(state, data, groupId = directory(state).active, key) {
    const entry = directory(state).groups[groupId];
    if (!entry) return null;
    const selected = key ?? entry.selected;
    if (selected !== FOX) return Object.hasOwn(entry.works, selected) ? entry.works[selected] : null;
    if (groupId === HOME) return { mural: data.mural, filledPixels: state.filledPixels, painted: state.painted };
    return { ...entry.fox, mural: { ...data.mural, id: groupId + "-fox" } };
  }

  function allBoards(state, data) {
    return Object.entries(directory(state).groups).flatMap(([id, entry]) =>
      [board(state, data, id, FOX), ...Object.values(entry.works)]);
  }

  const complete = entry => entry && Object.keys(entry.filledPixels).length ===
    Object.values(entry.mural.needs).reduce((sum, pixels) => sum + pixels.length, 0);

  function validArtwork(mural, data) {
    if (!mural || !cleanName(mural.name) || !sizes.includes(mural.gridSize) || !mural.needs || Array.isArray(mural.needs)) return false;
    if (mural.backing !== undefined && !Object.values(data.pigments).some(color => color.color === mural.backing)) return false;
    const total = mural.gridSize ** 2;
    const cells = new Set();
    for (const [id, coordinates] of Object.entries(mural.needs)) {
      if (!Object.hasOwn(data.pigments, id) || !Array.isArray(coordinates) || !coordinates.length || coordinates.length > total) return false;
      for (const point of coordinates) {
        if (!Array.isArray(point) || point.length !== 2 || !point.every(n => Number.isInteger(n) && n >= 0 && n < mural.gridSize)) return false;
        const index = point[1] * mural.gridSize + point[0];
        if (cells.has(index)) return false;
        cells.add(index);
      }
    }
    return cells.size > 0;
  }

  function restore(state, data, restoreBoard) {
    const saved = state.communities;
    if (!saved) return;
    const restored = initial();
    for (const [id, entry] of Object.entries(saved.groups ?? {})) {
      if (!(id === HOME || /^guild-[1-7]$/.test(id)) || !entry || (id !== HOME && !cleanName(entry.name))) continue;
      const target = group(id === HOME ? "" : entry.name.trim());
      if (id !== HOME) {
        const { painted, filledPixels } = restoreBoard(data.mural, entry.fox?.filledPixels);
        target.fox = { painted, filledPixels };
      }
      for (const [key, value] of Object.entries(entry.works ?? {})) {
        if (!/^work-[1-6]$/.test(key) || !validArtwork(value?.mural, data)) continue;
        const { name, gridSize, needs, backing } = value.mural;
        target.works[key] = restoreBoard({ id: id + "-" + key, name, gridSize, needs, ...(backing && { backing }) }, value.filledPixels);
      }
      if (Object.hasOwn(target.works, entry.selected)) target.selected = entry.selected;
      restored.groups[id] = target;
    }
    if (typeof saved.active === "string" && Object.hasOwn(restored.groups, saved.active)) restored.active = saved.active;
    state.communities = restored;
  }

  function act(state, data, action) {
    const dir = state.communities ??= initial();
    const current = dir.groups[dir.active];
    if (dir.active !== action.group) fail("The active community changed. Try again.", "A comunidade ativa mudou. Tenta novamente.");
    if (action.type === "community-select") {
      if (!Object.hasOwn(dir.groups, action.id)) fail("Unknown community.", "Comunidade desconhecida.");
      dir.active = action.id;
    } else if (action.type === "community-create") {
      if (!cleanName(action.name)) fail("Choose a name of up to 45 characters.", "Escolhe um nome com até 45 caracteres.");
      const name = action.name.trim();
      if (Object.values(dir.groups).some(entry => groupTitle(entry).toLowerCase() === name.toLowerCase())) fail("That community already exists.", "Essa comunidade já existe.");
      if (Object.keys(dir.groups).length >= maxGroups) fail("Local community limit reached.", "Atingiste o limite de comunidades locais.");
      const id = Array.from({ length: maxGroups - 1 }, (_, i) => "guild-" + (i + 1)).find(key => !Object.hasOwn(dir.groups, key));
      dir.groups[id] = group(name);
      dir.active = id;
    } else if (action.type === "community-work-select") {
      if (action.id !== FOX && !Object.hasOwn(current.works, action.id)) fail("Unknown mural.", "Mural desconhecido.");
      current.selected = action.id;
    } else if (action.type === "community-work-create") {
      if (!validArtwork(action.mural, data)) fail("Check the image, title and grid.", "Verifica a imagem, o título e a grelha.");
      const reachable = new Set(availableColors(state, data));
      if (Object.keys(action.mural.needs).some(color => !reachable.has(color))) fail("Choose colours available to this community.", "Escolhe cores disponíveis para esta comunidade.");
      const key = Array.from({ length: maxWorks }, (_, i) => "work-" + (i + 1)).find(id => !Object.hasOwn(current.works, id));
      if (!key) fail("The local mural shelf is full.", "A galeria local de murais está cheia.");
      const { name, gridSize, needs, backing } = action.mural;
      current.works[key] = { mural: { id: dir.active + "-" + key, name: name.trim(), gridSize, needs: structuredClone(needs), ...(backing && { backing }) }, filledPixels: {}, painted: {} };
      current.selected = key;
    } else fail("Unknown action.", "Ação desconhecida.");
  }

  function mapImage(rgba, size, palette, pigments) {
    if (!sizes.includes(size) || rgba.length !== size * size * 4 || !palette.length) return {};
    const swatches = palette.map(id => {
      const color = parseInt(pigments[id].color.slice(1), 16);
      return [id, color >> 16, (color >> 8) & 255, color & 255];
    });
    const needs = {};
    for (let pixel = 0; pixel < size * size; pixel++) {
      const offset = pixel * 4;
      if (rgba[offset + 3] < 128) continue;
      let best, closest = Infinity;
      for (const [id, r, g, b] of swatches) {
        const meanRed = (rgba[offset] + r) / 2;
        const distance = (2 + meanRed / 256) * (rgba[offset] - r) ** 2 +
          4 * (rgba[offset + 1] - g) ** 2 + (2 + (255 - meanRed) / 256) * (rgba[offset + 2] - b) ** 2;
        if (distance < closest) { closest = distance; best = id; }
      }
      (needs[best] ??= []).push([pixel % size, Math.floor(pixel / size)]);
    }
    return needs;
  }

  return { sizes, text, directory, groupTitle, board, allBoards, complete, restore, availableColors, act, mapImage };
})();
