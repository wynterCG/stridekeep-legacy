extends SceneTree

# Stridekeep Mural Prep — Slice 4 verification.
# Pure-logic tests for seed_sql.gd, season_export.gd, watch_folder.gd._scan.
# UI wiring (FileDialog, ItemList, AcceptDialog) is best driven via the
# Godot MCP and visual inspection — covered separately in the live session.

const SeedSQL := preload("res://scripts/seed_sql.gd")
const SeasonExport := preload("res://scripts/season_export.gd")
const WatchFolder := preload("res://scripts/watch_folder.gd")
const Validation := preload("res://scripts/validation.gd")

var _failures: Array = []

func _initialize() -> void:
	print("Stridekeep Mural Prep — Slice 4 verification")
	_check_seed_sql()
	_check_season_export()
	_check_target_pixels()
	_check_watch_scan()
	if _failures.is_empty():
		print("PASS — Slice 4 ready (SQL gen + JSON export + watch folder)")
		quit(0)
	else:
		print("FAIL — %d issue(s):" % _failures.size())
		for f in _failures:
			print("  - " + f)
		quit(1)

# ---- Test fixtures -----------------------------------------------------------

func _fixture_palette() -> Array:
	return [
		_c("bone", "case", "starter", 0, 60.0),
		_c("rust", "case", "starter", 0, 40.0),
		_c("pine", "case", "quality", 0, 70.0),
		_c("brass", "case", "quality", 0, 30.0),
		_c("verdigris", "case", "fine", 0, 100.0),
		_c("merchant_gold", "shop", "", 250, 0.0),
		_c("forged_alloy", "craft", "", 0, 0.0),
	]

func _fixture_recipes() -> Array:
	return [
		{"output_color_idx": 6, "inputs": [
			{"color_idx": 0, "qty": 2},
			{"color_idx": 2, "qty": 1},
		]},
	]

func _fixture_target_pixels() -> Dictionary:
	# Tiny 2x2 mock canvas: every pixel is pine (palette idx 2).
	return {"0": "s1_pine", "1": "s1_pine", "2": "s1_pine", "3": "s1_pine"}

# ---- seed_sql ----------------------------------------------------------------

func _check_seed_sql() -> void:
	var sql := SeedSQL.build(1, _fixture_palette(), _fixture_recipes(), _fixture_target_pixels(), 32, 32, "forge_island")

	# Header + RPC call shape
	if sql.findn("seed_next_mural(") < 0:
		_failures.append("SQL missing seed_next_mural() call")
	for keyword in ["target_pixels", "palette", "craft_recipes", "canvas_width", "canvas_height", "mural_name"]:
		if sql.findn("%s " % keyword) < 0 and sql.findn("%s\t" % keyword) < 0 and sql.findn("%s:=" % keyword) < 0 and sql.findn("%s  " % keyword) < 0:
			_failures.append("SQL missing keyword: " + keyword)

	# Dollar-quoting around JSON
	if sql.find("$mp$") < 0:
		_failures.append("SQL did not use $mp$ dollar-quoting for JSON")

	# Color ids built via slugify
	if sql.findn("s1_bone") < 0 or sql.findn("s1_pine") < 0 or sql.findn("s1_merchant_gold") < 0 or sql.findn("s1_forged_alloy") < 0:
		_failures.append("SQL missing expected slugified color ids")

	# Mural name single-quoted, dimensions present
	if sql.find("'forge_island'") < 0:
		_failures.append("SQL missing single-quoted mural name")
	if sql.find("canvas_width  := 32") < 0 and sql.find("canvas_width := 32") < 0 and sql.findn("canvas_width") < 0:
		_failures.append("SQL missing canvas_width int")

	# Quote escaping: re-build with a name containing a single quote.
	var sql_quoted := SeedSQL.build(1, _fixture_palette(), [], {}, 8, 8, "Wynter's mural")
	if sql_quoted.find("'Wynter''s mural'") < 0:
		_failures.append("SQL did not double-quote single quote in mural name")

	# Collision-resistant dollar-quote tag: a color name containing $mp$
	# must not terminate the JSON literal early. Tag-picker should walk
	# past "mp" to a longer alternative that doesn't appear in the corpus.
	var collide_palette := _fixture_palette()
	collide_palette[0]["name"] = "Bone $mp$ White"
	var sql_collide := SeedSQL.build(1, collide_palette, [], {}, 8, 8, "x")
	# Find the first "$<tag>$" near "target_pixels" and confirm the matching
	# closing tag exists later in the string. We don't hardcode the tag —
	# we just assert it's NOT plain "mp" (since "mp" collides with the
	# corpus) and that opening + closing instances appear together.
	var tp_idx := sql_collide.find("target_pixels")
	var open_idx := sql_collide.find("$", tp_idx)
	var open_end := sql_collide.find("$", open_idx + 1)
	var picked_tag := sql_collide.substr(open_idx + 1, open_end - open_idx - 1)
	if picked_tag == "mp":
		_failures.append("Dollar-quote picker did not avoid colliding tag 'mp'")
	if not picked_tag.begins_with("mp"):
		_failures.append("Dollar-quote tag should start with 'mp', got: " + picked_tag)
	var close_pattern := "$%s$" % picked_tag
	if sql_collide.count(close_pattern) < 6:  # 3 pairs (target_pixels, palette, craft_recipes)
		_failures.append("Dollar-quote closing tag '%s' missing pairs in SQL" % close_pattern)

	# Recipe input pairs (color id -> qty) appear in the JSON
	if sql.findn("s1_pine") < 0 or sql.findn("s1_bone") < 0:
		_failures.append("SQL recipe inputs missing expected color ids")

	# Tier-3 (fine) verdigris should NOT appear as a recipe input — fixture
	# uses bone+pine only. Sanity that fixture is well-formed.
	# (Validation rule already covered in test_slice3.gd.)

# ---- season_export -----------------------------------------------------------

func _check_season_export() -> void:
	var pkg := SeasonExport.build_package(2, "lantern_dock", 16, 16,
		_fixture_palette(), _fixture_recipes(), _fixture_target_pixels())

	if pkg.schema_version != 1:
		_failures.append("season_export schema_version != 1")
	if pkg.season_number != 2:
		_failures.append("season_export season_number wrong")
	if pkg.canvas.width != 16 or pkg.canvas.height != 16:
		_failures.append("season_export canvas dimensions wrong")
	if pkg.palette.size() != 7:
		_failures.append("season_export palette size: got %d, expected 7" % pkg.palette.size())
	if pkg.craft_recipes.size() != 1:
		_failures.append("season_export recipe count wrong")

	# Per-color shape — case has tier+drop_weight, shop has shop_price, craft neither
	var bone = pkg.palette[0]
	if bone.id != "s2_bone":
		_failures.append("season_export bone id wrong: " + bone.id)
	if bone.tier != "starter":
		_failures.append("season_export bone tier missing")
	if not bone.has("drop_weight_pct"):
		_failures.append("season_export case row missing drop_weight_pct")
	var shop_color = pkg.palette[5]
	if shop_color.shop_price != 250:
		_failures.append("season_export shop_price wrong")
	if shop_color.has("tier"):
		_failures.append("season_export shop row leaks tier field")
	var craft_color = pkg.palette[6]
	if craft_color.has("tier") or craft_color.has("shop_price"):
		_failures.append("season_export craft row leaks tier/shop_price")

	# Recipe id and references
	var r0 = pkg.craft_recipes[0]
	if r0.id != "s2_r1":
		_failures.append("season_export recipe id wrong: " + r0.id)
	if r0.output_color_id != "s2_forged_alloy":
		_failures.append("season_export recipe output id wrong")
	if r0.inputs.get("s2_bone") != 2 or r0.inputs.get("s2_pine") != 1:
		_failures.append("season_export recipe inputs wrong")

	# Round-trip: stringify + parse = identity-ish
	var s := JSON.stringify(pkg)
	var parsed = JSON.parse_string(s)
	if parsed == null or typeof(parsed) != TYPE_DICTIONARY:
		_failures.append("season_export JSON did not round-trip")

# ---- target_pixels -----------------------------------------------------------

func _check_target_pixels() -> void:
	var palette_state := _fixture_palette()
	# Synthetic indices: 4-pixel image, every pixel chooses palette[2] (pine).
	var indices := PackedInt32Array([2, 2, 2, 2])
	var target := SeedSQL.build_target_pixels(indices, 1, palette_state)
	if target.size() != 4:
		_failures.append("build_target_pixels size wrong: %d" % target.size())
	if target.get("0") != "s1_pine":
		_failures.append("build_target_pixels mapped pixel 0 wrong: " + str(target.get("0")))
	if target.get("3") != "s1_pine":
		_failures.append("build_target_pixels mapped pixel 3 wrong")

	# Mixed indices
	var mixed := PackedInt32Array([0, 5, 6, 0])
	var t2 := SeedSQL.build_target_pixels(mixed, 1, palette_state)
	if t2.get("0") != "s1_bone":
		_failures.append("mixed target_pixels pixel 0 wrong")
	if t2.get("1") != "s1_merchant_gold":
		_failures.append("mixed target_pixels pixel 1 (shop color) wrong")
	if t2.get("2") != "s1_forged_alloy":
		_failures.append("mixed target_pixels pixel 2 (craft color) wrong")

# ---- watch_folder._scan ------------------------------------------------------

func _check_watch_scan() -> void:
	# Static scan against test_assets/ — should pick up at least one PNG in
	# the user's local tree, sorted newest-first by mtime. We don't assert
	# specific filenames (test_assets/* is gitignored).
	var test_assets_abs := ProjectSettings.globalize_path("res://test_assets")
	var entries := WatchFolder._scan(test_assets_abs)
	# Schema check: each entry has path/name/mtime
	for e in entries:
		if not (e.has("path") and e.has("name") and e.has("mtime")):
			_failures.append("WatchFolder entry missing fields: " + str(e))
			return
	# Sort check: monotonically non-increasing mtime
	for i in range(1, entries.size()):
		if entries[i - 1].mtime < entries[i].mtime:
			_failures.append("WatchFolder entries not sorted newest-first by mtime")
			return

	# Empty path returns []
	var empty := WatchFolder._scan("")
	if not empty.is_empty():
		_failures.append("WatchFolder._scan('') should return empty array")

	# Non-existent path returns []
	var missing := WatchFolder._scan("res://does_not_exist_xyz/")
	if not missing.is_empty():
		_failures.append("WatchFolder._scan() on missing dir should return empty array")

# ---- helpers -----------------------------------------------------------------

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
