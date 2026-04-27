extends HBoxContainer

# Stridekeep Mural Prep — Slice 3.
# Editable palette row. Owns per-color metadata; emits `state_changed`
# whenever any field mutates so main.gd can recompute color codes,
# normalize weights, and re-run validation.

signal state_changed

const ThemeLib := preload("res://scripts/theme.gd")

const CATEGORY_CASE := "case"
const CATEGORY_SHOP := "shop"
const CATEGORY_CRAFT := "craft"
const TIER_STARTER := "starter"
const TIER_QUALITY := "quality"
const TIER_FINE := "fine"

const _CATEGORIES := [CATEGORY_CASE, CATEGORY_SHOP, CATEGORY_CRAFT]
const _TIERS := [TIER_STARTER, TIER_QUALITY, TIER_FINE]

@onready var _swatch: ColorRect = $Swatch
@onready var _code_label: Label = $Code
@onready var _name_input: LineEdit = $Name
@onready var _category_btn: OptionButton = $Category
@onready var _tier_btn: OptionButton = $Tier
@onready var _price_spin: SpinBox = $Price
@onready var _drop_spin: SpinBox = $DropWeight
@onready var _raw_weight_label: Label = $RawWeight

# Persistent state — initial values applied via init_from_extraction,
# then mutated through the UI signals.
var _rgb: Color = Color.BLACK
var _raw_weight: float = 0.0
func _ready() -> void:
	_populate_dropdowns()
	_category_btn.item_selected.connect(_on_category_changed)
	_tier_btn.item_selected.connect(_on_field_changed)
	_name_input.text_changed.connect(_on_text_changed)
	_drop_spin.value_changed.connect(_on_value_changed)
	_price_spin.value_changed.connect(_on_value_changed)
	_refresh_visibility()

# Caller contract: instantiate, add_child, THEN call init_from_extraction.
# add_child triggers _ready synchronously in Godot 4 — option buttons are
# populated and signals connected by the time we get here.
func init_from_extraction(rgb: Color, suggested_name: String, raw_weight: float, default_tier: String, default_drop_pct: float) -> void:
	assert(is_inside_tree(), "init_from_extraction called before add_child — caller must add to tree first")
	_rgb = rgb
	_raw_weight = raw_weight
	_swatch.color = rgb
	_name_input.text = suggested_name
	_set_category(CATEGORY_CASE, false)
	_set_tier(default_tier, false)
	_drop_spin.value = default_drop_pct
	_price_spin.value = 100.0
	_raw_weight_label.text = "%5.1f%%" % (raw_weight * 100.0)
	_refresh_visibility()

func set_code(text: String) -> void:
	_code_label.text = text

# Hex string for the swatch — used by main.gd to build the export package.
func get_hex() -> String:
	return "#%02x%02x%02x" % [
		int(round(_rgb.r * 255.0)),
		int(round(_rgb.g * 255.0)),
		int(round(_rgb.b * 255.0)),
	]

func get_raw_weight() -> float:
	return _raw_weight

func get_state() -> Dictionary:
	return {
		"rgb": _rgb,
		"raw_weight": _raw_weight,
		"name": _name_input.text.strip_edges(),
		"category": get_category(),
		"tier": get_tier(),
		"shop_price": int(_price_spin.value),
		"drop_weight_pct": _drop_spin.value,
		"hex": get_hex(),
		"code": _code_label.text,
	}

func get_category() -> String:
	if _category_btn.selected < 0:
		return CATEGORY_CASE
	return _CATEGORIES[_category_btn.selected]

func get_tier() -> String:
	if _tier_btn.selected < 0:
		return TIER_STARTER
	return _TIERS[_tier_btn.selected]

# Highlight or clear an error border on a specific field.
# field: "name" | "drop_weight" | "shop_price" | "category" | "tier" | ""
func mark_error(field: String) -> void:
	_clear_error_borders()
	if field == "":
		return
	match field:
		"name": _add_error_border(_name_input)
		"drop_weight": _add_error_border(_drop_spin)
		"shop_price": _add_error_border(_price_spin)
		_: pass

func clear_errors() -> void:
	_clear_error_borders()

# ---- Population & visibility -------------------------------------------------

func _populate_dropdowns() -> void:
	_category_btn.clear()
	for label in _CATEGORIES:
		_category_btn.add_item(label)
	_tier_btn.clear()
	for label in _TIERS:
		_tier_btn.add_item(label)

func _set_category(cat: String, fire_signal: bool = true) -> void:
	var idx := _CATEGORIES.find(cat)
	if idx < 0:
		idx = 0
	_category_btn.select(idx)
	if fire_signal:
		_on_category_changed(idx)

func _set_tier(tier: String, fire_signal: bool = true) -> void:
	var idx := _TIERS.find(tier)
	if idx < 0:
		idx = 0
	_tier_btn.select(idx)
	if fire_signal:
		_on_field_changed(idx)

func _refresh_visibility() -> void:
	var cat := get_category()
	_tier_btn.visible = (cat == CATEGORY_CASE)
	_drop_spin.visible = (cat == CATEGORY_CASE)
	_price_spin.visible = (cat == CATEGORY_SHOP)

# ---- Signal handlers ---------------------------------------------------------

func _on_category_changed(_idx: int) -> void:
	_refresh_visibility()
	state_changed.emit()

func _on_field_changed(_idx: int) -> void:
	state_changed.emit()

func _on_text_changed(_t: String) -> void:
	state_changed.emit()

func _on_value_changed(_v: float) -> void:
	state_changed.emit()

# ---- Error border styling ----------------------------------------------------

func _add_error_border(node: Control) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = ThemeLib.CARD
	sb.border_color = ThemeLib.ERROR
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.corner_radius_top_left = 4
	sb.corner_radius_top_right = 4
	sb.corner_radius_bottom_left = 4
	sb.corner_radius_bottom_right = 4
	if node is LineEdit:
		node.add_theme_stylebox_override("normal", sb)
		node.add_theme_stylebox_override("focus", sb)
	else:
		node.add_theme_stylebox_override("normal", sb)

func _clear_error_borders() -> void:
	_name_input.remove_theme_stylebox_override("normal")
	_name_input.remove_theme_stylebox_override("focus")
	_drop_spin.remove_theme_stylebox_override("normal")
	_price_spin.remove_theme_stylebox_override("normal")
