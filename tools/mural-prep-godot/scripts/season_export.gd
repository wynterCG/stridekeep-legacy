class_name SeasonExport extends RefCounted

# Stridekeep Mural Prep — Slice 4.
# Serialize the curated palette + recipes + target_pixels + canvas dims
# into one JSON file. Mirrors the seed_next_mural() RPC payload but as a
# self-contained document — useful for offline review, version control of
# season data, or re-seeding from disk.
#
# Schema (top-level):
# {
#   "schema_version": 1,
#   "generated_at": "<ISO8601>",
#   "season_number": <int>,
#   "mural_name": "<text>",
#   "canvas": { "width": <int>, "height": <int> },
#   "palette": [ ColorEntry, ... ],
#   "craft_recipes": [ RecipeEntry, ... ],
#   "target_pixels": { "0": "s1_bone", ... }
# }

const ValidationLib := preload("res://scripts/validation.gd")
const SCHEMA_VERSION := 1

static func build_package(season_num: int, mural_name: String, width: int, height: int, palette_state: Array, recipe_state: Array, target_pixels: Dictionary) -> Dictionary:
	# Assert recipe indices match the palette — same defense as SeedSQL.build.
	# Silent-drop would write a JSON file missing recipes the user expected,
	# and the failure mode is invisible until they re-import elsewhere.
	for r_idx in recipe_state.size():
		var r = recipe_state[r_idx]
		var oi: int = r.output_color_idx
		assert(oi >= 0 and oi < palette_state.size(),
			"SeasonExport.build_package: recipe %d output_color_idx %d out of range" % [r_idx, oi])
		for inp in r.inputs:
			var ci: int = inp.color_idx
			assert(ci >= 0 and ci < palette_state.size(),
				"SeasonExport.build_package: recipe %d input color_idx %d out of range" % [r_idx, ci])

	return {
		"schema_version": SCHEMA_VERSION,
		"generated_at": Time.get_datetime_string_from_system(true),
		"season_number": season_num,
		"mural_name": mural_name,
		"canvas": {"width": width, "height": height},
		"palette": palette_to_array(season_num, palette_state),
		"craft_recipes": recipes_to_array(season_num, palette_state, recipe_state),
		"target_pixels": target_pixels,
	}

# Write the package to a file. Returns OK on success.
static func write_to_file(package: Dictionary, path: String) -> Error:
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		return FileAccess.get_open_error()
	f.store_string(JSON.stringify(package, "  "))
	f.close()
	return OK

# ---- Public serializers (single source of truth — also used by SeedSQL) -----

# Build the palette JSON array (one entry per color row). Per-category
# fields: case has tier+drop_weight_pct, shop has shop_price, craft has
# neither. Schema must match the seed_next_mural() RPC's expectation.
static func palette_to_array(season_num: int, palette_state: Array) -> Array:
	var arr: Array = []
	for c in palette_state:
		var entry := {
			"color_id": ValidationLib.build_color_id(season_num, c.name),
			"name": c.name,
			"hex": c.hex,
			"category": c.category,
			"base_value": 100,
			"color_code": c.code,
		}
		match c.category:
			"case":
				entry["tier"] = c.tier
				entry["drop_weight_pct"] = c.drop_weight_pct
			"shop":
				entry["shop_price"] = c.shop_price
		arr.append(entry)
	return arr

# Build the recipes JSON array. Out-of-range indices are silently skipped
# at this layer because callers (build_package / SeedSQL.build) range-assert
# before calling. The continue-skips below are a defensive belt-and-braces.
static func recipes_to_array(season_num: int, palette_state: Array, recipes: Array) -> Array:
	var arr: Array = []
	for i in recipes.size():
		var r = recipes[i]
		var out_idx: int = r.output_color_idx
		if out_idx < 0 or out_idx >= palette_state.size():
			continue
		var output_id := ValidationLib.build_color_id(season_num, palette_state[out_idx].name)
		var inputs := {}
		for inp in r.inputs:
			var c_idx: int = inp.color_idx
			if c_idx < 0 or c_idx >= palette_state.size():
				continue
			inputs[ValidationLib.build_color_id(season_num, palette_state[c_idx].name)] = inp.qty
		arr.append({
			"recipe_id": "s%d_r%d" % [season_num, i + 1],
			"output_color_id": output_id,
			"inputs": inputs,
		})
	return arr
