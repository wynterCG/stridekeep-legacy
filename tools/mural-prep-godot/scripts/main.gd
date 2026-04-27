extends Control

# Stridekeep Mural Prep — Slice 3.
# Three-column main window with editable palette curation and recipe editing.
# Validation runs only when the Validate button is pressed (per SKILL.md §6 —
# never auto-validates, never silently skips on Export).

const KMeansLib := preload("res://scripts/kmeans.gd")
const ColorNamingLib := preload("res://scripts/color_naming.gd")
const QuantizeLib := preload("res://scripts/quantize.gd")
const ThemeLib := preload("res://scripts/theme.gd")
const ValidationLib := preload("res://scripts/validation.gd")
const ColorRowScene := preload("res://scenes/color_row.tscn")
const RecipeRowScene := preload("res://scenes/recipe_row.tscn")

const DEFAULT_K := 12

enum AppState { IDLE, EXTRACTING, CURATING, VALIDATING, READY_TO_EXPORT }

# ---- Node references ---------------------------------------------------------

@onready var _open_btn: Button = $Root/Toolbar/ToolbarMargin/ToolbarRow/OpenPng
@onready var _about_btn: Button = $Root/Toolbar/ToolbarMargin/ToolbarRow/About
@onready var _source_preview: TextureRect = $Root/Body/MiddleCol/MiddleMargin/MiddleVBox/SourcePreview
@onready var _quant_preview: TextureRect = $Root/Body/MiddleCol/MiddleMargin/MiddleVBox/QuantPreview

@onready var _palette_list: VBoxContainer = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/PaletteList
@onready var _palette_empty: Label = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/PaletteList/PaletteEmpty

@onready var _recipes_list: VBoxContainer = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/RecipesList
@onready var _recipes_empty: Label = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/RecipesList/RecipesEmpty
@onready var _add_recipe_btn: Button = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/AddRecipeBtn

@onready var _validate_btn: Button = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/Validate
@onready var _export_btn: Button = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/ExportJson
@onready var _upload_btn: Button = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/Upload

@onready var _mural_input: LineEdit = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/MuralRow/MuralInput
@onready var _season_spin: SpinBox = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/SeasonRow/SeasonNum
@onready var _canvas_w_spin: SpinBox = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/CanvasRow/CanvasW
@onready var _canvas_h_spin: SpinBox = $Root/Body/RightCol/RightMargin/RightScroll/RightVBox/CanvasRow/CanvasH

@onready var _status_label: Label = $Root/StatusBar/StatusMargin/StatusLabel

@onready var _toolbar_panel: PanelContainer = $Root/Toolbar
@onready var _left_panel: PanelContainer = $Root/Body/LeftCol
@onready var _middle_panel: PanelContainer = $Root/Body/MiddleCol
@onready var _right_panel: PanelContainer = $Root/Body/RightCol
@onready var _statusbar_panel: PanelContainer = $Root/StatusBar

# ---- App state ---------------------------------------------------------------

var _state: AppState = AppState.IDLE
var _last_loaded_path := ""
var _last_source_image: Image = null
var _last_palette: PackedColorArray = PackedColorArray()
var _color_rows: Array = []     # Array of HBoxContainer (color_row instances)
var _recipe_rows: Array = []    # Array of VBoxContainer (recipe_row instances)
var _suppress_signal: bool = false

# ---- Lifecycle ---------------------------------------------------------------

func _ready() -> void:
	_apply_panel_themes()
	_open_btn.pressed.connect(_on_open_png)
	_about_btn.pressed.connect(_on_about)
	_validate_btn.pressed.connect(_on_validate)
	_add_recipe_btn.pressed.connect(_on_add_recipe)
	_set_status("IDLE — Open a PNG to begin.")
	_export_btn.tooltip_text = "Validate first; then JSON export will enable."
	_upload_btn.tooltip_text = "Slice 4: Supabase upload + SQL generation."

func _apply_panel_themes() -> void:
	var card := _make_panel_style(ThemeLib.CARD)
	var status := _make_panel_style(ThemeLib.BG_SLATE)
	_toolbar_panel.add_theme_stylebox_override("panel", card)
	_left_panel.add_theme_stylebox_override("panel", card)
	_middle_panel.add_theme_stylebox_override("panel", card)
	_right_panel.add_theme_stylebox_override("panel", card)
	_statusbar_panel.add_theme_stylebox_override("panel", status)

func _make_panel_style(bg: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	return sb

# ---- File loading ------------------------------------------------------------

func _on_open_png() -> void:
	var dialog := FileDialog.new()
	dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	dialog.filters = PackedStringArray(["*.png ; PNG Image", "*.jpg, *.jpeg ; JPEG Image"])
	dialog.title = "Open mural source"
	dialog.size = Vector2i(900, 600)
	add_child(dialog)
	dialog.file_selected.connect(_on_file_selected)
	dialog.canceled.connect(func(): dialog.queue_free())
	dialog.popup_centered()

func _on_file_selected(path: String) -> void:
	_load_image(path)

func _load_image(path: String) -> void:
	var image := Image.new()
	var err := image.load(path)
	if err != OK:
		_set_status("ERROR — failed to load %s (code %d)" % [path.get_file(), err])
		return
	_last_loaded_path = path
	_last_source_image = image
	_mural_input.text = path.get_file().get_basename()
	_show_source(image)
	await _run_extraction(image)

func _show_source(image: Image) -> void:
	_source_preview.texture = ImageTexture.create_from_image(image)

# ---- Extraction --------------------------------------------------------------

func _run_extraction(image: Image) -> void:
	_state = AppState.EXTRACTING
	_set_status("EXTRACTING — running k-means in CIELAB ...")
	_clear_palette_rows()
	_clear_recipes()
	await get_tree().process_frame

	var t0 := Time.get_ticks_msec()
	var result: Dictionary = KMeansLib.extract(image, DEFAULT_K)
	var elapsed := Time.get_ticks_msec() - t0

	var centroids: PackedColorArray = result.centroids
	var weights: PackedFloat32Array = result.weights
	_last_palette = centroids

	_populate_palette_rows(centroids, weights)
	_show_quantized(image, centroids)
	_recompute_codes()

	_state = AppState.CURATING
	var pixel_count := int(_canvas_w_spin.value) * int(_canvas_h_spin.value)
	_set_status("CURATING — extracted %d colors in %d ms · %d pixels mapped. Edit fields, then click Validate." % [centroids.size(), elapsed, pixel_count])

# ---- Palette rows ------------------------------------------------------------

func _clear_palette_rows() -> void:
	for row in _color_rows:
		row.queue_free()
	_color_rows.clear()
	_palette_empty.visible = true

func _populate_palette_rows(centroids: PackedColorArray, weights: PackedFloat32Array) -> void:
	_palette_empty.visible = false
	# Group raw weights by suggested tier and normalize within each tier so
	# the auto drop_weight_pct values sum to exactly 100% on first paint.
	# Rounding residual is absorbed by the last color in each tier — keeps
	# validation happy without forcing the user to nudge SpinBox steps.
	var suggested_tiers: Array[String] = []
	suggested_tiers.resize(centroids.size())
	var per_tier_total := {"starter": 0.0, "quality": 0.0, "fine": 0.0}
	var per_tier_indices := {"starter": [], "quality": [], "fine": []}
	for i in centroids.size():
		var tier := _suggest_tier(weights[i])
		suggested_tiers[i] = tier
		per_tier_total[tier] = per_tier_total[tier] + weights[i]
		(per_tier_indices[tier] as Array).append(i)

	# Compute snapped (2dp) drop percentages, then push rounding residual
	# into the last index of each tier so the per-tier sum is exact.
	var drop_pcts := PackedFloat32Array()
	drop_pcts.resize(centroids.size())
	for tier in ["starter", "quality", "fine"]:
		var indices: Array = per_tier_indices[tier]
		if indices.is_empty():
			continue
		var tier_total: float = per_tier_total[tier]
		var running := 0.0
		for j in range(indices.size() - 1):
			var idx: int = indices[j]
			var raw_pct := (weights[idx] / tier_total) * 100.0
			var snapped_pct := snappedf(raw_pct, 0.01)
			drop_pcts[idx] = snapped_pct
			running += snapped_pct
		var last_idx: int = indices[indices.size() - 1]
		# Clamp to [0, 100] — snapped accumulation can in theory go negative
		# if rounding pushes `running` past 100; SpinBox.min_value would then
		# silently floor it and validation would report a bogus sum mismatch.
		drop_pcts[last_idx] = clampf(snappedf(100.0 - running, 0.01), 0.0, 100.0)

	_suppress_signal = true
	for i in centroids.size():
		var row = ColorRowScene.instantiate()
		row.state_changed.connect(_on_color_row_changed)
		_palette_list.add_child(row)
		_color_rows.append(row)
		var name_label := ColorNamingLib.suggest(centroids[i])
		row.init_from_extraction(centroids[i], name_label, weights[i], suggested_tiers[i], drop_pcts[i])
	_suppress_signal = false

static func _suggest_tier(weight: float) -> String:
	# SKILL.md §9 — same heuristic, kept here for symmetry with color_row.suggest_tier.
	if weight >= 0.10:
		return "starter"
	elif weight >= 0.04:
		return "quality"
	return "fine"

func _on_color_row_changed() -> void:
	if _suppress_signal:
		return
	_recompute_codes()
	_refresh_recipe_dropdowns()
	# Reset to CURATING so a prior PASS doesn't stay green after edits.
	if _state == AppState.READY_TO_EXPORT:
		_state = AppState.CURATING
		_export_btn.disabled = true
		_set_status("CURATING — palette edited; re-run Validate.")

func _recompute_codes() -> void:
	# Group rows by (category, tier) and assign sequential codes per group.
	# Prefix mapping: case+starter=S, case+quality=Q, case+fine=F, shop=P, craft=C.
	var counters := {"S": 0, "Q": 0, "F": 0, "P": 0, "C": 0}
	for row in _color_rows:
		var prefix := _code_prefix_for(row.get_category(), row.get_tier())
		counters[prefix] = counters[prefix] + 1
		row.set_code("%s%d" % [prefix, counters[prefix]])

static func _code_prefix_for(category: String, tier: String) -> String:
	match category:
		"shop": return "P"
		"craft": return "C"
		"case":
			match tier:
				"starter": return "S"
				"quality": return "Q"
				"fine": return "F"
	return "?"

# ---- Recipes -----------------------------------------------------------------

func _clear_recipes() -> void:
	for r in _recipe_rows:
		r.queue_free()
	_recipe_rows.clear()
	_recipes_empty.visible = true

func _on_add_recipe() -> void:
	if _color_rows.is_empty():
		_set_status("CURATING — extract a palette before adding recipes.")
		return
	_recipes_empty.visible = false
	var recipe: VBoxContainer = RecipeRowScene.instantiate()
	_recipes_list.add_child(recipe)
	_recipe_rows.append(recipe)
	recipe.state_changed.connect(_on_recipe_changed)
	recipe.remove_requested.connect(_on_recipe_remove.bind(recipe))
	recipe.init_with_palette(_palette_codes_array())
	_renumber_recipes()
	if _state == AppState.READY_TO_EXPORT:
		_state = AppState.CURATING
		_export_btn.disabled = true

func _on_recipe_remove(recipe) -> void:
	_recipe_rows.erase(recipe)
	recipe.queue_free()
	_recipes_empty.visible = _recipe_rows.is_empty()
	_renumber_recipes()
	if _state == AppState.READY_TO_EXPORT:
		_state = AppState.CURATING
		_export_btn.disabled = true

func _on_recipe_changed() -> void:
	if _state == AppState.READY_TO_EXPORT:
		_state = AppState.CURATING
		_export_btn.disabled = true

func _renumber_recipes() -> void:
	for i in _recipe_rows.size():
		_recipe_rows[i].set_index(i + 1)

func _refresh_recipe_dropdowns() -> void:
	if _recipe_rows.is_empty():
		return
	var codes := _palette_codes_array()
	for r in _recipe_rows:
		r.update_palette(codes)

func _palette_codes_array() -> PackedStringArray:
	# "S1 bone", "Q3 pine", ... — used as dropdown labels in recipe rows.
	var arr := PackedStringArray()
	for row in _color_rows:
		var s = row.get_state()
		var label := "%s %s" % [s.code, s.name if s.name != "" else "(unnamed)"]
		arr.append(label)
	return arr

# ---- Quantized preview -------------------------------------------------------

func _show_quantized(source: Image, palette: PackedColorArray) -> void:
	if palette.size() == 0:
		return
	var w := int(_canvas_w_spin.value)
	var h := int(_canvas_h_spin.value)
	var quantized := QuantizeLib.quantize_to_palette(source, palette, w, h)
	_quant_preview.texture = ImageTexture.create_from_image(quantized)

# ---- Validation --------------------------------------------------------------

func _on_validate() -> void:
	if _color_rows.is_empty():
		_set_status("VALIDATING — no palette extracted. Open a PNG first.")
		return
	_state = AppState.VALIDATING
	var palette_state: Array = []
	for row in _color_rows:
		palette_state.append(row.get_state())
		row.clear_errors()
	var recipe_state: Array = []
	for r in _recipe_rows:
		recipe_state.append(r.get_state())
		r.clear_errors()
	var season_num := int(_season_spin.value)

	var issues: Array = ValidationLib.validate(palette_state, recipe_state, season_num)

	if issues.is_empty():
		_state = AppState.READY_TO_EXPORT
		_export_btn.disabled = false
		_set_status("✓ READY — %d colors, %d recipes, season %d. Validation passed." % [_color_rows.size(), _recipe_rows.size(), season_num])
		_validate_btn.modulate = ThemeLib.SUCCESS
		return

	_validate_btn.modulate = ThemeLib.ERROR
	_export_btn.disabled = true
	_state = AppState.CURATING
	# Surface per-field errors.
	for issue in issues:
		_apply_issue(issue)
	# Status: count errors and show first message.
	var first_msg: String = issues[0].message
	_set_status("✗ VALIDATION — %d issue%s. First: %s" % [issues.size(), "s" if issues.size() != 1 else "", first_msg])
	# Print full list to stdout for the developer.
	print("Validation issues:")
	for issue in issues:
		print("  [%s #%d %s] %s" % [issue.scope, issue.index + 1, issue.subfield, issue.message])

func _apply_issue(issue: Dictionary) -> void:
	match issue.scope:
		"color":
			if issue.index >= 0 and issue.index < _color_rows.size():
				_color_rows[issue.index].mark_error(issue.subfield)
		"recipe":
			if issue.index >= 0 and issue.index < _recipe_rows.size():
				var r = _recipe_rows[issue.index]
				if issue.subfield == "output":
					r.mark_output_error(true)
				elif issue.subfield.begins_with("input_"):
					var n := int(issue.subfield.substr(6))
					r.mark_input_error(n, true)
		"global":
			pass  # surfaced via status bar text

# ---- Status & misc -----------------------------------------------------------

func _set_status(msg: String) -> void:
	_status_label.text = msg

func _on_about() -> void:
	var dlg := AcceptDialog.new()
	dlg.title = "Stridekeep Mural Prep"
	dlg.dialog_text = "Slice 3 — palette curation + recipes + validation.\n\nSee SKILL.md for the full build plan."
	add_child(dlg)
	dlg.confirmed.connect(func(): dlg.queue_free())
	dlg.canceled.connect(func(): dlg.queue_free())
	dlg.popup_centered()
