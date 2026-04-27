---
name: stridekeep-mural-prep
description: Use this skill when working on the Stridekeep Mural Prep Tool — a standalone Godot 4 desktop application (NOT an editor plugin) that turns ComfyUI-generated PNGs into season-ready palette + canvas data for Stridekeep. Covers the architecture (single window, three-column layout), the build slices, k-means palette extraction in LAB color space, the generic perceptual color naming algorithm (no thematic lexicon), Supabase REST integration, and what's intentionally deferred. Reference this whenever building, modifying, or debugging the mural prep tool.
---

# Stridekeep Mural Prep Tool

> ComfyUI PNG in. Season-ready palette + canvas + SQL out.

## 1. What this tool is

A **standalone Godot 4 desktop application** that handles the Stridekeep per-season mural prep pipeline. Takes a generated PNG (from your ComfyUI workflow), extracts a 10-16 color palette via k-means, lets you curate the metadata (names, tiers, categories, shop prices, craft recipes), and produces:

- A `seed_next_mural(...)` SQL statement ready to paste into Supabase
- A 32×32 quantized PNG uploaded to Supabase Storage at `murals/season_{N}.png`

**Not** a ComfyUI replacement, not a generation tool, not a Godot editor plugin. It's the operational glue between ComfyUI (creative work) and Supabase (game state).

This skill is paired with — and depends on the conventions established in — the parent `stridekeep` skill. Read that first if you're missing context on what murals are, how seasons work, or why per-season palettes exist.

## 2. Why standalone, not an editor plugin

We considered a Godot editor plugin first. Rejected for these reasons:

- **No editor benefits** — the tool doesn't extend Godot's level editor, scene graph, or inspector
- **Distribution friction** — "install Godot, create a project, copy these files into addons/" is worse than shipping a binary
- **Fake host project** — would require an empty Godot project just to host the addon, which is a smell
- **Iteration speed** — hitting Play in Godot launches a real window faster than enable/disable plugin cycles

Verdict: build a real Godot 4 application that exports to `.exe` / `.app`. The `EditorPlugin` framing is gone. Don't reintroduce it.

## 3. Project structure (locked)

```
tools/mural-prep-godot/
├── project.godot                    # Godot 4 project file
├── icon.svg                          # Window icon
├── README.md                         # Setup + usage instructions
├── plugin_config.example.json        # Template (gitignored: plugin_config.json)
│
├── scenes/
│   ├── main.tscn                     # Main window (3-column layout)
│   ├── color_row.tscn                # Reusable: one editable color in palette
│   ├── recipe_row.tscn               # Reusable: one craft recipe editor
│   ├── settings_dialog.tscn          # First-run Supabase config
│   └── queue_status_dialog.tscn      # Queue depth + active season info
│
├── scripts/
│   ├── main.gd                       # App entry point + state machine
│   ├── kmeans.gd                     # Palette extraction (pure logic)
│   ├── quantize.gd                   # Image → palette quantization
│   ├── color_naming.gd               # Generic perceptual color name suggestions
│   ├── color_row.gd                  # Per-color row controller
│   ├── recipe_row.gd                 # Per-recipe row controller
│   ├── watch_folder.gd               # Polls ComfyUI output dir
│   ├── supabase_client.gd            # REST + Storage HTTP wrapper
│   ├── seed_sql.gd                   # Generates seed_next_mural() SQL
│   ├── season_export.gd              # JSON package serialization
│   ├── config.gd                     # Load/save plugin_config.json
│   └── theme.gd                      # Stridekeep visual tokens
│
└── exports/
    └── (gitignored — built binaries)
```

**No `data/color_lexicon.json`.** Color naming is algorithmic (HSL-based descriptive labels), works across every theme. Thematic lexicons were considered and rejected (see §10 anti-patterns).

Each script's reason for existing:

- **`main.gd`** — owns app state, wires UI signals together
- **`kmeans.gd`** — pure function, no Godot dependencies, testable in isolation
- **`quantize.gd`** — applies a finalized palette to an image, outputs the 32×32
- **`color_naming.gd`** — generic perceptual names ("deep red," "muted teal"), no thematic library
- **`watch_folder.gd`** — monitors ComfyUI output dir, surfaces new PNGs in sidebar
- **`supabase_client.gd`** — wraps REST calls, isolates Supabase concerns
- **`seed_sql.gd`** — string templating for the `seed_next_mural(...)` call, kept separate so SQL output is testable
- **`season_export.gd`** — serializes the current curation state to a JSON package
- **`config.gd`** — load/save Supabase URL + anon key from `user://config.json`
- **`theme.gd`** — Slate & Brass tokens matching the Stridekeep app's UI chrome

## 4. Main window layout

Three columns, full window width. Top toolbar, bottom status bar.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Open PNG]  [Watch Folder ▾]  [Settings]  [Queue Status]  [About]       │ Toolbar
├──────────────┬──────────────────────────────┬───────────────────────────┤
│ Watch list   │ Source preview (512×512)     │ Palette curation          │
│              │                              │                           │
│ recent.png   │ ┌────────────────────────┐   │ Mural name: [          ]  │
│ alley.png    │ │                        │   │ Canvas: [32]x[32]         │
│ castle.png   │ │   [Generated PNG]      │   │                           │
│ forge.png    │ │                        │   │ ─── COLORS ────────────── │
│              │ │                        │   │ ▣ S1 [name]  case starter │
│              │ └────────────────────────┘   │ ▣ S2 [name]  case starter │
│              │                              │ ▣ Q1 [name]  case quality │
│              │ Quantized preview (32×32)    │ ▣ F1 [name]  case fine    │
│              │ ┌──────────────┐             │ ▣ X1 [name]  shop  $650   │
│              │ │   [tiny]     │             │ ▣ C1 [name]  craft        │
│              │ └──────────────┘             │                           │
│              │                              │ ─── RECIPES ──────────── │
│              │                              │ + Add recipe              │
│              │                              │                           │
│              │                              │ ─── ACTIONS ──────────── │
│              │                              │ [Validate] [Export JSON]  │
│              │                              │ [Upload + Generate SQL]   │
├──────────────┴──────────────────────────────┴───────────────────────────┤
│ Status: Loaded forge.png · Extracted 12 colors · 1024 pixels mapped     │ Status
└─────────────────────────────────────────────────────────────────────────┘
```

**Sizing:** Window minimum 1280×720, default 1600×900. Three columns flex: left ~240px fixed, middle and right share the remainder.

**Theme:** Slate & Brass tokens, matching the Stridekeep app's UI chrome:

```
slate background:  #2b3138
card surface:      #353c46
cream text:        #f1ede4
brass accent:      #c79c4a
```

Outfit body font, Bebas Neue for headers if available. Visual continuity between this tool and the main app reinforces that they're a coherent product.

## 5. State machine

Five explicit states. Each has clear UI affordances; buttons enable/disable based on state.

```gdscript
enum AppState {
    IDLE,              # No image loaded; waiting for user
    EXTRACTING,        # k-means running; show spinner
    CURATING,          # Palette extracted; user editing metadata
    VALIDATING,        # Click on Validate; checking constraints
    READY_TO_EXPORT,   # All validation passed; Export buttons enabled
}
```

Status bar reflects current state in plain language. No magic state where Export is clickable but the result is malformed — every Export click is preceded by a passed validation.

## 6. Slice-by-slice build plan

Build as four independent slices. Each ends with a working artifact. If you stop after Slice N, you have a tool that does N's worth of work.

### Slice 1: Headless palette extractor (4-6 hours)

**Goal:** prove k-means in GDScript works fast enough on real images.

Build `kmeans.gd` as a pure static function:

```gdscript
class_name KMeans extends RefCounted

# Returns: { centroids: PackedColorArray, labels: PackedInt32Array, weights: PackedFloat32Array }
static func extract(image: Image, k: int = 12, seed: int = 42, max_iter: int = 30) -> Dictionary:
    var rng = RandomNumberGenerator.new()
    rng.seed = seed

    # Sample pixels (downsample if >256x256 for speed)
    var samples = _sample_pixels(image, 256)

    # Convert to LAB color space for perceptually-uniform clustering
    var lab_samples = _rgb_to_lab_batch(samples)

    # Initialize k centroids with k-means++ seeding
    var centroids = _kmeans_pp_init(lab_samples, k, rng)

    # Iterate until convergence
    for iter in max_iter:
        var labels = _assign_labels(lab_samples, centroids)
        var new_centroids = _recompute_centroids(lab_samples, labels, k)
        if _converged(centroids, new_centroids):
            break
        centroids = new_centroids

    # Final assignment + weight computation
    var final_labels = _assign_labels(lab_samples, centroids)
    var weights = _compute_weights(final_labels, k)

    # Convert centroids back to RGB for display
    var rgb_centroids = _lab_to_rgb_batch(centroids)

    # Sort by frequency descending (common → rare)
    var order = _sort_indices_by_weight(weights)
    return {
        "centroids": _reorder(rgb_centroids, order),
        "labels": _remap_labels(final_labels, order),
        "weights": _reorder_weights(weights, order),
    }
```

**Acceptance:** loads a 512×512 PNG, returns a 12-color palette in under 2 seconds on a modern desktop. Ship a `_run_test()` static method that validates this on a hardcoded test PNG.

**If timing fails:** sample more aggressively (max 128×128 = 16K pixel samples). Don't sacrifice LAB conversion for speed — perceptual quality matters more than another second of extraction time.

### Slice 2: Main window with display-only palette (4-6 hours)

**Goal:** working app that loads a PNG and shows extracted palette + quantized preview. No editing yet.

Deliverables:
- `project.godot` with main window settings
- `main.tscn` with the three-column layout from §4
- `main.gd` handling "Open PNG" → load image → call `KMeans.extract()` → display results
- `quantize.gd` rendering the 32×32 quantized preview
- `color_naming.gd` computing generic perceptual names for each extracted color
- Color rows are read-only: swatch + suggested name + hex + weight % + suggested tier

When this works end-to-end and feels responsive, the architecture is validated. Everything else is adding features to this foundation.

### Slice 3: Curation UI (6-8 hours)

The biggest slice. Each color row becomes editable:

```
[swatch] [name input] [category ▾] [tier ▾] [shop_price] [drop_weight%]
```

Auto-suggested name appears in the name field on extraction; user types over it freely. Suggestion is generic perceptual descriptor (see §8). It's a starting point, not a constraint.

Validation rules in this slice:

- At least one starter, one quality, one fine color in `case` category (warn if missing)
- Name field non-empty for every color
- Color IDs auto-generated as `s${seasonNumber}_${slugified_name}`, must be unique within palette
- Drop weights within each tier sum to 100% (with ±0.01 tolerance)
- `shop_price` is positive integer for shop colors
- `craft` category implies the color must be the output of some recipe

Recipe section below colors:
```
+ Add recipe
  Output: [color ▾]    Inputs: [color ▾] x [qty]  + add input
                                 [color ▾] x [qty]
                                                                 [Remove]
```

Recipe validation:
- Output must be a `craft` category color
- All inputs must reference existing palette colors
- **No tier-3 (`fine`) colors as inputs** — load-bearing invariant
- Total input quantities ≥ 2 (must be an actual mix)

The "Validate" button runs all rules. Either turns green (READY_TO_EXPORT state) or shows specific errors next to offending fields.

### Slice 4: Watch folder + Supabase integration (4-6 hours)

Two features in one slice — both are "wire the tool to the outside world."

**Watch folder:**
- Settings dialog has "ComfyUI output folder" field
- `watch_folder.gd` polls that directory every 2 seconds
- New `.png` files appear in left sidebar, sorted by modification time, newest first
- Click a file → loads it as the current source

**Supabase integration:**
- First-run dialog asks for Supabase URL + anon key, saves to `user://config.json`
- `supabase_client.gd` wraps `HTTPRequest` with proper headers
- "Upload + Generate SQL" button:
  1. Predicts next season number via `queue_status()` RPC
  2. POSTs the 32×32 quantized PNG to `murals/season_{predicted_N}.png` via Storage REST API
  3. Builds the `seed_next_mural(...)` SQL string
  4. Copies SQL to clipboard
  5. Shows confirmation dialog with SQL preview
- "Queue Status" button → calls `queue_status()` RPC → displays in dialog

**Why predict the season number client-side:** the alternative is uploading to a staging path, running SQL, then copying the storage object to the final path. Two storage operations vs one. Solo dev, no concurrent seeders — the race condition is theoretical.

## 7. K-means specifics

### Use k-means++ initialization

Random initialization sometimes produces duplicate centroids (two centroids land in the same color cluster, leaving an underrepresented color unrepresented). k-means++ chooses initial centroids spread across the color space — substantially more consistent results across different images. ~20 extra lines of code, large quality improvement.

### Cluster in CIELAB, not RGB

RGB clustering treats `#FF0000` and `#FF1010` as more similar than `#FF0000` and `#A00000` because Euclidean distance in RGB doesn't match perceptual distance. LAB clustering matches human perception, so each extracted color *looks* distinct.

Add `rgb_to_lab(color)` and `lab_to_rgb(lab)` helpers at the top of `kmeans.gd`. About 30 lines of math (sRGB → linear → XYZ → LAB and back). Convert pixels to LAB before clustering, convert centroids back to RGB at the end for display.

This single change is the difference between "okay" extracted palettes and "great" ones for cyberpunk/sunset scenes with lots of similar hues.

### Fixed seed for reproducibility

Always pass `seed = 42` (or any constant) to `RandomNumberGenerator`. Same input image → same palette. Required for testing, debugging, and the "I want to regenerate this exact mural's palette" workflow.

## 8. Color naming (generic perceptual)

`color_naming.gd` produces a descriptive starting-point name from any RGB value. **No thematic lexicon, no curated word list.** The label describes what the color *is* in plain language, not what it *represents* in any genre.

Algorithm:

```gdscript
class_name ColorNaming extends RefCounted

# Returns a generic perceptual label like "deep red", "muted teal", "warm gold"
static func suggest(c: Color) -> String:
    var hsl = _to_hsl(c)
    var h = hsl.x  # 0-360 hue
    var s = hsl.y  # 0-1 saturation
    var l = hsl.z  # 0-1 lightness

    # Lightness modifier
    var lightness_mod := ""
    if l < 0.20: lightness_mod = "very dark "
    elif l < 0.40: lightness_mod = "dark "
    elif l > 0.80: lightness_mod = "very light "
    elif l > 0.65: lightness_mod = "light "

    # Saturation modifier
    var sat_mod := ""
    if s < 0.10: return lightness_mod + _gray_label(l)  # very low sat = grays
    elif s < 0.30: sat_mod = "muted "
    elif s > 0.80: sat_mod = "vivid "

    # Hue label
    var hue_label := _hue_to_label(h)

    return (lightness_mod + sat_mod + hue_label).strip_edges()

static func _hue_to_label(h: float) -> String:
    # 12 hue buckets at 30° intervals
    if h < 15.0 or h >= 345.0: return "red"
    elif h < 45.0:  return "warm orange"
    elif h < 75.0:  return "orange"
    elif h < 105.0: return "yellow"
    elif h < 135.0: return "yellow-green"
    elif h < 165.0: return "green"
    elif h < 195.0: return "teal"
    elif h < 225.0: return "cyan"
    elif h < 255.0: return "blue"
    elif h < 285.0: return "indigo"
    elif h < 315.0: return "purple"
    else: return "magenta"

static func _gray_label(l: float) -> String:
    if l < 0.15: return "black"
    elif l < 0.30: return "charcoal"
    elif l < 0.50: return "dark gray"
    elif l < 0.70: return "gray"
    elif l < 0.85: return "light gray"
    else: return "off-white"
```

Output examples:
- `#8c3b2a` → `"dark red"`
- `#476b86` → `"muted blue"`
- `#eae3d0` → `"very light yellow"` (rename to "Bone" or "Cream" during curation)
- `#ff66cc` → `"vivid magenta"`
- `#222222` → `"charcoal"`

The names are intentionally bland. They tell you *what hue* without committing to a theme. Always overwritten during curation — the suggestion just removes the "stare at a blank field for 5 seconds" friction.

About 100 lines of code total. No data file. Works for cyberpunk, natural, abstract, architectural — any theme — because it describes the color, not the genre.

## 9. Tier suggestion heuristic

Default tier assignment based on weight:

```
weight ≥ 0.10 → starter (tier-1)
weight ≥ 0.04 → quality (tier-2)
weight  < 0.04 → fine (tier-3)
```

Stridekeep's Phase 4 plan calls for ~50-60% tier-1, ~25-35% tier-2, ~10-20% tier-3 by **count of colors** (not pixel count). Validate that the auto-suggested distribution matches before accepting. If not, surface a warning suggesting reassignment.

User can override any tier. The heuristic is a starting point, not a constraint.

## 10. Anti-patterns (don't reintroduce)

- ❌ **Godot editor plugin.** This was the original framing; rejected for reasons in §2. Don't pull the tool back into addon-land.
- ❌ **Thematic color lexicons.** Tempting feature — auto-suggest "Verdigris" or "Crimson Madder" or "Neon Plasma" based on theme. Rejected because each season's mural is theme-unrestricted; any locked lexicon would either constrain or mismatch. Generic perceptual naming serves the same friction-reduction purpose without aesthetic baggage.
- ❌ **ComfyUI API integration.** Tempting to embed generation in this tool. Rejected because: (a) couples to ComfyUI's release cadence, (b) reimplements a polished tool's UI worse, (c) creative exploration and operational curation are different mental modes. Watch folder gives 80% of the integration benefit at 5% of the cost.
- ❌ **Auto-generated mural pipelines.** Server-side or scheduled ComfyUI runs would produce uncurated content. Mural curation stays human.
- ❌ **Floyd-Steinberg dithering as default.** Pure nearest-neighbor downscale produces cleaner pixel art for most generations. Dithering can be added as an optional toggle in polish pass; not a default.
- ❌ **RGB-space k-means.** LAB is the right space for perceptual clustering. RGB produces palettes where some colors look near-identical to the human eye despite different RGB values.
- ❌ **Project-bundled Supabase credentials.** `plugin_config.json` is gitignored. Credentials live in `user://config.json` (per-user app data dir). Never commit URLs or keys.
- ❌ **Skipping validation.** Every Export action requires a passed Validate first. Don't add a "skip validation" mode for power users — there's one user, the validation IS the safety net.

## 11. What's deferred to polish pass

Ships in MVP (Slices 1-4):
- Palette extraction with k-means++ in LAB space
- Generic perceptual color naming
- Manual curation (name, category, tier, shop price, drop weight)
- Recipe definition
- Validation
- 32×32 quantized preview
- Watch folder
- Supabase upload + SQL generation
- Queue status display

Polish pass (after Phase 4 ships, week 2-3 of beta):
- Heuristic category suggestions (metallic detection — high saturation + mid luminance + warm/cool axis)
- Heuristic recipe suggestions (color adjacency analysis)
- Floyd-Steinberg dithering option in quantize step
- Touchup brush for individual pixel corrections
- Name collision detection across last 10 seasons
- Feasibility check thresholds (calibrated from real season data)
- Color blind preview mode

Deferred indefinitely:
- Thematic color lexicons (see §10)
- ComfyUI API integration (see §10)
- Auto-generation pipelines (see §10)

## 12. Technical patterns

### Settings persistence

`user://config.json` for Supabase credentials. Per-platform locations Godot manages automatically:

```
Windows: %APPDATA%/Godot/app_userdata/StridekeepMuralPrep/
macOS:   ~/Library/Application Support/Godot/app_userdata/StridekeepMuralPrep/
Linux:   ~/.local/share/godot/app_userdata/StridekeepMuralPrep/
```

Use `FileAccess.open("user://config.json", FileAccess.WRITE)`. Godot resolves the path correctly per-platform.

### HTTPRequest pattern

`HTTPRequest` is single-shot (one request per node). For multiple sequential requests, create a fresh node per call:

```gdscript
func _make_request(url: String, method: int, body: String, headers: PackedStringArray) -> Dictionary:
    var req = HTTPRequest.new()
    add_child(req)
    req.request(url, headers, method, body)
    var result = await req.request_completed
    req.queue_free()
    return _parse_result(result)
```

Wrap in `supabase_client.gd` so the rest of the code calls `await SupabaseClient.upload_png(...)` cleanly.

### Watch folder polling

Don't use OS file-watch APIs (Godot's cross-platform support is uneven). Use a `Timer` node firing every 2 seconds, calling `DirAccess.get_files()` on the configured ComfyUI output folder, comparing modification times to detect new files. Simple, reliable, cross-platform.

## 13. Ship checklist

Before declaring MVP done:

- [ ] Extracts palette from a 512×512 PNG in under 2 seconds
- [ ] Quantized preview matches expected k-means output
- [ ] All metadata fields editable; saves correctly
- [ ] Recipe validation enforces tier-3 invariant
- [ ] Validation fails clearly when something is wrong (specific field, specific reason)
- [ ] Generates valid `seed_next_mural()` SQL that the Supabase RPC accepts
- [ ] Uploads PNG to correct Storage path (`murals/season_{N}.png`)
- [ ] First-run config dialog works on a clean install
- [ ] Watch folder updates when ComfyUI saves new files
- [ ] Queue status dialog reflects current Supabase state
- [ ] Tested with 3 real ComfyUI murals end-to-end

When all those check, the mural production pipeline is operational.

## 14. End-to-end production loop

What the tool enables, in user time:

1. Generate 4 candidates in ComfyUI (~10 seconds with Z-Image Turbo on a 4080)
2. New PNG appears in tool's watch folder sidebar (instant)
3. Click the best one → palette auto-extracts (~1-2 seconds)
4. Curate names + categories + tiers (2-3 minutes manual entry)
5. Click Validate → green (~5 seconds)
6. Click Upload + Generate SQL → SQL on clipboard (~5 seconds)
7. Paste SQL into Supabase SQL editor, run (~10 seconds)

Total: ~5 minutes per mural. Sustainable for weekly content production.

## 15. Reference files

- `tools/mural-prep-godot/README.md` — setup + usage instructions
- `tools/mural-comfyui-workflow.json` — ComfyUI workflow that produces the input PNGs
- `.claude/skills/stridekeep/SKILL.md` — parent skill (game design, audience, mechanics)
- `tools/mural-prep-godot/SKILL.md` — this file

## 16. When to update this file

Update this SKILL.md whenever you:

- Reverse a previous architectural decision (e.g., "actually we DO want ComfyUI integration")
- Add or remove a slice from the build plan
- Change a color naming, k-means, or quantization algorithm
- Discover a new anti-pattern worth recording
- Move a feature between MVP and polish pass

The contract-with-yourself principle from the parent skill applies here too. Past-you made careful decisions about scope. Future-you will be tempted to add features mid-build. This file is the document that says "no, we said we'd defer that, build the simple version first."

---

## One final reminder

Before adding any feature to this tool, ask:

> **"Will this make my next mural prep session faster, or am I just gold-plating?"**

If yes, build it. If no, defer to polish pass.

Manual curation works fine for the first 10 murals. You don't know what your real workflow needs until you've actually done it for real seasons. Build the simple thing. Use it. Then optimize.
