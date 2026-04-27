extends VBoxContainer

# Stridekeep Mural Prep — Slice 3.
# Editable recipe row. Output color + N input rows (color + qty + remove).
# Per SKILL.md §6 Slice 3, validation enforces:
#   - Output must be a `craft`-category color (checked at Validate time).
#   - All inputs must reference existing palette colors.
#   - No tier-3 colors as inputs (load-bearing invariant).
#   - Total input quantities >= 2.
# We show all palette colors in dropdowns and surface bad selections at
# Validate time rather than filtering aggressively — categories can change
# while the user is editing, and silent dropdown reshuffles are confusing.
#
# LOAD-BEARING INVARIANT (do not break in Slice 4+):
#   `output_color_idx` and `inputs[*].color_idx` are integer indices into
#   main.gd's `_color_rows` array, in the same order returned by
#   `_palette_codes_array()`. If palette rows are ever added, removed, or
#   reordered while recipes exist, those indices silently mis-attribute and
#   validation runs against the wrong color. main.gd MUST clear all recipes
#   when it mutates the palette row list (see _clear_palette_rows ->
#   _clear_recipes call in _run_extraction). A safer contract would be to
#   key recipes by stable color id, but that costs a remap layer; revisit if
#   Slice 4+ introduces partial palette mutations.

signal state_changed
signal remove_requested

const ThemeLib := preload("res://scripts/theme.gd")

@onready var _title: Label = $Header/Title
@onready var _remove_btn: Button = $Header/RemoveBtn
@onready var _output_btn: OptionButton = $OutputRow/Output
@onready var _inputs_container: VBoxContainer = $InputsContainer
@onready var _add_input_btn: Button = $AddInputBtn

var _palette_codes: PackedStringArray = PackedStringArray()  # display labels: "S1 bone"

func _ready() -> void:
	_remove_btn.pressed.connect(func(): remove_requested.emit())
	_add_input_btn.pressed.connect(_on_add_input)
	_output_btn.item_selected.connect(_on_field_changed)

# Caller contract: instantiate, add_child, THEN call update_palette /
# set_index / init_with_palette. add_child fires _ready synchronously, so
# @onready references are live by the time these run.
func update_palette(palette_codes: PackedStringArray) -> void:
	assert(is_inside_tree(), "update_palette called before add_child")
	_palette_codes = palette_codes
	_repopulate_dropdown(_output_btn)
	for input_row in _inputs_container.get_children():
		var dropdown := input_row.get_node("Color") as OptionButton
		_repopulate_dropdown(dropdown)

func set_index(n: int) -> void:
	assert(is_inside_tree(), "set_index called before add_child")
	_title.text = "Recipe %d" % n

# Called once after instantiation. Adds one starting input row.
func init_with_palette(palette_codes: PackedStringArray) -> void:
	update_palette(palette_codes)
	_add_input_row()

func get_state() -> Dictionary:
	var inputs: Array = []
	for input_row in _inputs_container.get_children():
		var dropdown := input_row.get_node("Color") as OptionButton
		var qty_spin := input_row.get_node("Qty") as SpinBox
		inputs.append({
			"color_idx": dropdown.selected,
			"qty": int(qty_spin.value),
		})
	return {
		"output_color_idx": _output_btn.selected,
		"inputs": inputs,
	}

# ---- Input row construction --------------------------------------------------

func _add_input_row() -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)

	var dropdown := OptionButton.new()
	dropdown.name = "Color"
	dropdown.size_flags_horizontal = SIZE_EXPAND_FILL
	row.add_child(dropdown)
	_repopulate_dropdown(dropdown)
	dropdown.item_selected.connect(_on_field_changed)

	var times_label := Label.new()
	times_label.text = "×"
	times_label.add_theme_color_override("font_color", ThemeLib.TEXT_DIM)
	row.add_child(times_label)

	var qty := SpinBox.new()
	qty.name = "Qty"
	qty.min_value = 1.0
	qty.max_value = 99.0
	qty.step = 1.0
	qty.value = 1.0
	qty.custom_minimum_size = Vector2(64, 0)
	qty.value_changed.connect(_on_value_changed)
	row.add_child(qty)

	var remove := Button.new()
	remove.text = "✕"
	remove.custom_minimum_size = Vector2(28, 0)
	remove.pressed.connect(func(): _remove_input_row(row))
	row.add_child(remove)

	_inputs_container.add_child(row)
	state_changed.emit()

func _remove_input_row(row: HBoxContainer) -> void:
	row.queue_free()
	# Defer the signal until the queue_free has actually removed the child,
	# otherwise main.gd's snapshot still includes the freed row.
	call_deferred("emit_signal", "state_changed")

# ---- Dropdown helpers --------------------------------------------------------

func _repopulate_dropdown(dropdown: OptionButton) -> void:
	var prev := dropdown.selected
	dropdown.clear()
	for code in _palette_codes:
		dropdown.add_item(code)
	if prev >= 0 and prev < _palette_codes.size():
		dropdown.select(prev)
	elif _palette_codes.size() > 0:
		dropdown.select(0)
		# OptionButton.select() is silent — emit so main.gd drops out of
		# READY_TO_EXPORT when a stale selection was forced to a fallback.
		if prev != 0:
			state_changed.emit()

# ---- Signal forwarders -------------------------------------------------------

func _on_add_input() -> void:
	_add_input_row()

func _on_field_changed(_idx: int) -> void:
	state_changed.emit()

func _on_value_changed(_v: float) -> void:
	state_changed.emit()

# ---- Error highlighting ------------------------------------------------------

func mark_output_error(has_error: bool) -> void:
	if has_error:
		_apply_error_border(_output_btn)
	else:
		_output_btn.remove_theme_stylebox_override("normal")

func mark_input_error(input_idx: int, has_error: bool) -> void:
	var rows := _inputs_container.get_children()
	if input_idx < 0 or input_idx >= rows.size():
		return
	var dropdown := rows[input_idx].get_node("Color") as OptionButton
	if has_error:
		_apply_error_border(dropdown)
	else:
		dropdown.remove_theme_stylebox_override("normal")

func clear_errors() -> void:
	_output_btn.remove_theme_stylebox_override("normal")
	for row in _inputs_container.get_children():
		var dropdown := row.get_node("Color") as OptionButton
		dropdown.remove_theme_stylebox_override("normal")

func _apply_error_border(node: Control) -> void:
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
	node.add_theme_stylebox_override("normal", sb)
