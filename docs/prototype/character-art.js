"use strict";

// The wardrobe composites transparent ChatGPT illustrations in a shared 640 × 880 frame.
globalThis.drawStrideCharacter = (() => {
  const width = 640, height = 880;
  const hairs = { Crop: "crop", Curls: "curls", "Long braid": "braid" };
  const details = { Freckles: "freckles", Beard: "beard" };
  const oldTopNames = { "Field jacket": "field-shirt", "Survey coat": "survey-coat" };
  const legacyGarments = { "field-shirt": "shirt", "survey-coat": "coat" };
  const shirtsUnder = new Set(["waistcoat", "capelet", "apron"]);
  const longSleeves = new Set(["survey-coat", "cable-knit", "quilted", "hoodie"]);
  const images = new Map();
  const requests = new WeakMap();

  function load(path) {
    if (!images.has(path)) {
      const image = new Image();
      image.src = "prototype/character/parts/" + path + ".webp";
      const ready = image.decode().then(() => image).catch(error => {
        if (images.get(path) === ready) images.delete(path);
        throw error;
      });
      images.set(path, ready);
      if (images.size > 30) images.delete(images.keys().next().value);
    }
    return images.get(path);
  }

  function surface(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  async function loadParts(paths) {
    const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) =>
      [name, path ? await load(path) : null]));
    return Object.fromEntries(entries);
  }

  const skinTones = {
    Porcelain: ["screen", "#4b403b"],
    Umber: ["multiply", "#b6a49b"],
    Ebony: ["multiply", "#806b67"],
  };

  function tint(mask, skin, dye) {
    const canvas = surface(mask.width, mask.height);
    const ctx = canvas.getContext("2d");
    const fill = (mode, colour) => {
      ctx.globalCompositeOperation = mode;
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    if (dye) {
      // Recover the blue cloth's folds as a neutral light map before applying the pigment.
      fill("source-over", "#808080");
      ctx.globalCompositeOperation = "luminosity";
      ctx.drawImage(mask, 0, 0);
      fill("color-dodge", "#a3a3a3");
      fill("multiply", dye);
    } else {
      ctx.drawImage(mask, 0, 0);
      fill(...skinTones[skin]);
    }
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    return canvas;
  }

  function drawGarmentDye(ctx, atlas, colour) {
    const w = atlas.width, h = atlas.height / 2;
    const cloth = surface(w, h);
    const paint = cloth.getContext("2d");
    paint.fillStyle = colour;
    paint.fillRect(0, 0, w, h);
    // The upper atlas tile contains the folds and highlights. The lower tile
    // limits the dye to fabric, preserving buttons, stitching, piping and belt.
    paint.globalCompositeOperation = "hard-light";
    paint.drawImage(atlas, 0, 0, w, h, 0, 0, w, h);
    paint.globalCompositeOperation = "destination-in";
    paint.drawImage(atlas, 0, h, w, h, 0, 0, w, h);
    ctx.drawImage(cloth, 144, 204);
  }

  function drawFabric(ctx, fabric, mask, colour) {
    ctx.drawImage(fabric, 0, 0);
    if (!mask || !colour) return;
    const overlay = surface(fabric.width, fabric.height);
    const paint = overlay.getContext("2d");
    paint.drawImage(fabric, 0, 0);
    paint.globalCompositeOperation = "multiply";
    paint.fillStyle = colour;
    paint.fillRect(0, 0, overlay.width, overlay.height);
    paint.globalCompositeOperation = "destination-in";
    paint.drawImage(mask, 0, 0);
    ctx.drawImage(overlay, 0, 0);
  }

  function drawExhibitedLook(ctx, frame, mural, portrait) {
    const w = portrait ? 320 : width, h = portrait ? 320 : height;
    const x = portrait ? 12 : 24, y = portrait ? 42 : 122;
    const size = portrait ? 104 : 224;
    ctx.save();
    ctx.scale(ctx.canvas.width / w, ctx.canvas.height / h);

    // Keep the finished mural legible beside the miner's silhouette.
    // Use a soft pool of gallery light so the wall blends into the wardrobe stage.
    const light = ctx.createRadialGradient(x + size / 2, y + size / 2, size / 3,
      x + size / 2, y + size / 2, size * 1.65);
    light.addColorStop(0, "rgba(190, 153, 107, .24)");
    light.addColorStop(1, "rgba(190, 153, 107, 0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#202124";
    ctx.fillRect(x - 7, y - 6, size + 16, size + 17);
    ctx.fillStyle = "#9a7855";
    ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
    ctx.fillStyle = "#433b36";
    ctx.fillRect(x - 3, y - 3, size + 6, size + 6);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mural, x, y, size, size);
    ctx.imageSmoothingEnabled = true;
    if (portrait) ctx.drawImage(frame, 160, 0, 320, 400, 75, 10, 264, 330);
    else ctx.drawImage(frame, 111, 60, width * .88, height * .88);
    ctx.restore();
  }

  return async function draw(canvas, look, scarf, equipped, portrait = false, garmentDye, mural = null,
      hatColour, trouserColour) {
    const top = oldTopNames[look.jacket] || look.jacket || "field-shirt";
    const legacyGarment = legacyGarments[top];
    const trousers = look.trousers || "work-pants";
    const boots = look.boots || "work-boots";
    const face = look.head || "base";
    const cap = look.hat === "Miner’s cap";
    const hat = cap || look.hat === "Bareheaded" ? null : look.hat;
    const backHat = hat === "watch-cap" || hat === "pith-helmet" ? hat + "-back" : null;
    const hair = "hair-" + hairs[look.hair];
    const detail = details[look.face];
    const pick = "back-" + equipped;
    const key = [top, garmentDye, trousers, trouserColour, boots, face, hair, cap, hat, hatColour,
      detail, look.skin, scarf, pick, portrait].join("|");
    const previous = requests.get(canvas);
    if (previous?.key === key && previous.mural === mural) return;
    const request = { key, mural };
    requests.set(canvas, request);
    canvas.dataset.art = "loading";
    canvas.setAttribute("aria-busy", "true");
    try {
      const changeSkin = Object.hasOwn(skinTones, look.skin);
      const coveredArms = longSleeves.has(top);
      const defaultBoots = boots === "work-boots";
      const defaultTrousers = trousers === "work-pants";
      const parts = await loadParts({
        pick: "body/" + pick,
        boots: defaultBoots ? "body/boots" : "wardrobe/" + boots,
        bootFronts: defaultBoots ? "body/boot-fronts" : "wardrobe/" + boots + "-front",
        trousers: defaultTrousers ? "body/trousers" : "wardrobe/" + trousers,
        trouserMask: !defaultTrousers && trouserColour && "wardrobe/" + trousers + "-mask",
        wristsNeck: coveredArms && "wardrobe/wrists-neck",
        armLeft: !coveredArms && "body/arm-left",
        armRight: !coveredArms && "body/arm-right",
        neck: !coveredArms && "body/neck",
        underShirt: shirtsUnder.has(top) && "body/shirt-neutral",
        top: legacyGarment ? "body/" + legacyGarment + "-neutral" : "wardrobe/" + top,
        topMask: !legacyGarment && garmentDye && "wardrobe/" + top + "-mask",
        topAtlas: legacyGarment && garmentDye && "body/" + legacyGarment + "-dye",
        sling: "body/back-sling",
        handLeft: "body/hand-left-idle",
        handRight: "body/hand-right",
        scarf: scarf && "body/scarf",
        backHat: backHat && "wardrobe/" + backHat,
        face: face === "base" ? "head/base" : "wardrobe/" + face,
        skin: changeSkin && (face === "base" ? "head/skin" : "wardrobe/" + face + "-skin"),
        detail: detail && "head/" + detail,
        hair: "head/" + hair,
        tuck: cap ? "head/cap-clip" : hat && "wardrobe/" + hat + "-tuck",
        hat: cap ? "head/cap" : hat && "wardrobe/" + hat,
        hatMask: hat && hatColour && "wardrobe/" + hat + "-mask",
      });
      if (requests.get(canvas) !== request) return;
      const frame = surface(width, height);
      const ctx = frame.getContext("2d");
      ctx.drawImage(parts.pick, 0, 0);
      ctx.drawImage(parts.boots, 0, 0);
      drawFabric(ctx, parts.trousers, parts.trouserMask, trouserColour);
      ctx.drawImage(parts.bootFronts, 0, 0);
      const drawSkin = part => ctx.drawImage(changeSkin ? tint(part, look.skin) : part, 0, 0);
      if (parts.wristsNeck) drawSkin(parts.wristsNeck);
      else [parts.armLeft, parts.armRight, parts.neck].forEach(drawSkin);
      if (parts.underShirt) ctx.drawImage(parts.underShirt, 0, 0);
      drawFabric(ctx, parts.top, parts.topMask, garmentDye);
      if (parts.topAtlas) drawGarmentDye(ctx, parts.topAtlas, garmentDye);
      ctx.drawImage(parts.sling, 0, 0);
      drawSkin(parts.handRight);
      drawSkin(parts.handLeft);
      if (parts.scarf) ctx.drawImage(tint(parts.scarf, null, scarf), 0, 0);

      if (parts.backHat) ctx.drawImage(parts.backHat, 0, 0);
      ctx.drawImage(parts.face, 0, 0);
      if (parts.skin) drawSkin(parts.skin);
      if (parts.detail) ctx.drawImage(parts.detail, 0, 0);
      if (parts.hat) {
        // Tuck the crown under the brim without erasing the face or the braid.
        const tucked = surface(parts.hair.width, parts.hair.height);
        const hairContext = tucked.getContext("2d");
        hairContext.drawImage(parts.hair, 0, 0);
        hairContext.globalCompositeOperation = "destination-out";
        hairContext.drawImage(parts.tuck, 0, 0);
        ctx.drawImage(tucked, 0, 0);
        drawFabric(ctx, parts.hat, parts.hatMask, hatColour);
      } else {
        ctx.drawImage(parts.hair, 0, 0);
      }
      const target = canvas.getContext("2d");
      target.clearRect(0, 0, canvas.width, canvas.height);
      if (mural) drawExhibitedLook(target, frame, mural, portrait);
      else if (portrait) target.drawImage(frame, (width - 320) / 2, 0, 320, 320, 0, 0, canvas.width, canvas.height);
      else target.drawImage(frame, 0, 0, canvas.width, canvas.height);
      canvas.dataset.art = "ready";
      canvas.setAttribute("aria-busy", "false");
    } catch (error) {
      if (requests.get(canvas) !== request) return;
      requests.delete(canvas);
      canvas.dataset.art = "unavailable";
      canvas.setAttribute("aria-busy", "false");
      throw error;
    }
  };
})();
