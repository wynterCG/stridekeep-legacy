"use strict";

globalThis.StrideRules = (() => {
  const metrics = ["mined", "polished", "sold", "mixed", "painted"];
  const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    Number.isSafeInteger(value) && value >= min && value <= max;
  const count = (map, key) => map[key] ?? 0;
  const known = (map, key) => Object.hasOwn(map, key);
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  const t = globalThis.StrideLocale?.t ?? ((message, ...values) => typeof message === "string" ? message : String.raw(message, ...values));
  const fail = (message) => { throw new Error(t(message)); };
  const hasStock = (state, ingredients) =>
    Object.entries(ingredients).every(([id, parts]) => count(state.pigments, id) >= parts);
  const styles = {
    skin: ["Porcelain", "Ochre", "Umber", "Ebony"],
    hair: ["Crop", "Curls", "Long braid"],
    face: ["Clean-shaven", "Freckles", "Beard"],
    jacket: ["Field jacket", "Survey coat"], hat: ["Bareheaded", "Miner’s cap"],
  };
  const undyed = "undyed";
  const validPigment = (id, data) => typeof id === "string" && known(data.pigments, id);
  // The local crew only exchanges the four pigments used by its starter mural.
  const crewOffers = {
    "iron-red": "limestone-cream", "limestone-cream": "iron-black",
    "iron-black": "yellow-ochre", "yellow-ochre": "iron-red",
  };
  const copperwingNeeds = {
    "chalk-white": 6, "malachite-green": 8, "azurite-blue": 2,
    "iron-red": 6, mintwash: 4, "slate-shadow": 4,
  };
  const personalIds = /^personal-([1-9]\d*)-(.+)$/;
  const personalSeedPattern = /^[0-9a-f]{16}$/;
  const validSeed = (seed) => typeof seed === "string" && personalSeedPattern.test(seed);
  const hexWord = (value) => value.toString(16).padStart(8, "0");
  const defaultWeightRange = [35, 105];
  const doubleYieldWeight = 220;
  const diamondPowder = "diamond-powder";
  const highGloss = "high-gloss";

  function newOutfitDyes(state, look) {
    return [...new Set([look.cloth, look.scarf].filter((id) =>
      typeof id === "string" && id !== undyed && !state.scarfDyes.includes(id)))];
  }

  function garmentDyes(owned, saved) {
    return Object.fromEntries(styles.jacket.map((jacket) => {
      const id = saved?.[jacket];
      return [jacket, owned.includes(id) ? id : undyed];
    }));
  }

  function validLook(look, data) {
    return look && typeof look.name === "string" && look.name.trim().length > 0 && look.name.length <= 24 &&
      Object.entries(styles).every(([slot, options]) => options.includes(look[slot])) &&
      (look.scarf === undyed || validPigment(look.scarf, data));
  }

  function create(data, { seed } = {}) {
    const state = {
      version: 3, coins: 0, equipped: "starter", owned: ["starter"], nextId: 1,
      route: data.mine.id, mineReadyAt: 0, mining: null, expedition: null,
      items: [], latest: null, records: {}, visits: {}, pigments: {}, materials: {}, painted: {}, claimed: [], contracts: [],
      muralId: data.mural.id, filledPixels: {},
      personalHistory: {}, personalSeed: validSeed(seed) ? seed : newPersonalSeed(), recipeBook: [],
      character: null, scarfDyes: [], background: "plain",
      stats: Object.fromEntries(metrics.map((metric) => [metric, 0])),
    };
    state.personal = assignPersonalMural(state, data);
    return state;
  }

  function restore(raw, data, fallback) {
    try {
      let saved = JSON.parse(raw);
      if (saved?.version === 1) {
        const { trip, ...previous } = saved;
        saved = { ...previous, version: 2, mineReadyAt: 0, mining: trip, expedition: null };
      }
      if (saved?.version === 2 || saved?.version === 3) {
        if (!Object.hasOwn(saved, "mineReadyAt")) saved.mineReadyAt = 0;
        if (!Object.hasOwn(saved, "contracts")) saved.contracts = [];
        if (!Object.hasOwn(saved, "materials")) saved.materials = {};
      }
      const validItem = (item) => item && known(data.minerals, item.mineral) &&
        integer(item.purity, 0, 10000) && integer(item.weight, 1) && typeof item.polished === "boolean";
      const validCounts = (map, keys) => record(map) && Object.entries(map).every(([key, value]) => known(keys, key) && integer(value));
      const mineHistory = Object.fromEntries([data.mine.id, ...data.mine.legacyRoutes].map(id => [id, true]));
      if (!saved || ![2, 3].includes(saved.version) || !integer(saved.coins) || !integer(saved.nextId, 1) || !integer(saved.mineReadyAt) ||
          !Array.isArray(saved.owned) || !saved.owned.includes("starter") ||
          !saved.owned.every((id) => known(data.tools, id)) || !saved.owned.includes(saved.equipped) ||
          !known(mineHistory, saved.route) || !Array.isArray(saved.items) ||
          !saved.items.every((item) => validItem(item) && integer(item.id, 1, saved.nextId - 1)) ||
          new Set(saved.items.map((item) => item.id)).size !== saved.items.length ||
          !validCounts(saved.visits, mineHistory) || !validCounts(saved.pigments, data.pigments) ||
          !validCounts(saved.materials, data.materials ?? {}) ||
          !metrics.every((metric) => integer(saved.stats?.[metric])) ||
          !Array.isArray(saved.claimed) || !saved.claimed.every((id) => known(data.missions, id)) ||
          !Array.isArray(saved.contracts) || new Set(saved.contracts).size !== saved.contracts.length ||
          !saved.contracts.every((id) => known(data.contracts, id)) ||
          !record(saved.records) ||
          !Object.entries(saved.records).every(([key, item]) =>
            known(data.minerals, key) && item && integer(item.purity, 0, 10000) && integer(item.weight, 1)) ||
          (saved.mining !== null && !(saved.mining && known(mineHistory, saved.mining.route) &&
            integer(saved.mining.endsAt) && validItem(saved.mining.find))) ||
          !validExpedition(saved.expedition, data.expedition)) return fallback ?? create(data);
      saved.route = data.mine.id;
      saved.recipeBook = Array.isArray(saved.recipeBook)
        ? [...new Set(saved.recipeBook.filter(id => typeof id === "string" && known(data.recipes, id)))] : [];
      for (const item of saved.items) {
        if (item.protected !== true) delete item.protected;
        if (!item.polished || item.finish !== highGloss) delete item.finish;
        const entry = saved.records[item.mineral] ??= { purity: item.purity, weight: item.weight };
        if (item.polished) entry.polished = true;
      }
      if (!Array.isArray(saved.scarfDyes)) saved.scarfDyes = [];
      saved.scarfDyes = [...new Set(saved.scarfDyes.filter((id) => validPigment(id, data)))];
      if (!validLook(saved.character, data)) saved.character = null;
      if (saved.character) {
        if (!saved.scarfDyes.includes(saved.character.scarf)) saved.character.scarf = undyed;
        saved.character.clothDyes = garmentDyes(saved.scarfDyes, saved.character.clothDyes);
      }
      if (saved.version === 2 && record(saved.painted)) {
        for (const [id, spent] of Object.entries(saved.painted)) {
          if (known(copperwingNeeds, id) && known(data.pigments, id) && integer(spent, 1, copperwingNeeds[id])) {
            saved.pigments[id] = Math.min(Number.MAX_SAFE_INTEGER, count(saved.pigments, id) + spent);
          }
        }
      }
      const board = restoreBoard(data.mural, saved.version === 3 && saved.muralId === data.mural.id ? saved.filledPixels : null);
      saved.version = 3;
      saved.muralId = data.mural.id;
      saved.filledPixels = board.filledPixels;
      saved.painted = board.painted;
      if (!validSeed(saved.personalSeed)) saved.personalSeed = legacyPersonalSeed(saved);
      saved.personalHistory = restorePersonalHistory(saved.personalHistory, data);
      saved.personal = restorePersonalMural(saved.personal, data) ?? assignPersonalMural(saved, data);
      globalThis.StrideCommunity?.restore(saved, data, restoreBoard);
      saved.background = backgroundMural(saved, data)?.id ?? "plain";
      return saved;
    } catch {
      return fallback ?? create(data);
    }
  }

  function validExpedition(group, mission) {
    if (group === null) return true;
    if (!mission || !group || !integer(group.readyAt) || typeof group.worked !== "boolean" ||
        !integer(group.stage, 0, mission.stages.length - 1)) return false;
    if (group.phase === "lobby") return group.stage === 0 && !group.worked;
    if (group.phase === "active") return true;
    return ["complete", "claimed"].includes(group.phase) && group.worked && group.stage === mission.stages.length - 1;
  }

  function rawSalePrice(item, data) {
    const mineral = data.minerals[item.mineral];
    const rarityAnchor = data.specimenPrices[mineral.rarity].raw;
    const speciesFactor = 0.8 + mineral.base / 10;
    const purityFactor = 0.42 + 1.18 * (item.purity / 10000) ** 2;
    return Math.max(2, Math.round(rarityAnchor * speciesFactor * purityFactor));
  }

  function polishFee(item, data) {
    const rawValue = rawSalePrice(item, data);
    const rarityPercent = data.specimenPrices[data.minerals[item.mineral].rarity].polishPercent;
    const purityPercent = 8 * item.purity / 10000;
    const grams = item.weight / 10;
    const weightPercent = 24 * grams / (grams + 15);
    const quote = Math.round(rawValue * (rarityPercent + purityPercent + weightPercent) / 100);
    if (rarityPercent > 100) return Math.max(rawValue + 1, quote);
    return Math.max(1, Math.min(Math.floor(rawValue / 2), quote));
  }

  function salePrice(item, data) {
    const raw = rawSalePrice(item, data);
    return item.polished ? raw + Math.floor(polishFee(item, data) / 2) : raw;
  }

  function yieldFrom(item) {
    return item.weight >= doubleYieldWeight ? 2 : 1;
  }

  function crushOutput(item, data) {
    const mineral = data.minerals[item.mineral];
    if (mineral.collectibleOnly) return null;
    const id = mineral.material ?? mineral.pigment;
    const material = Boolean(mineral.material);
    const stock = material ? data.materials : data.pigments;
    return { id, name: stock[id].name, amount: material ? 1 : yieldFrom(item), material };
  }

  function contractSpecimens(state, contract) {
    return state.items.filter((item) => item.mineral === contract.mineral &&
      !(contract.consume && item.protected) &&
      item.polished === (contract.finish === "polished") &&
      item.weight >= (contract.minWeight ?? 0) && item.purity >= (contract.minPurity ?? 0));
  }

  const pixelIndex = ([x, y], mural) => y * mural.gridSize + x;

  function restoreBoard(mural, saved) {
    const filledPixels = {};
    const painted = {};
    if (record(saved)) {
      for (const [id, pixels] of Object.entries(mural.needs)) {
        for (const point of pixels) {
          const index = pixelIndex(point, mural);
          if (saved[index] !== id) continue;
          filledPixels[index] = id;
          painted[id] = count(painted, id) + 1;
        }
      }
    }
    return { mural, filledPixels, painted };
  }

  function expectedPigmentYield(mineral) {
    const [min, max] = mineral.weight ?? defaultWeightRange;
    const heavier = Math.max(0, max - Math.max(min, doubleYieldWeight) + 1);
    return 1 + heavier / (max - min + 1);
  }

  function miningOdds(data, toolId) {
    return data.mine.odds[toolId];
  }

  function rollMineral(data, toolId, random) {
    const draw = random() * 100;
    const chances = Object.entries(miningOdds(data, toolId));
    let boundary = 0;
    for (const [id, chance] of chances) {
      boundary += chance;
      if (draw < boundary) return id;
    }
    return chances.at(-1)[0];
  }

  const pigmentCostsByCatalogue = new WeakMap();
  function reachablePigmentCosts(data, toolId) {
    if (!pigmentCostsByCatalogue.has(data)) pigmentCostsByCatalogue.set(data, new Map());
    const cached = pigmentCostsByCatalogue.get(data);
    if (cached.has(toolId)) return cached.get(toolId);
    const yields = new Map();
    for (const [id, chance] of Object.entries(miningOdds(data, toolId))) {
      const mineral = data.minerals[id];
      const pigment = mineral.pigment;
      if (!pigment) continue;
      yields.set(pigment, (yields.get(pigment) ?? 0) + chance * expectedPigmentYield(mineral));
    }
    const miningCosts = new Map([...yields].map(([pigment, total]) => [pigment, data.mine.seconds * 100 / total]));
    const requirements = new Map([...miningCosts.keys()].map((pigment) => [pigment, new Map([[pigment, 1]])]));
    const recipes = Object.entries(data.recipes);
    for (let round = 0; round < recipes.length; round++) {
      let changed = false;
      for (const [id, recipe] of recipes) {
        const ingredients = Object.entries(recipe.ingredients);
        if (requirements.has(id) || ingredients.some(([ingredient]) => !requirements.has(ingredient))) continue;
        const inputs = new Map();
        for (const [ingredient, units] of ingredients) {
          for (const [pigment, quantity] of requirements.get(ingredient)) {
            inputs.set(pigment, (inputs.get(pigment) ?? 0) + units * quantity);
          }
        }
        requirements.set(id, inputs);
        changed = true;
      }
      if (!changed) break;
    }
    const costs = { miningCosts, requirements };
    cached.set(toolId, costs);
    return costs;
  }

  function newPersonalSeed() {
    return Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)), hexWord).join("");
  }

  function hashWord(text) {
    let value = 2166136261;
    for (const character of text) value = Math.imul(value ^ character.codePointAt(0), 16777619);
    return value >>> 0;
  }

  function legacyPersonalSeed(state) {
    const stable = JSON.stringify([state.character?.name, state.nextId, state.stats, state.records]);
    return hexWord(hashWord(stable)) + hexWord(hashWord(`personal:${stable}`));
  }

  function personalRandom(seed, ordinal) {
    let value = hashWord(`${seed}:${ordinal}`);
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function personalPalette(colors, slots, data, random) {
    const swatches = colors.map((id) => {
      const rgb = /^#[0-9a-f]{6}$/i.test(data.pigments[id].color) ? data.pigments[id].color : "#000000";
      const r = parseInt(rgb.slice(1, 3), 16) / 255;
      const g = parseInt(rgb.slice(3, 5), 16) / 255;
      const b = parseInt(rgb.slice(5, 7), 16) / 255;
      return { id, r, g, b, light: 0.2126 * r + 0.7152 * g + 0.0722 * b };
    });
    const distance = (a, b) => Math.hypot(a.light - b.light, (a.r - b.r) / 2, (a.g - b.g) / 2, (a.b - b.b) / 2);
    const chosen = [swatches.splice(Math.floor(random() * swatches.length), 1)[0]];
    while (chosen.length < slots) {
      const ranked = swatches.map((swatch, index) => ({ index, contrast: Math.min(...chosen.map((color) => distance(color, swatch))) }));
      const best = Math.max(...ranked.map((entry) => entry.contrast));
      const alternatives = ranked.filter((entry) => entry.contrast >= 0.8 * best);
      const pick = alternatives[Math.floor(random() * alternatives.length)];
      chosen.push(swatches.splice(pick.index, 1)[0]);
    }
    return chosen.sort((a, b) => a.light - b.light).map((swatch) => swatch.id);
  }

  function affordablePersonalPalette(pattern, { miningCosts, requirements }, data, stock, random) {
    const colors = [...requirements.keys()].sort();
    const unitCost = new Map(colors.map((id) => [id, [...requirements.get(id)].reduce((total, [pigment, quantity]) =>
      total + quantity * miningCosts.get(pigment), 0)]));
    const byCost = colors.slice().sort((a, b) => unitCost.get(a) - unitCost.get(b));
    const budget = byCost.slice(0, Math.max(pattern.slots * 3, 16));
    const pools = [budget, ...[0, 1, 2, 3].map((extra) => byCost.slice(0, pattern.slots + extra))];
    // A stockpile can make an unusual contrast practical on the next board.
    const held = colors.filter(id => stock[id] > 0);
    if (held.length) pools.push([...new Set([...held, ...byCost.slice(0, pattern.slots)])]);
    const coverage = Array(pattern.slots).fill(0);
    for (const row of pattern.rows) {
      for (const slot of row) coverage[parseInt(slot, 16)]++;
    }

    const sampled = [];
    const tried = new Set();
    for (const pool of pools) {
      const palette = personalPalette(pool, pattern.slots, data, random);
      // Abstract patterns support rotating their shade sequence. This lets a
      // large field use a plentiful paint and reserves scarce colours for accents.
      for (let order = 0; order < palette.length * 2; order++) {
        const offset = order % palette.length;
        const candidate = palette.slice(offset).concat(palette.slice(0, offset));
        if (order >= palette.length) candidate.reverse();
        const key = candidate.join(",");
        if (tried.has(key)) continue;
        tried.add(key);
        const totals = new Map();
        candidate.forEach((color, slot) => {
          const needed = miningCosts.has(color) ? coverage[slot] : Math.max(0, coverage[slot] - count(stock, color));
          for (const [pigment, quantity] of requirements.get(color)) {
            totals.set(pigment, (totals.get(pigment) ?? 0) + needed * quantity);
          }
        });
        // Strikes supply multiple colours over time, so the slowest shared input governs the estimate.
        const cost = Math.max(...[...totals].map(([pigment, quantity]) =>
          Math.max(0, quantity - count(stock, pigment)) * miningCosts.get(pigment)));
        sampled.push({ palette: candidate, cost });
      }
    }
    const bestCost = Math.min(...sampled.map(({ cost }) => cost));
    const viable = sampled.filter(({ cost }) => cost <= bestCost * 1.1);
    return viable[Math.floor(random() * viable.length)].palette;
  }

  function assignPersonalMural(state, data) {
    if (!data.personalPatterns?.length) return null;
    const bestTool = state.owned.reduce((best, id) => data.tools[id].tier > data.tools[best].tier ? id : best, "starter");
    const costs = reachablePigmentCosts(data, bestTool);
    const tier = data.tools[bestTool].tier;
    const [minSlots, maxSlots] = tier === 1 ? [3, 4] : tier <= 3 ? [8, 10] : [11, 16];
    const eligible = data.personalPatterns.filter((pattern) => pattern.slots <= Math.min(costs.requirements.size, maxSlots));
    if (!eligible.length) return null;
    const preferred = eligible.filter((pattern) => pattern.slots >= minSlots);
    const last = Object.keys(state.personalHistory).map((id) => id.match(personalIds))
      .reduce((latest, match) => Number(match[1]) > Number(latest?.[1] ?? 0) ? match : latest, null);
    const ordinal = Number(last?.[1] ?? 0) + 1;
    const stageAlternatives = preferred.filter((pattern) => pattern.id !== last?.[2]);
    const alternatives = eligible.filter((pattern) => pattern.id !== last?.[2]);
    const candidates = stageAlternatives.length ? stageAlternatives : alternatives.length ? alternatives : eligible;
    const random = personalRandom(state.personalSeed, ordinal);
    const pattern = candidates[Math.floor(random() * candidates.length)];
    const palette = affordablePersonalPalette(pattern, costs, data, state.pigments, random);
    const needs = Object.fromEntries(palette.map((id) => [id, []]));
    pattern.rows.forEach((row, y) => {
      Array.from(row).forEach((slot, x) => needs[palette[parseInt(slot, 16)]].push([x, y]));
    });
    const mural = { id: `personal-${ordinal}-${pattern.id}`, name: pattern.name, gridSize: pattern.gridSize, needs };
    return { mural, filledPixels: {}, painted: {} };
  }

  function restorePersonalMural(saved, data) {
    const mural = saved?.mural;
    if (!record(mural) || typeof mural.id !== "string" || !personalIds.test(mural.id) || typeof mural.name !== "string" ||
        !integer(mural.gridSize, 1, 32) || !record(mural.needs)) return null;
    const cells = new Set();
    for (const [id, points] of Object.entries(mural.needs)) {
      if (!validPigment(id, data) || !Array.isArray(points) || !points.length) return null;
      for (const point of points) {
        if (!Array.isArray(point) || point.length !== 2 || !point.every((value) => integer(value, 0, mural.gridSize - 1))) return null;
        cells.add(pixelIndex(point, mural));
      }
    }
    const count = Object.values(mural.needs).reduce((total, points) => total + points.length, 0);
    return cells.size === mural.gridSize ** 2 && count === cells.size ? restoreBoard(mural, saved.filledPixels) : null;
  }

  function restorePersonalHistory(saved, data) {
    const history = {};
    if (!record(saved)) return history;
    for (const [id, entry] of Object.entries(saved)) {
      const board = restorePersonalMural(entry, data);
      if (board?.mural.id === id && personalComplete(board)) history[id] = board;
    }
    return history;
  }

  function personalComplete(board) {
    return board && Object.keys(board.filledPixels).length === board.mural.gridSize ** 2;
  }

  function personalBackground(state, id) {
    if (id === "personal" || id === state.personal?.mural.id) return state.personal;
    return known(state.personalHistory, id) ? state.personalHistory[id] : null;
  }

  function backgroundMural(state, data, background = state.background) {
    const communities = globalThis.StrideCommunity;
    if (communities) {
      const entry = communities.allBoards(state, data).find(board => board.mural.id === background);
      if (communities.complete(entry)) return entry.mural;
    } else if (background === data.mural.id && muralComplete(state, data)) return data.mural;
    const personal = personalBackground(state, background);
    return personalComplete(personal) ? personal.mural : null;
  }

  function checkedBackground(state, data, background) {
    if (background === "plain") return "plain";
    const community = globalThis.StrideCommunity?.allBoards(state, data).some(board => board.mural.id === background);
    if (typeof background !== "string" || (!community && background !== data.mural.id && background !== "personal" && !personalBackground(state, background))) {
      fail("Unknown background.");
    }
    const mural = backgroundMural(state, data, background);
    if (!mural) fail("Complete the mural to use this background.");
    return mural.id;
  }

  function muralBoard(state, data, scope = "community") {
    if (scope === "personal") return state.personal ?? null;
    if (scope === "community") return globalThis.StrideCommunity?.board(state, data) ??
      { mural: data.mural, filledPixels: state.filledPixels, painted: state.painted };
    return null;
  }

  function nextMuralPixel(state, data, pigment, scope = "community") {
    const board = muralBoard(state, data, scope);
    if (!board || typeof pigment !== "string" || !known(board.mural.needs, pigment)) return null;
    let result = null;
    for (const point of board.mural.needs[pigment]) {
      const index = pixelIndex(point, board.mural);
      if (!known(board.filledPixels, index) && (result === null || index < result)) result = index;
    }
    return result;
  }

  function brushStroke(board, pigment, pixel) {
    const width = board?.mural.gridSize;
    if (!width || !integer(pixel, 0, width * width - 1)) return [];
    const cells = board.mural.needs[pigment];
    if (!Array.isArray(cells)) return [];
    const stroke = [];
    const end = Math.min(pixel + 3, (Math.floor(pixel / width) + 1) * width);
    for (let at = pixel; at < end; at++) {
      if (known(board.filledPixels, at) || !cells.some(point => pixelIndex(point, board.mural) === at)) break;
      stroke.push(at);
    }
    return stroke;
  }

  function muralProgress(state, data, scope = "community") {
    const board = muralBoard(state, data, scope);
    const needed = board ? Object.values(board.mural.needs).reduce((total, pixels) => total + pixels.length, 0) : 0;
    const filled = board ? Object.keys(board.filledPixels).length : 0;
    return {
      needed, filled, left: needed - filled,
      percent: needed ? Math.round(100 * filled / needed) : 0,
    };
  }

  function muralComplete(state, data, scope = "community") {
    const { needed, left } = muralProgress(state, data, scope);
    return needed > 0 && left === 0;
  }

  function missionProgress(state, data, id) {
    const mission = data.missions[id];
    if (mission.metric === "discovered") return Math.min(mission.goal, Object.keys(state.records).length);
    if (mission.metric === "polish-variety") return Math.min(mission.goal, Object.values(state.records).filter(r => r.polished === true).length);
    if (mission.metric === "recipe-variety") return Math.min(mission.goal, state.recipeBook.length);
    const community = globalThis.StrideCommunity;
    const progress = mission.metric !== "painted" ? state.stats[mission.metric] : community
      ? Math.max(...Object.keys(community.directory(state).groups).map(id => Object.keys(community.board(state, data, id, "fox").filledPixels).length))
      : muralProgress(state, data).filled;
    return Math.min(mission.goal, progress);
  }

  function rank(state) {
    const xp = state.stats.mined + state.stats.polished + state.stats.mixed + state.stats.painted;
    const stages = [
      { threshold: 0, name: "Prospector" },
      { threshold: 4, name: "Seamworker" },
      { threshold: 9, name: "Guild Miner" },
      { threshold: 16, name: "Master Prospector" },
    ];
    const index = stages.findLastIndex((stage) => xp >= stage.threshold);
    return { name: stages[index].name, level: index + 1, xp, start: stages[index].threshold, next: stages[index + 1]?.threshold };
  }

  function giveSpecimen(state, find) {
    const item = { ...find, id: state.nextId++ };
    const previous = state.records[item.mineral] ?? { purity: 0, weight: 0 };
    const record = known(state.records, item.mineral) && item.purity > previous.purity;
    state.items.unshift(item);
    state.latest = item.id;
    state.records[item.mineral] = {
      ...previous,
      purity: Math.max(previous.purity, item.purity), weight: Math.max(previous.weight, item.weight),
    };
    return { item, record };
  }

  function recordMine(state, data, route, find) {
    const { item, record } = giveSpecimen(state, find);
    state.visits[route] = count(state.visits, route) + 1;
    state.stats.mined++;
    return t`${data.minerals[item.mineral].name} discovered.` + (record ? t(" New purity record!") : "");
  }

  const actions = {
    "toggle-protection"(state, _data, { id }) {
      const item = state.items.find(piece => piece.id === id);
      if (!item) fail("This specimen is no longer in the collection.");
      if (item.protected) {
        delete item.protected;
        return "Specimen protection removed.";
      }
      item.protected = true;
      return "Specimen protected.";
    },
    barter(state, data, { pigment }) {
      if (!known(crewOffers, pigment) || !validPigment(pigment, data)) fail("Choose a guild exchange offer.");
      const received = crewOffers[pigment];
      if (!validPigment(received, data) || count(state.pigments, pigment) < 2) fail("This offer needs two pigment units.");
      state.pigments[pigment] -= 2;
      state.pigments[received] = count(state.pigments, received) + 1;
      return t`Exchange complete. Received ${data.pigments[received].name}.`;
    },
    background(state, data, { background }) {
      state.background = checkedBackground(state, data, background);
      return "Background equipped.";
    },
    "new-personal-mural"(state, data) {
      if (!personalComplete(state.personal)) fail("Complete the personal mural first.");
      state.personalHistory[state.personal.mural.id] = state.personal;
      state.personal = assignPersonalMural(state, data);
      if (!state.personal) fail("No personal mural is available.");
      return "New personal mural assigned.";
    },
    wardrobe(state, data, { look, background }) {
      if (!validLook(look, data) ||
          (look.cloth !== undefined && look.cloth !== undyed && !validPigment(look.cloth, data))) {
        fail("Choose a name and valid outfit.");
      }
      const dyes = newOutfitDyes(state, look);
      if (dyes.some((id) => count(state.pigments, id) < 1)) fail("You need more of this pigment.");
      if (background !== undefined) state.background = checkedBackground(state, data, background);
      for (const id of dyes) state.pigments[id]--;
      state.scarfDyes.push(...dyes);
      const clothDyes = garmentDyes(state.scarfDyes, state.character?.clothDyes);
      clothDyes[look.jacket] = look.cloth ?? undyed;
      state.character = Object.fromEntries(Object.keys(styles).map((slot) => [slot, look[slot]]));
      state.character.name = look.name.trim();
      state.character.scarf = look.scarf;
      state.character.clothDyes = clothDyes;
      return "Character saved.";
    },
    mine(state, data, _action, now, random) {
      if (state.mining) fail("Collect the current mining result first.");
      if (now < state.mineReadyAt) fail("Your miner is not ready to strike again yet.");
      const mineral = rollMineral(data, state.equipped, random);
      const [minWeight, maxWeight] = data.minerals[mineral].weight ?? defaultWeightRange;
      const purity = Math.floor(random() * 10001);
      const weight = minWeight + Math.floor(random() * (maxWeight - minWeight + 1));
      state.mineReadyAt = now + 1000 * data.mine.seconds;
      return recordMine(state, data, data.mine.id, { mineral, purity, weight, polished: false });
    },
    collect(state, data, _action, now) {
      const mining = state.mining;
      if (!mining) fail("There is no mining result to collect.");
      if (now < mining.endsAt) fail("The mining result is not ready yet.");
      state.mining = null;
      return recordMine(state, data, mining.route, mining.find);
    },
    "expedition-join"(state, data, _action, now) {
      if (state.expedition && state.expedition.phase !== "claimed") fail("You have already joined this expedition.");
      if (state.stats.mined < data.expedition.minFinds) fail("Collect your first mining find to join the crew.");
      state.expedition = { phase: "lobby", stage: 0, readyAt: now + data.expedition.lobbySeconds * 1000, worked: false };
      return "You joined the Silver Fault crew. Wait for the other miners to be ready.";
    },
    "expedition-leave"(state) {
      if (state.expedition?.phase !== "lobby") fail("You can leave the crew before departure.");
      state.expedition = null;
      return "You left the crew before departure.";
    },
    "expedition-depart"(state, data, _action, now) {
      const group = state.expedition;
      if (group?.phase !== "lobby" || now < group.readyAt) fail("Wait for the full crew before departure.");
      group.phase = "active";
      group.readyAt = now + data.expedition.stages[0].seconds * 1000;
      return "The crew departed for Silver Fault.";
    },
    "expedition-contribute"(state, data) {
      const group = state.expedition;
      if (group?.phase !== "active") fail("Depart with the crew first.");
      if (group.worked) fail("You already helped with this stage.");
      group.worked = true;
      return t`${t(data.expedition.stages[group.stage].name)} contribution recorded.`;
    },
    "expedition-advance"(state, data, _action, now) {
      const group = state.expedition;
      if (group?.phase !== "active") fail("There is no active expedition stage.");
      if (!group.worked) fail("Contribute to this stage first.");
      if (now < group.readyAt) fail("Wait for the rest of the crew.");
      const next = data.expedition.stages[group.stage + 1];
      if (!next) {
        group.phase = "complete";
        return "The crew completed the Silver Fault Survey.";
      }
      group.stage++;
      group.worked = false;
      group.readyAt = now + next.seconds * 1000;
      return t`${t(next.name)} started.`;
    },
    "expedition-claim"(state, data) {
      const group = state.expedition;
      if (group?.phase === "claimed") fail("The expedition reward was already claimed.");
      if (group?.phase !== "complete") fail("Complete the crew mission first.");
      const { coins, ...find } = data.expedition.reward;
      giveSpecimen(state, { ...find, polished: false, origin: data.expedition.name });
      state.coins += coins;
      group.phase = "claimed";
      return t`Expedition reward. ${data.minerals[find.mineral].name} and ${coins} coins.`;
    },
    buy(state, data, action) {
      if (!known(data.tools, action.tool)) fail("Unknown pickaxe.");
      const tool = data.tools[action.tool];
      if (state.owned.includes(action.tool)) fail("You already own this pickaxe.");
      if (tool.requires && !state.owned.includes(tool.requires)) fail("Buy the previous pickaxe first.");
      if (state.coins < tool.cost) fail("You need more coins.");
      state.coins -= tool.cost;
      state.owned.push(action.tool);
      state.equipped = action.tool;
      return t`${t(tool.name)} purchased and equipped.`;
    },
    equip(state, data, action) {
      if (!state.owned.includes(action.tool)) fail("You need to own this pickaxe.");
      state.equipped = action.tool;
      return t`${t(data.tools[action.tool].name)} equipped.`;
    },
    claim(state, data, action) {
      if (!known(data.missions, action.mission)) fail("Unknown mission.");
      const mission = data.missions[action.mission];
      if (state.claimed.includes(action.mission)) fail("This reward has already been claimed.");
      if (missionProgress(state, data, action.mission) < mission.goal) fail("Complete the mission first.");
      state.claimed.push(action.mission);
      state.coins += mission.coins;
      return t`Mission reward received. +${mission.coins} coins.`;
    },
    "claim-contract"(state, data, action) {
      const key = action.contract;
      if (!known(data.contracts, key)) fail("Unknown contract.");
      if (state.contracts.includes(key)) fail("This contract has already been claimed.");
      const contract = data.contracts[key];
      if (contract.pigment) {
        if (count(state.pigments, contract.pigment) < contract.quantity) fail("You need more of this pigment.");
        state.pigments[contract.pigment] -= contract.quantity;
      } else {
        if (!contractSpecimens(state, contract).some((item) => item.id === action.id)) {
          fail("Select a specimen that meets the contract requirements.");
        }
        if (contract.consume) state.items = state.items.filter((item) => item.id !== action.id);
      }
      state.contracts.push(key);
      state.coins += contract.coins;
      return t`${t(contract.name)} complete. +${contract.coins} coins.`;
    },
    mix(state, data, action) {
      if (!known(data.recipes, action.recipe)) fail("Unknown recipe.");
      const recipe = data.recipes[action.recipe];
      if (!hasStock(state, recipe.ingredients)) fail("You need the listed base pigments.");
      for (const [id, parts] of Object.entries(recipe.ingredients)) state.pigments[id] -= parts;
      state.pigments[action.recipe] = count(state.pigments, action.recipe) + 1;
      state.stats.mixed++;
      if (!state.recipeBook.includes(action.recipe)) state.recipeBook.push(action.recipe);
      return t`${recipe.name} mixed.`;
    },
    "wash-brush"(state, data, { pigment, pixel, scope, boardId, units }) {
      const board = muralBoard(state, data, scope);
      const stroke = brushStroke(board, pigment, pixel);
      if (board?.mural.id !== boardId || units < 2 || units !== stroke.length) fail("Select the brush stroke again.");
      if (count(state.pigments, pigment) < units) fail("You need more of this pigment.");
      for (const at of stroke) actions.paint(state, data, { pigment, pixel: at, scope });
      return t`Painted ${units} pixels with ${data.pigments[pigment].name}.`;
    },
    paint(state, data, { pigment: id, pixel, scope = "community", boardId }) {
      const board = muralBoard(state, data, scope);
      if (!board) fail("Unknown mural.");
      if (boardId !== undefined && boardId !== board.mural.id) fail("Select the pixel again.");
      if (typeof id !== "string" || !known(board.mural.needs, id)) fail("This color is outside the mural palette.");
      const size = board.mural.gridSize;
      if (pixel === undefined) {
        pixel = nextMuralPixel(state, data, id, scope);
        if (pixel === null) fail("This color is complete.");
      } else {
        if (!integer(pixel, 0, size * size - 1)) fail("Choose a pixel within the mural.");
        if (known(board.filledPixels, pixel)) fail("This pixel is already painted.");
        if (!board.mural.needs[id].some((point) => pixelIndex(point, board.mural) === pixel)) fail("This color does not match that pixel.");
      }
      if (!count(state.pigments, id)) fail("You need more of this pigment.");
      state.pigments[id]--;
      board.filledPixels[pixel] = id;
      board.painted[id] = count(board.painted, id) + 1;
      state.stats.painted++;
      return muralComplete(state, data, scope) ? "The mural is complete." : t`One pixel painted with ${data.pigments[id].name}.`;
    },
  };

  function processItem(state, data, action) {
    const index = state.items.findIndex((item) => item.id === action.id);
    if (index < 0) fail("This specimen is no longer in the collection.");
    const item = state.items[index];
    if (item.protected && (action.type === "crush" || action.type === "sell")) fail("Remove protection from this specimen first.");
    const mineral = data.minerals[item.mineral];
    if (action.type === "polish") {
      if (item.polished) fail("This specimen is already polished.");
      const fee = polishFee(item, data);
      if (state.coins < fee) fail("You need more coins.");
      state.coins -= fee;
      item.polished = true;
      state.stats.polished++;
      state.records[item.mineral].polished = true;
      return fee === 1 ? t`${mineral.name} polished for 1 coin.` : t`${mineral.name} polished for ${fee} coins.`;
    }
    if (action.type === "finish") {
      if (!item.polished) fail("Polish this specimen first.");
      if (item.finish === highGloss) fail("This specimen already has a high-gloss finish.");
      if (!count(state.materials, diamondPowder)) fail("You need one unit of Diamond Powder.");
      state.materials[diamondPowder]--;
      item.finish = highGloss;
      return t`High-gloss finish applied to ${mineral.name}.`;
    }
    if (action.type === "crush") {
      const output = crushOutput(item, data);
      if (!output) fail("This collector’s specimen stays intact.");
      if (item.polished) fail("Keep polished specimens for display or sale.");
      const { id, name, amount, material } = output;
      const stock = material ? state.materials : state.pigments;
      stock[id] = count(stock, id) + amount;
      state.items.splice(index, 1);
      return t`${amount} × ${name} added to stock.`;
    }
    const price = salePrice(item, data);
    state.coins += price;
    state.stats.sold++;
    state.items.splice(index, 1);
    return t`${mineral.name} sold for ${price} coins.`;
  }

  function apply(state, data, action, { now = Date.now(), random = Math.random } = {}) {
    const draft = structuredClone(state);
    if (globalThis.StrideCommunity && action.type.startsWith("community-")) {
      globalThis.StrideCommunity.act(draft, data, action);
      return { state: draft, message: "" };
    }
    if (action.type === "paint" && action.muralId && muralBoard(state, data, action.scope)?.mural.id !== action.muralId) {
      throw Error(globalThis.StrideCommunity?.text("The active mural changed. Try again.", "O mural ativo mudou. Tenta novamente.") ?? "The active mural changed. Try again.");
    }
    if (["polish", "finish", "crush", "sell"].includes(action.type)) {
      return { state: draft, message: processItem(draft, data, action) };
    }
    if (!known(actions, action.type)) fail("Unknown action.");
    return { state: draft, message: actions[action.type](draft, data, action, now, random) };
  }

  return {
    create, restore, apply, salePrice, polishFee, yieldFrom, muralBoard, muralProgress, nextMuralPixel, missionProgress, backgroundMural, brushStroke,
    rank, hasStock, contractSpecimens, styles, newOutfitDyes, crushOutput, miningOdds, crewOffers,
  };
})();
