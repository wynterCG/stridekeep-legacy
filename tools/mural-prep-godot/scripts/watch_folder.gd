class_name WatchFolder extends Node

# Stridekeep Mural Prep — Slice 4.
# Polls a directory for new `.png` files every POLL_INTERVAL_SEC seconds.
# Emits `files_changed` with the full sorted-by-mtime-desc PNG list whenever
# the directory contents shift — main.gd renders the left sidebar from that
# list. SKILL.md §12 reasoning: avoid OS file-watch APIs, cross-platform
# support is uneven; Timer + DirAccess.get_files() is reliable everywhere.

signal files_changed(entries: Array)  # Array of {path: String, name: String, mtime: int}

const POLL_INTERVAL_SEC := 2.0
const PNG_EXTENSIONS := ["png", "PNG"]
# Cap surfaced entries — only the newest matter for picking. Avoids walking
# 5000 entries on a year-old ComfyUI output dir.
const MAX_ENTRIES := 50

var folder_path: String = ""
var _timer: Timer
var _last_signature: String = ""

func _ready() -> void:
	_timer = Timer.new()
	_timer.wait_time = POLL_INTERVAL_SEC
	_timer.autostart = false
	_timer.one_shot = false
	_timer.timeout.connect(_poll)
	add_child(_timer)

# Begin polling `path`. Stops any previous watch. Empty path stops watching.
func start_watching(path: String) -> void:
	folder_path = path
	_last_signature = ""
	if path == "" or not DirAccess.dir_exists_absolute(path):
		_timer.stop()
		files_changed.emit([])
		return
	_poll()  # initial scan, fires signal with current state
	_timer.start()

func stop_watching() -> void:
	_timer.stop()
	folder_path = ""
	_last_signature = ""

func _poll() -> void:
	var entries := _scan(folder_path)
	# Build a signature from path+mtime tuples to detect changes cheaply.
	var sig_parts := PackedStringArray()
	for e in entries:
		sig_parts.append("%s@%d" % [e.path, e.mtime])
	var signature := "|".join(sig_parts)
	if signature == _last_signature:
		return
	_last_signature = signature
	files_changed.emit(entries)

# Scan a directory for PNGs, return entries sorted newest-first by mtime.
static func _scan(path: String) -> Array:
	var entries: Array = []
	if path == "":
		return entries
	var dir := DirAccess.open(path)
	if dir == null:
		return entries
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if not dir.current_is_dir() and file_name.get_extension() in PNG_EXTENSIONS:
			var full_path := path.path_join(file_name)
			var mtime := FileAccess.get_modified_time(full_path)
			entries.append({"path": full_path, "name": file_name, "mtime": mtime})
		file_name = dir.get_next()
	dir.list_dir_end()
	entries.sort_custom(func(a, b): return a.mtime > b.mtime)
	if entries.size() > MAX_ENTRIES:
		entries.resize(MAX_ENTRIES)
	return entries
