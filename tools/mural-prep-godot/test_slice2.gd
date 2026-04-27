extends SceneTree

# Stridekeep Mural Prep — Slice 2 parse check.
# Loads main.tscn (which transitively imports every script the UI depends on)
# and exits. If anything fails to compile, this prints errors and exits non-zero.
#
# Run: godot --headless --path . --script res://test_slice2.gd

func _initialize() -> void:
	print("Stridekeep Mural Prep — Slice 2 parse check")
	var packed := load("res://scenes/main.tscn") as PackedScene
	if packed == null:
		print("FAIL — could not load main.tscn")
		quit(1)
		return

	var scene := packed.instantiate()
	if scene == null:
		print("FAIL — could not instantiate main.tscn")
		quit(1)
		return

	# Walk the tree to confirm the @onready paths resolve to the right node types.
	var checks := [
		["Root/Toolbar/ToolbarMargin/ToolbarRow/OpenPng", "Button"],
		["Root/Body/MiddleCol/MiddleMargin/MiddleVBox/SourcePreview", "TextureRect"],
		["Root/Body/MiddleCol/MiddleMargin/MiddleVBox/QuantPreview", "TextureRect"],
		["Root/Body/RightCol/RightMargin/RightScroll/RightVBox/PaletteList", "VBoxContainer"],
		["Root/Body/RightCol/RightMargin/RightScroll/RightVBox/MuralRow/MuralInput", "LineEdit"],
		["Root/StatusBar/StatusMargin/StatusLabel", "Label"],
	]
	var ok := true
	for c in checks:
		var path: String = c[0]
		var expected: String = c[1]
		var n: Node = scene.get_node_or_null(path)
		if n == null:
			print("FAIL — node missing: %s" % path)
			ok = false
		elif n.get_class() != expected:
			print("FAIL — %s is %s, expected %s" % [path, n.get_class(), expected])
			ok = false
	scene.queue_free()

	# Also verify color_row.tscn loads and instantiates.
	var row_packed := load("res://scenes/color_row.tscn") as PackedScene
	if row_packed == null:
		print("FAIL — color_row.tscn did not load")
		ok = false
	else:
		var row := row_packed.instantiate()
		if row == null or not row.has_method("init_from_extraction"):
			print("FAIL — color_row instance missing init_from_extraction")
			ok = false
		else:
			row.queue_free()

	if ok:
		print("PASS — main.tscn + color_row.tscn parse cleanly with all expected nodes")
		quit(0)
	else:
		quit(1)
