"use strict";

// The wardrobe composites transparent ChatGPT illustrations in a shared 640 × 880 frame.
globalThis.drawStrideCharacter = (() => {
  const width = 640, height = 880;
  const hairs = { Crop: "crop", Curls: "curls", "Long braid": "braid" };
  const details = { Freckles: "freckles", Beard: "beard" };
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

  async function loadParts(folder, names) {
    const entries = await Promise.all(names.filter(Boolean).map(async name =>
      [name, await load(folder + "/" + name)]));
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

  return async function draw(canvas, look, scarf, equipped, portrait = false, garmentDye, mural = null) {
    const garment = look.jacket === "Survey coat" ? "coat" : "shirt";
    const neutral = garment + "-neutral";
    const dyeAtlas = garment + "-dye";
    const cap = look.hat === "Miner’s cap";
    const hair = "hair-" + hairs[look.hair];
    const detail = details[look.face];
    const pick = "back-" + equipped;
    const key = [garment, garmentDye, hair, cap, detail, look.skin, scarf, pick, portrait].join("|");
    const previous = requests.get(canvas);
    if (previous?.key === key && previous.mural === mural) return;
    const request = { key, mural };
    requests.set(canvas, request);
    canvas.dataset.art = "loading";
    canvas.setAttribute("aria-busy", "true");
    try {
      const changeSkin = Object.hasOwn(skinTones, look.skin);
      const arms = ["arm-left", "arm-right"];
      const hands = ["hand-right", "hand-left-idle"];
      const [body, head] = await Promise.all([
        loadParts("body", [pick, "boots", "trousers", ...arms, neutral, garmentDye && dyeAtlas,
          "back-sling", ...hands, "scarf"]),
        loadParts("head", ["base", changeSkin && "skin", detail, hair, cap && "cap", cap && "cap-clip"]),
      ]);
      if (requests.get(canvas) !== request) return;
      const frame = surface(width, height);
      const ctx = frame.getContext("2d");
      ctx.drawImage(body[pick], 0, 0);
      ctx.drawImage(body.boots, 0, 0);
      ctx.drawImage(body.trousers, 0, 0);
      const drawLimb = name => ctx.drawImage(changeSkin ? tint(body[name], look.skin) : body[name], 0, 0);
      arms.forEach(drawLimb);
      ctx.drawImage(body[neutral], 0, 0);
      if (garmentDye) drawGarmentDye(ctx, body[dyeAtlas], garmentDye);
      ctx.drawImage(body["back-sling"], 0, 0);
      hands.forEach(drawLimb);
      ctx.drawImage(tint(body.scarf, null, scarf), 0, 0);

      ctx.drawImage(head.base, 0, 0);
      if (changeSkin) ctx.drawImage(tint(head.skin, look.skin), 0, 0);
      if (detail) ctx.drawImage(head[detail], 0, 0);
      if (cap) {
        // Tuck the crown under the cap without erasing the face or the braid.
        const tucked = surface(head[hair].width, head[hair].height);
        const hairContext = tucked.getContext("2d");
        hairContext.drawImage(head[hair], 0, 0);
        hairContext.globalCompositeOperation = "destination-out";
        hairContext.drawImage(head["cap-clip"], 0, 0);
        ctx.drawImage(tucked, 0, 0);
        ctx.drawImage(head.cap, 0, 0);
      } else {
        ctx.drawImage(head[hair], 0, 0);
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
