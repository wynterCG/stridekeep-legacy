extends SceneTree

# Stridekeep Mural Prep — Slice 3 verification.
# Two phases:
#   1. Parse + node-path check on main.tscn / color_row.tscn / recipe_row.tscn
#   2. Validation logic spot-checks against synthetic palette + recipe states

const Validation := preload("res://scripts/validation.gd")

var _failures: Array = []

func _initialize() -> void:
	print("Stridekeep Mural Prep — Slice 3 verification")
	_check_scenes()
	_check_validation()
	if _failures.is_empty():
		print("PASS — Slice 3 ready (parse + validation rules)")
		quit(0)
	else:
		print("FAIL — %d issue(s):" % _failures.size())
		for f in _failures:
			print("  - " + f)
		quit(1)

# ---- Phase 1: scene parse + structure ----------------------------------------

func _check_scenes() -> void:
	var packed := load("res://scenes/main.tscn") as PackedScene
	if packed == null:
		_failures.append("main.tscn did not load")
		return
	var scene := packed.instantiate()
	if scene == null:
		_failures.append("main.tscn did not instantiate")
		return

	var must_exist := [
		"Root/Toolbar/ToolbarMargin/ToolbarRow/OpenPng",
		"Root/Body/MiddleCol/MiddleMargin/MiddleVBox/SourcePreview",
		"Root/Body/MiddleCol/MiddleMargin/MiddleVBox/QuantPreview",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/PaletteList",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/RecipesList",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/AddRecipeBtn",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/Validate",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/MuralRow/MuralInput",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/SeasonRow/SeasonNum",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/CanvasRow/CanvasW",
		"Root/Body/RightCol/RightMargin/RightScroll/RightVBox/CanvasRow/CanvasH",
		"Root/StatusBar/StatusMargin/StatusLabel",
	]
	for path in must_exist:
		if scene.get_node_or_null(path) == null:
			_failures.append("missing main.tscn node: " + path)
	scene.queue_free()

	for s_path in ["res://scenes/color_row.tscn", "res://scenes/recipe_row.tscn"]:
		var p := load(s_path) as PackedScene
		if p == null:
			_failures.append(s_path + " did not load")
			continue
		var inst := p.instantiate()
		if inst == null:
			_failures.append(s_path + " did not instantiate")
			continue
		inst.queue_free()

# ---- Phase 2: validation logic ----------------------------------------------

func _check_validation() -> void:
	# Build a synthetic palette that should validate cleanly:
	# 4 starter (sums 100), 3 quality (sums 100), 2 fine (sums 100),
	# 1 shop (price 50), 1 craft (output of recipe).
	var clean_palette := [
		_c("bone", "case", "starter", 0, 35.0),
		_c("rust", "case", "starter", 0, 30.0),
		_c("ash",  "case", "starter", 0, 20.0),
		_c("ivy",  "case", "starter", 0, 15.0),
		_c("pine", "case", "quality", 0, 50.0),
		_c("brass","case", "quality", 0, 30.0),
		_c("dusk", "case", "quality", 0, 20.0),
		_c("verdigris", "case", "fine", 0, 60.0),
		_c("scarlet",   "case", "fine", 0, 40.0),
		_c("merchant_gold", "shop", "", 250, 0.0),
		_c("forged_alloy", "craft", "", 0, 0.0),
	]
	var clean_recipes := [
		{"output_color_idx": 10, "inputs": [
			{"color_idx": 0, "qty": 2},
			{"color_idx": 4, "qty": 1},
		]},
	]
	var issues = Validation.validate(clean_palette, clean_recipes, 1)
	if not issues.is_empty():
		_failures.append("clean palette had unexpected issues: " + str(issues))

	# Now mutate to force each rule:

	# Rule: missing tier coverage
	var palette_no_fine := clean_palette.duplicate(true)
	palette_no_fine.pop_at(8)
	palette_no_fine.pop_at(7)  # remove both fine colors
	# also remove the recipe to avoid noise
	var issues2 = Validation.validate(palette_no_fine, [], 1)
	if not _has_issue(issues2, "global", "fine"):
		_failures.append("missing-tier rule did not fire")

	# Rule: empty name
	var palette_empty_name := clean_palette.duplicate(true)
	palette_empty_name[0]["name"] = "   "
	var issues3 = Validation.validate(palette_empty_name, clean_recipes, 1)
	if not _has_issue(issues3, "color", "empty"):
		_failures.append("empty-name rule did not fire")

	# Rule: drop weight sum != 100
	var palette_bad_weights := clean_palette.duplicate(true)
	palette_bad_weights[0]["drop_weight_pct"] = 10.0  # starter sum becomes 75
	var issues4 = Validation.validate(palette_bad_weights, clean_recipes, 1)
	if not _has_issue(issues4, "color", "100%"):
		_failures.append("drop-weight-sum rule did not fire")

	# Rule: tier-3 input
	var bad_recipe := [{"output_color_idx": 10, "inputs": [
		{"color_idx": 7, "qty": 2},  # verdigris is tier-fine
		{"color_idx": 4, "qty": 1},
	]}]
	var issues5 = Validation.validate(clean_palette, bad_recipe, 1)
	if not _has_issue(issues5, "recipe", "tier-3"):
		_failures.append("tier-3-input rule did not fire")

	# Rule: recipe output not craft
	var bad_recipe2 := [{"output_color_idx": 0, "inputs": [
		{"color_idx": 1, "qty": 1},
		{"color_idx": 2, "qty": 1},
	]}]
	var issues6 = Validation.validate(clean_palette, bad_recipe2, 1)
	if not _has_issue(issues6, "recipe", "craft"):
		_failures.append("recipe-output-must-be-craft rule did not fire")

	# Rule: total qty < 2
	var thin_recipe := [{"output_color_idx": 10, "inputs": [
		{"color_idx": 0, "qty": 1},
	]}]
	var issues7 = Validation.validate(clean_palette, thin_recipe, 1)
	if not _has_issue(issues7, "recipe", ">="):
		_failures.append("min-input-qty rule did not fire")

	# Rule: shop price 0
	var palette_free_shop := clean_palette.duplicate(true)
	palette_free_shop[9]["shop_price"] = 0
	var issues8 = Validation.validate(palette_free_shop, clean_recipes, 1)
	if not _has_issue(issues8, "color", "positive price"):
		_failures.append("shop-price rule did not fire")

	# Rule: craft color with no recipe
	var issues9 = Validation.validate(clean_palette, [], 1)
	if not _has_issue(issues9, "color", "not the output"):
		_failures.append("orphan-craft rule did not fire")

	# Rule: id collision via slugify ("Bone-White" and "Bone White" both -> bone_white)
	var palette_id_collision := clean_palette.duplicate(true)
	palette_id_collision[1]["name"] = "Bone White"   # was "rust"
	palette_id_collision[2]["name"] = "Bone-White"   # was "ash" — slugifies same
	var issues10 = Validation.validate(palette_id_collision, clean_recipes, 1)
	if not _has_issue(issues10, "color", "collides"):
		_failures.append("id-collision rule did not fire when two slugified names match")

	# Rule: recipe with output_color_idx = -1 (unset)
	var unset_output := [{"output_color_idx": -1, "inputs": [
		{"color_idx": 0, "qty": 1},
		{"color_idx": 4, "qty": 1},
	]}]
	var issues11 = Validation.validate(clean_palette, unset_output, 1)
	if not _has_issue(issues11, "recipe", "unset"):
		_failures.append("unset-output rule did not fire")

	# Rule: recipe with no inputs
	var no_inputs := [{"output_color_idx": 10, "inputs": []}]
	var issues12 = Validation.validate(clean_palette, no_inputs, 1)
	if not _has_issue(issues12, "recipe", "no inputs"):
		_failures.append("no-inputs rule did not fire")

	# Rule: recipe input with color_idx = -1
	var unset_input := [{"output_color_idx": 10, "inputs": [
		{"color_idx": -1, "qty": 2},
		{"color_idx": 4, "qty": 1},
	]}]
	var issues13 = Validation.validate(clean_palette, unset_input, 1)
	if not _has_issue(issues13, "recipe", "unset"):
		_failures.append("unset-input rule did not fire")

	# Tier-sum tolerance boundary: 100.01 should pass (within ±0.01),
	# 100.02 should fail. Locks the documented tolerance.
	var palette_just_in := clean_palette.duplicate(true)
	palette_just_in[0]["drop_weight_pct"] = 35.01   # starter sum becomes 100.01
	var issues14 = Validation.validate(palette_just_in, clean_recipes, 1)
	if _has_issue(issues14, "color", "100%"):
		_failures.append("tier-sum tolerance rejected 100.01% — should be within tolerance")

	var palette_just_out := clean_palette.duplicate(true)
	palette_just_out[0]["drop_weight_pct"] = 35.02   # starter sum becomes 100.02
	var issues15 = Validation.validate(palette_just_out, clean_recipes, 1)
	if not _has_issue(issues15, "color", "100%"):
		_failures.append("tier-sum tolerance accepted 100.02% — should fail")

	# Empty palette + recipes should not crash; should report missing tier coverage.
	var issues_empty = Validation.validate([], [], 1)
	var has_global := false
	for issue in issues_empty:
		if issue.scope == "global":
			has_global = true
			break
	if not has_global:
		_failures.append("empty palette did not report missing-tier coverage")

	# Slugify
	if Validation.slugify("Bone-White!! Ivory  ") != "bone_white_ivory":
		_failures.append("slugify produced unexpected output: " + Validation.slugify("Bone-White!! Ivory  "))

	# Color id construction
	if Validation.build_color_id(2, "Pine Shadow") != "s2_pine_shadow":
		_failures.append("build_color_id produced unexpected output")

	# Empty name should slugify to "untitled" rather than ""
	if Validation.slugify("") != "untitled":
		_failures.append("slugify on empty string did not fall back to 'untitled'")

# ---- helpers ----------------------------------------------------------------

func _c(name: String, category: String, tier: String, shop_price: int, drop_pct: float) -> Dictionary:
	return {
		"rgb": Color.WHITE,
		"raw_weight": 0.05,
		"name": name,
		"category": category,
		"tier": tier,
		"shop_price": shop_price,
		"drop_weight_pct": drop_pct,
		"hex": "#ffffff",
		"code": "?",
	}

func _has_issue(issues: Array, scope: String, msg_substring: String) -> bool:
	for i in issues:
		if i.scope == scope and i.message.findn(msg_substring) >= 0:
			return true
	return false
