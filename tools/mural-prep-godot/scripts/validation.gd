class_name MuralValidation extends RefCounted

# Stridekeep Mural Prep — Slice 3 validation rules.
# Pure function — returns a list of issues; no UI side effects.
#
# Recipe.output_color_idx and recipe.inputs[*].color_idx are integer indices
# into the `palette` array. Caller (main.gd) is responsible for keeping
# recipe indices in sync with palette ordering — this module does not
# guard against stale indices beyond bounds checks.
# Each issue: {
#   "scope":  "global" | "color" | "recipe",
#   "index":  int,           # color or recipe index, -1 for global
#   "subfield": String,       # "name", "drop_weight", "shop_price",
#                             # "output", "input_<n>", or ""
#   "severity": "error" | "warning",
#   "message": String,
# }
#
# See SKILL.md §6 Slice 3 for the rule list.

const SEVERITY_ERROR := "error"
const SEVERITY_WARNING := "warning"

const SCOPE_GLOBAL := "global"
const SCOPE_COLOR := "color"
const SCOPE_RECIPE := "recipe"

const TIER_STARTER := "starter"
const TIER_QUALITY := "quality"
const TIER_FINE := "fine"
const _TIERS := [TIER_STARTER, TIER_QUALITY, TIER_FINE]

const CATEGORY_CASE := "case"
const CATEGORY_SHOP := "shop"
const CATEGORY_CRAFT := "craft"

const WEIGHT_TOLERANCE := 0.01

# Returns Array[Dictionary] of issues. Empty array == valid.
static func validate(palette: Array, recipes: Array, season_num: int) -> Array:
	var issues: Array = []
	_check_case_tier_coverage(palette, issues)
	_check_names(palette, issues)
	_check_color_id_uniqueness(palette, season_num, issues)
	_check_drop_weight_sums(palette, issues)
	_check_shop_prices(palette, issues)
	_check_craft_outputs_have_recipes(palette, recipes, issues)
	_check_recipes(palette, recipes, issues)
	return issues

# ---- Rule implementations ----------------------------------------------------

static func _check_case_tier_coverage(palette: Array, issues: Array) -> void:
	var seen := {}
	for c in palette:
		if c.category == CATEGORY_CASE:
			seen[c.tier] = true
	for tier in _TIERS:
		if not seen.has(tier):
			issues.append(_global_error(
				"No `case` color assigned to tier `%s`." % tier))

static func _check_names(palette: Array, issues: Array) -> void:
	for i in palette.size():
		var name: String = palette[i].name
		if name.strip_edges() == "":
			issues.append(_color_error(i, "name", "Name is empty."))

static func _check_color_id_uniqueness(palette: Array, season_num: int, issues: Array) -> void:
	var seen := {}
	for i in palette.size():
		var id := build_color_id(season_num, palette[i].name)
		if seen.has(id):
			issues.append(_color_error(i, "name",
				"Color ID `%s` collides with row #%d." % [id, seen[id] + 1]))
		else:
			seen[id] = i

static func _check_drop_weight_sums(palette: Array, issues: Array) -> void:
	# For each tier, sum drop_weight_pct of case-category rows; must equal 100.
	for tier in _TIERS:
		var sum := 0.0
		var indices: Array = []
		for i in palette.size():
			var c = palette[i]
			if c.category == CATEGORY_CASE and c.tier == tier:
				sum += c.drop_weight_pct
				indices.append(i)
		if indices.is_empty():
			continue  # tier-coverage check already complains
		if abs(sum - 100.0) > WEIGHT_TOLERANCE:
			# Mark every drop_weight cell in this tier so the user sees where to fix it.
			for i in indices:
				issues.append(_color_error(i, "drop_weight",
					"Tier `%s` drop weights sum to %.2f%% (must be 100%%)." % [tier, sum]))

static func _check_shop_prices(palette: Array, issues: Array) -> void:
	for i in palette.size():
		var c = palette[i]
		if c.category == CATEGORY_SHOP and c.shop_price <= 0:
			issues.append(_color_error(i, "shop_price", "Shop colors need a positive price."))

static func _check_craft_outputs_have_recipes(palette: Array, recipes: Array, issues: Array) -> void:
	# Each craft-category color must be the output of at least one recipe.
	var outputs := {}
	for r in recipes:
		var idx: int = r.output_color_idx
		if idx >= 0 and idx < palette.size():
			outputs[idx] = true
	for i in palette.size():
		var c = palette[i]
		if c.category == CATEGORY_CRAFT and not outputs.has(i):
			issues.append(_color_error(i, "name",
				"Craft color `%s` is not the output of any recipe." % c.name))

static func _check_recipes(palette: Array, recipes: Array, issues: Array) -> void:
	for r_idx in recipes.size():
		var r = recipes[r_idx]
		var out_idx: int = r.output_color_idx
		# Output must be a craft-category color in the palette.
		if out_idx < 0 or out_idx >= palette.size():
			issues.append(_recipe_error(r_idx, "output", "Recipe output is unset."))
		else:
			var out_color = palette[out_idx]
			if out_color.category != CATEGORY_CRAFT:
				issues.append(_recipe_error(r_idx, "output",
					"Output `%s` is `%s`, must be `craft`." % [out_color.name, out_color.category]))
		# Inputs.
		var inputs: Array = r.inputs
		if inputs.is_empty():
			issues.append(_recipe_error(r_idx, "input_0", "Recipe has no inputs."))
		var total_qty := 0
		for inp_idx in inputs.size():
			var inp = inputs[inp_idx]
			var c_idx: int = inp.color_idx
			var qty: int = inp.qty
			total_qty += qty
			var subfield := "input_%d" % inp_idx
			if c_idx < 0 or c_idx >= palette.size():
				issues.append(_recipe_error(r_idx, subfield, "Input #%d color is unset." % (inp_idx + 1)))
				continue
			var c = palette[c_idx]
			if c.category == CATEGORY_CASE and c.tier == TIER_FINE:
				issues.append(_recipe_error(r_idx, subfield,
					"Input #%d `%s` is tier-3 (fine) — not allowed (load-bearing invariant)." % [inp_idx + 1, c.name]))
		if total_qty < 2:
			issues.append(_recipe_error(r_idx, "input_0",
				"Total input qty is %d (must be >= 2 for a real mix)." % total_qty))

# ---- Helpers -----------------------------------------------------------------

static func build_color_id(season_num: int, name: String) -> String:
	return "s%d_%s" % [season_num, slugify(name)]

static func slugify(s: String) -> String:
	var lowered := s.to_lower().strip_edges()
	var out := ""
	var prev_underscore := false
	for ch in lowered:
		var is_alnum := (
			(ch >= "a" and ch <= "z") or
			(ch >= "0" and ch <= "9")
		)
		if is_alnum:
			out += ch
			prev_underscore = false
		else:
			if not prev_underscore and out.length() > 0:
				out += "_"
				prev_underscore = true
	while out.ends_with("_"):
		out = out.substr(0, out.length() - 1)
	if out == "":
		out = "untitled"
	return out

static func _global_error(msg: String) -> Dictionary:
	return {"scope": SCOPE_GLOBAL, "index": -1, "subfield": "", "severity": SEVERITY_ERROR, "message": msg}

static func _color_error(idx: int, subfield: String, msg: String) -> Dictionary:
	return {"scope": SCOPE_COLOR, "index": idx, "subfield": subfield, "severity": SEVERITY_ERROR, "message": msg}

static func _recipe_error(idx: int, subfield: String, msg: String) -> Dictionary:
	return {"scope": SCOPE_RECIPE, "index": idx, "subfield": subfield, "severity": SEVERITY_ERROR, "message": msg}
