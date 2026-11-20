"use strict";

globalThis.StrideRules = (() => {
  const metrics = ["mined", "polished", "sold", "mixed", "painted"];
  const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    Number.isSafeInteger(value) && value >= min && value <= max;
  const count = (map, key) => map[key] ?? 0;
  const known = (map, key) => Object.hasOwn(map, key);
  const t = globalThis.StrideLocale?.t ?? ((message, ...values) => typeof message === "string" ? message : String.raw(message, ...values));
  const fail = (message) => { throw new Error(t(message)); };
  const hasStock = (state, ingredients) =>
    Object.entries(ingredients).every(([id, parts]) => count(state.pigments, id) >= parts);

  function create(data) {
    return {
      version: 2, coins: 0, equipped: "starter", owned: ["starter"], nextId: 1,
      route: Object.keys(data.routes)[0], mineReadyAt: 0, mining: null, expedition: null,
      items: [], latest: null, records: {}, visits: {}, pigments: {}, painted: {}, claimed: [], contracts: [],
      stats: Object.fromEntries(metrics.map((metric) => [metric, 0])),
    };
  }

  function restore(raw, data, fallback = create(data)) {
    try {
      let saved = JSON.parse(raw);
      if (saved?.version === 1) {
        const { trip, ...previous } = saved;
        saved = { ...previous, version: 2, mineReadyAt: 0, mining: trip, expedition: null };
      }
      if (saved?.version === 2 && !Object.hasOwn(saved, "mineReadyAt")) saved.mineReadyAt = 0;
      if (saved?.version === 2 && !Object.hasOwn(saved, "contracts")) saved.contracts = [];
      const validItem = (item) => item && known(data.minerals, item.mineral) &&
        integer(item.purity, 0, 10000) && integer(item.weight, 1) && typeof item.polished === "boolean";
      const validCounts = (map, keys, max = () => Number.MAX_SAFE_INTEGER) =>
        map && typeof map === "object" && !Array.isArray(map) &&
        Object.entries(map).every(([key, value]) => known(keys, key) && integer(value, 0, max(key)));
      if (!saved || saved.version !== 2 || !integer(saved.coins) || !integer(saved.nextId, 1) || !integer(saved.mineReadyAt) ||
          !Array.isArray(saved.owned) || !saved.owned.includes("starter") ||
          !saved.owned.every((id) => known(data.tools, id)) || !saved.owned.includes(saved.equipped) ||
          !known(data.routes, saved.route) || !Array.isArray(saved.items) ||
          !saved.items.every((item) => validItem(item) && integer(item.id, 1, saved.nextId - 1)) ||
          new Set(saved.items.map((item) => item.id)).size !== saved.items.length ||
          !validCounts(saved.visits, data.routes) || !validCounts(saved.pigments, data.pigments) ||
          !validCounts(saved.painted, data.mural.needs, (key) => data.mural.needs[key].length) ||
          !metrics.every((metric) => integer(saved.stats?.[metric])) ||
          !Array.isArray(saved.claimed) || !saved.claimed.every((id) => known(data.missions, id)) ||
          !Array.isArray(saved.contracts) || new Set(saved.contracts).size !== saved.contracts.length ||
          !saved.contracts.every((id) => known(data.contracts, id)) ||
          !saved.records || typeof saved.records !== "object" || Array.isArray(saved.records) ||
          !Object.entries(saved.records).every(([key, item]) =>
            known(data.minerals, key) && item && integer(item.purity, 0, 10000) && integer(item.weight, 1)) ||
          (saved.mining !== null && !(saved.mining && known(data.routes, saved.mining.route) &&
            integer(saved.mining.endsAt) && validItem(saved.mining.find))) ||
          !validExpedition(saved.expedition, data.expedition)) return fallback;
      return saved;
    } catch {
      return fallback;
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

  function salePrice(item, data) {
    return Math.max(2, data.minerals[item.mineral].base * 6 + Math.round((item.purity - 7000) / 180));
  }

  function yieldFrom(item) {
    return item.weight >= 220 ? 2 : 1;
  }

  function contractSpecimens(state, contract) {
    return state.items.filter((item) => item.mineral === contract.mineral &&
      item.polished === (contract.finish === "polished") &&
      item.weight >= (contract.minWeight ?? 0) && item.purity >= (contract.minPurity ?? 0));
  }

  function muralProgress(state, data) {
    const entries = Object.entries(data.mural.needs);
    const needed = entries.reduce((total, [, patches]) => total + patches.length, 0);
    const filled = entries.reduce((total, [color]) => total + count(state.painted, color), 0);
    return {
      needed, filled, left: needed - filled,
      percent: needed ? Math.round(100 * filled / needed) : 0,
    };
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
    return { name: stages[index].name, level: index + 1, xp, next: stages[index + 1]?.threshold };
  }

  function giveSpecimen(state, find) {
    const item = { ...find, id: state.nextId++ };
    const previous = state.records[item.mineral] ?? { purity: 0, weight: 0 };
    const record = previous.purity > 0 && item.purity > previous.purity;
    state.items.unshift(item);
    state.latest = item.id;
    state.records[item.mineral] = {
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
    select(state, data, action) {
      if (!known(data.routes, action.route)) fail("Unknown route.");
      state.route = action.route;
      return "";
    },
    mine(state, data, action, now, random) {
      const id = action.route ?? state.route;
      if (state.mining) fail("Collect the current mining result first.");
      if (!known(data.routes, id)) fail("Unknown route.");
      const route = data.routes[id];
      const pick = data.tools[state.equipped];
      if (pick.power < route.power) fail("This route needs a stronger pickaxe.");
      if (now < state.mineReadyAt) fail("Your miner is not ready to strike again yet.");
      const draw = state.visits[id] ? Math.floor(random() * route.finds.length) : 0;
      const mineral = route.finds[draw];
      const [minWeight, maxWeight] = data.minerals[mineral].weight ?? [35, 105];
      const purity = Math.min(10000, 4100 + Math.floor(random() * 5851) +
        (route.delicate ? pick.precision ?? 0 : 0));
      const weight = minWeight + Math.floor(random() * (maxWeight - minWeight + 1));
      state.route = id;
      state.mineReadyAt = now + 1000 * route.seconds;
      return recordMine(state, data, id, { mineral, purity, weight, polished: false });
    },
    collect(state, data, _action, now) {
      const mining = state.mining;
      if (!mining) fail("There is no mining result to collect.");
      if (now < mining.endsAt) fail("The mining result is not ready yet.");
      state.mining = null;
      return recordMine(state, data, mining.route, mining.find);
    },
    "expedition-join"(state, data, _action, now) {
      if (state.expedition) fail("You have already joined this expedition.");
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
      if (state.stats[mission.metric] < mission.goal) fail("Complete the mission first.");
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
      return t`${recipe.name} mixed.`;
    },
    paint(state, data, action) {
      const id = action.pigment;
      if (!known(data.mural.needs, id)) fail("This color is outside the mural palette.");
      if (!count(state.pigments, id)) fail("You need more of this pigment.");
      if (count(state.painted, id) >= data.mural.needs[id].length) fail("This color is complete.");
      state.pigments[id]--;
      state.painted[id] = count(state.painted, id) + 1;
      state.stats.painted++;
      return muralProgress(state, data).left ?
        t`One patch painted with ${data.pigments[id].name}.` : "Copperwing is complete. The guild mural is finished.";
    },
  };

  function processItem(state, data, action) {
    const index = state.items.findIndex((item) => item.id === action.id);
    if (index < 0) fail("This specimen is no longer in the collection.");
    const item = state.items[index];
    const mineral = data.minerals[item.mineral];
    if (action.type === "polish") {
      if (item.polished) fail("This specimen is already polished.");
      item.polished = true;
      state.stats.polished++;
      return t`${mineral.name} polished. Its purity is preserved.`;
    }
    if (action.type === "crush") {
      if (item.polished) fail("Keep polished specimens for display or sale.");
      const amount = yieldFrom(item);
      state.pigments[mineral.pigment] = count(state.pigments, mineral.pigment) + amount;
      state.items.splice(index, 1);
      return t`${amount} × ${data.pigments[mineral.pigment].name} added to stock.`;
    }
    const price = salePrice(item, data);
    state.coins += price;
    state.stats.sold++;
    state.items.splice(index, 1);
    return t`${mineral.name} sold for ${price} coins.`;
  }

  function apply(state, data, action, { now = Date.now(), random = Math.random } = {}) {
    const draft = structuredClone(state);
    if (["polish", "crush", "sell"].includes(action.type)) {
      return { state: draft, message: processItem(draft, data, action) };
    }
    if (!known(actions, action.type)) fail("Unknown action.");
    return { state: draft, message: actions[action.type](draft, data, action, now, random) };
  }

  return { create, restore, apply, salePrice, yieldFrom, muralProgress, rank, hasStock, contractSpecimens };
})();
