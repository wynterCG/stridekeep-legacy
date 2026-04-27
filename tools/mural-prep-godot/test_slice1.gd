extends SceneTree

# Stridekeep Mural Prep — Slice 1 acceptance harness.
#
# Run headless:
#   godot --headless --path . --script res://test_slice1.gd
#   godot --headless --path . --script res://test_slice1.gd -- --image res://test_assets/other.png
#
# Drop a sample image into test_assets/sample.png first.
# Acceptance: extracts a 12-color palette in <2000 ms.

# Preload directly so this script runs without prior project import
# (class_name registry is empty on a fresh checkout).
const KMeansLib := preload("res://scripts/kmeans.gd")
const ColorNamingLib := preload("res://scripts/color_naming.gd")

const DEFAULT_IMAGE := "res://test_assets/sample.png"
const DEFAULT_K := 12
const ACCEPTANCE_MS := 2000

func _initialize() -> void:
	var image_path := _arg_value("--image", DEFAULT_IMAGE)
	var k := int(_arg_value("--k", str(DEFAULT_K)))

	print("Stridekeep Mural Prep — Slice 1 headless test")
	print("Image:    %s" % image_path)
	print("k:        %d" % k)
	print("")

	if not ResourceLoader.exists(image_path) and not FileAccess.file_exists(image_path):
		# load_from_file accepts user:// and absolute paths too; check via Image directly
		var probe_image := Image.new()
		var probe_err := probe_image.load(image_path)
		if probe_err != OK:
			push_error("Image not found at %s" % image_path)
			print("FAIL — image not found.")
			print("Drop a PNG (any color image, 256x256+) into test_assets/sample.png and rerun.")
			quit(1)
			return

	var image := Image.new()
	var load_err := image.load(image_path)
	if load_err != OK:
		print("FAIL — Image.load returned %d for %s" % [load_err, image_path])
		quit(1)
		return

	var size := image.get_size()
	print("Loaded image: %dx%d (%d pixels)" % [size.x, size.y, size.x * size.y])
	print("Extracting palette (k=%d) ..." % k)

	var t0 := Time.get_ticks_msec()
	var result: Dictionary = KMeansLib.extract(image, k)
	var t1 := Time.get_ticks_msec()
	var elapsed := t1 - t0

	var centroids: PackedColorArray = result.centroids
	var weights: PackedFloat32Array = result.weights

	print("Done in %d ms" % elapsed)
	print("")
	print("Palette (sorted by weight desc):")
	for i in centroids.size():
		var c: Color = centroids[i]
		var w: float = weights[i]
		var hex := "#%02x%02x%02x" % [int(round(c.r * 255.0)), int(round(c.g * 255.0)), int(round(c.b * 255.0))]
		var label := ColorNamingLib.suggest(c)
		print("  %2d  %s  %5.1f%%  %s" % [i + 1, hex, w * 100.0, label])
	print("")

	# Determinism sanity check: centroid hex should be byte-identical across runs.
	var checksum := _palette_checksum(centroids)
	print("Palette checksum: %s" % checksum)

	# Run extraction a second time in the same process and assert the
	# centroids are byte-identical. This locks in the fixed-RNG-seed
	# guarantee per SKILL.md §7 ("required for testing, debugging, and
	# regenerating the same mural's palette").
	var result2: Dictionary = KMeansLib.extract(image, k)
	var centroids2: PackedColorArray = result2.centroids
	var checksum2 := _palette_checksum(centroids2)
	if checksum != checksum2:
		print("")
		print("FAIL — non-deterministic across two extractions: %s vs %s" % [checksum, checksum2])
		quit(1)
		return
	print("Determinism: OK (matched %s on second extraction)" % checksum2)
	print("")

	# Acceptance verdict
	if elapsed < ACCEPTANCE_MS:
		print("PASS — %d ms < %d ms acceptance bar" % [elapsed, ACCEPTANCE_MS])
		quit(0)
	else:
		print("WARN — %d ms exceeds %d ms target. Consider lowering MAX_SAMPLE_DIM in kmeans.gd." % [elapsed, ACCEPTANCE_MS])
		quit(0)

# ---- Helpers -----------------------------------------------------------------

func _arg_value(flag: String, fallback: String) -> String:
	# Search both the engine args and the user args (after --).
	var args := OS.get_cmdline_args()
	var user_args := OS.get_cmdline_user_args()
	var combined := args + user_args
	for i in combined.size():
		if combined[i] == flag and i + 1 < combined.size():
			return combined[i + 1]
	return fallback

func _palette_checksum(centroids: PackedColorArray) -> String:
	var parts := PackedStringArray()
	for c in centroids:
		parts.append("%02x%02x%02x" % [int(round(c.r * 255.0)), int(round(c.g * 255.0)), int(round(c.b * 255.0))])
	var joined := "|".join(parts)
	return joined.md5_text().substr(0, 16)
