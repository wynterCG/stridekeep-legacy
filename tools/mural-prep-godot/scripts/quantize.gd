class_name Quantize extends RefCounted

# Stridekeep Mural Prep — Slice 2.
# Apply a finalized palette to a source image and produce the canvas-sized
# output (default 32x32). Pure nearest-neighbor mapping in CIELAB space; no
# dithering by default (SKILL.md §10 anti-patterns).

const KMeansLib := preload("res://scripts/kmeans.gd")

# Resize (nearest) source to out_w x out_h, then snap each pixel to the
# closest palette color in LAB. Returns a new Image.
static func quantize_to_palette(source: Image, palette: PackedColorArray, out_w: int = 32, out_h: int = 32) -> Image:
	assert(source != null, "Quantize: source image is null")
	assert(palette.size() > 0, "Quantize: palette is empty")

	# Step 1: resize down with nearest-neighbor for clean pixel-art quantization.
	var small := source.duplicate() as Image
	small.resize(out_w, out_h, Image.INTERPOLATE_NEAREST)

	# Step 2: precompute LAB centroids for the palette.
	var lab_palette: Array[Vector3] = []
	lab_palette.resize(palette.size())
	for i in palette.size():
		lab_palette[i] = KMeansLib.rgb_to_lab(palette[i])

	# Step 3: snap each pixel to nearest palette color.
	for y in out_h:
		for x in out_w:
			var src_color := small.get_pixel(x, y)
			var src_lab := KMeansLib.rgb_to_lab(src_color)
			var best_idx := 0
			var best_d: float = _sq_dist(src_lab, lab_palette[0])
			for i in range(1, lab_palette.size()):
				var d := _sq_dist(src_lab, lab_palette[i])
				if d < best_d:
					best_d = d
					best_idx = i
			small.set_pixel(x, y, palette[best_idx])
	return small

# For each pixel of the quantized output, return the palette index used.
# Useful when generating target_pixels for seed_next_mural() in Slice 4.
static func map_to_indices(source: Image, palette: PackedColorArray, out_w: int = 32, out_h: int = 32) -> PackedInt32Array:
	assert(source != null and palette.size() > 0)
	var small := source.duplicate() as Image
	small.resize(out_w, out_h, Image.INTERPOLATE_NEAREST)
	var lab_palette: Array[Vector3] = []
	lab_palette.resize(palette.size())
	for i in palette.size():
		lab_palette[i] = KMeansLib.rgb_to_lab(palette[i])
	var indices := PackedInt32Array()
	indices.resize(out_w * out_h)
	for y in out_h:
		for x in out_w:
			var src_color := small.get_pixel(x, y)
			var src_lab := KMeansLib.rgb_to_lab(src_color)
			var best_idx := 0
			var best_d: float = _sq_dist(src_lab, lab_palette[0])
			for i in range(1, lab_palette.size()):
				var d := _sq_dist(src_lab, lab_palette[i])
				if d < best_d:
					best_d = d
					best_idx = i
			indices[y * out_w + x] = best_idx
	return indices

static func _sq_dist(a: Vector3, b: Vector3) -> float:
	var dx := a.x - b.x
	var dy := a.y - b.y
	var dz := a.z - b.z
	return dx * dx + dy * dy + dz * dz
