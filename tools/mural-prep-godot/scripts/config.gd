class_name MuralConfig extends RefCounted

# Stridekeep Mural Prep — load/save user-local config.
# Stored at user://config.json (per-platform path resolved by Godot).
# See SKILL.md §12.
#
# Expected keys (all optional; absent = unconfigured):
#   "supabase_url"      : String
#   "supabase_anon_key" : String
#   "comfy_watch_dir"   : String

const CONFIG_PATH := "user://config.json"

static func load_config() -> Dictionary:
	if not FileAccess.file_exists(CONFIG_PATH):
		return {}
	var f := FileAccess.open(CONFIG_PATH, FileAccess.READ)
	if f == null:
		push_warning("MuralConfig: failed to open %s for reading" % CONFIG_PATH)
		return {}
	var text := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(text)
	if parsed == null or typeof(parsed) != TYPE_DICTIONARY:
		push_warning("MuralConfig: %s is not a valid JSON object" % CONFIG_PATH)
		return {}
	return parsed

static func save_config(d: Dictionary) -> bool:
	var f := FileAccess.open(CONFIG_PATH, FileAccess.WRITE)
	if f == null:
		push_error("MuralConfig: failed to open %s for writing" % CONFIG_PATH)
		return false
	f.store_string(JSON.stringify(d, "  "))
	f.close()
	return true
