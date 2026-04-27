# Stridekeep Mural Prep Tool

Standalone Godot 4 desktop application that turns a ComfyUI-generated PNG into a season-ready palette + canvas + SQL package for Stridekeep.

See [SKILL.md](SKILL.md) for the full design doc — audience, architecture, slice plan, anti-patterns.

## Status

- **Slice 1 (headless palette extractor):** implemented. Run `test_slice1.gd` to verify.
- Slice 2 (main window + display palette): **not yet built** — opening `main.tscn` shows a placeholder.
- Slice 3 (curation UI): not yet built.
- Slice 4 (watch folder + Supabase): not yet built.

## Requirements

- Godot 4.3 or newer on PATH (or use Steam install's `godot.exe`).
- Any RGB PNG for testing (256x256 or larger recommended).

## Run the Slice 1 headless test

```bash
# 1. Drop a sample image into test_assets/
cp ~/Downloads/some_mural.png test_assets/sample.png

# 2. Run the headless extractor
godot --headless --path . --script res://test_slice1.gd
```

Expected output: 12 colors with hex, weight %, and a generic perceptual name (e.g. "dark red", "muted teal"), plus a PASS/WARN line for the <2 second timing target.

The test is deterministic — same input PNG always produces the same palette (fixed RNG seed).

## Open the project in Godot

```bash
godot --path .
```

Currently shows a placeholder label. UI work begins in Slice 2.

## File layout

```
project.godot        # Godot 4 project config
icon.svg             # Window icon
SKILL.md             # Design doc (source of truth)
README.md            # This file
test_slice1.gd       # Headless palette extractor test

scenes/
  main.tscn          # Three-column main window (Slice 2 — placeholder for now)
  color_row.tscn     # Reusable: one editable color row (Slice 3)
  recipe_row.tscn    # Reusable: one craft recipe row (Slice 3)
  settings_dialog.tscn      # First-run Supabase config (Slice 4)
  queue_status_dialog.tscn  # Active season + queue depth (Slice 4)

scripts/
  main.gd            # App entry point + state machine
  kmeans.gd          # Palette extraction (Slice 1, FULL)
  color_naming.gd    # Generic perceptual color names (Slice 1, FULL)
  theme.gd           # Slate & Brass tokens (FULL)
  config.gd          # Load/save user://config.json (FULL)
  quantize.gd        # Image -> palette quantization (Slice 2)
  color_row.gd       # Per-color row controller (Slice 3)
  recipe_row.gd      # Per-recipe row controller (Slice 3)
  watch_folder.gd    # Polls ComfyUI output dir (Slice 4)
  supabase_client.gd # REST + Storage HTTP wrapper (Slice 4)
  seed_sql.gd        # Generates seed_next_mural() SQL (Slice 4)
  season_export.gd   # JSON package serialization (Slice 3)

test_assets/         # gitignored; user-provided sample PNGs
exports/             # gitignored; built binaries
```

## Configuration

First run will create `user://config.json` (per-user app data dir managed by Godot). Supabase URL + anon key go there — never commit credentials.

`plugin_config.example.json` shows the shape; copy to `plugin_config.json` (gitignored) for project-local overrides during development.

## Optional: Godot MCP for Claude integration

The `addons/` directory is gitignored. To drive this project from Claude's Godot MCP during development, install the `godot_mcp` addon:

1. Copy `<godot-mcp-pro>/addons/godot_mcp` into `tools/mural-prep-godot/addons/godot_mcp`.
2. In Godot: Project → Project Settings → Plugins → enable `godot_mcp`.
3. The addon adds three autoloads (`MCPScreenshot`, `MCPInputService`, `MCPGameInspector`) and an `MCP Server` panel.

These changes are local-only and won't be committed because `addons/` and the autoload/editor_plugins config aren't tracked.
