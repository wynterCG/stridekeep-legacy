class_name KMeans extends RefCounted

# Stridekeep Mural Prep — Slice 1
# Pure k-means++ palette extraction in CIELAB color space.
# No Godot scene-tree dependencies; testable in isolation.
#
# Usage:
#   var result := KMeans.extract(image, 12)
#   result.centroids : PackedColorArray  -- RGB centroids, sorted by weight desc
#   result.labels    : PackedInt32Array  -- per-sample cluster index (sample order)
#   result.weights   : PackedFloat32Array -- fraction of samples per cluster, sums to 1.0

const MAX_SAMPLE_DIM := 128        # ~16k samples; per SKILL.md §6 fallback when 256 grid blows the 2s budget on real murals
const CONVERGENCE_THRESHOLD := 0.5 # max LAB centroid shift to declare converged
const D65_XN := 0.95047
const D65_YN := 1.0
const D65_ZN := 1.08883

# ---- Public API --------------------------------------------------------------

static func extract(image: Image, k: int = 12, rng_seed: int = 42, max_iter: int = 30) -> Dictionary:
	assert(image != null, "KMeans.extract: image is null")
	assert(k >= 2, "KMeans.extract: k must be >= 2")

	var rng := RandomNumberGenerator.new()
	rng.seed = rng_seed

	var lab_samples := _sample_pixels_to_lab(image, MAX_SAMPLE_DIM)
	var n := lab_samples.size()
	assert(n >= k, "KMeans.extract: not enough samples for k clusters")

	var centroids := _kmeans_pp_init(lab_samples, k, rng)

	var labels := PackedInt32Array()
	labels.resize(n)

	for iter in max_iter:
		labels = _assign_labels(lab_samples, centroids)
		var new_centroids := _recompute_centroids(lab_samples, labels, k, centroids)
		if _converged(centroids, new_centroids):
			centroids = new_centroids
			break
		centroids = new_centroids

	# Final assignment after last centroid update
	labels = _assign_labels(lab_samples, centroids)
	var weights := _compute_weights(labels, k)

	# Sort centroids by weight desc, remap labels accordingly
	var order := _sort_indices_by_weight_desc(weights)
	var sorted_centroids_lab: Array[Vector3] = []
	var sorted_weights := PackedFloat32Array()
	sorted_weights.resize(k)
	for i in k:
		sorted_centroids_lab.append(centroids[order[i]])
		sorted_weights[i] = weights[order[i]]

	# Build inverse mapping: old index -> new index
	var label_remap := PackedInt32Array()
	label_remap.resize(k)
	for new_idx in k:
		label_remap[order[new_idx]] = new_idx
	var remapped_labels := PackedInt32Array()
	remapped_labels.resize(n)
	for i in n:
		remapped_labels[i] = label_remap[labels[i]]

	# Convert centroids back to RGB for display
	var rgb_centroids := PackedColorArray()
	rgb_centroids.resize(k)
	for i in k:
		rgb_centroids[i] = lab_to_rgb(sorted_centroids_lab[i])

	return {
		"centroids": rgb_centroids,
		"labels": remapped_labels,
		"weights": sorted_weights,
	}

# ---- Pixel sampling ----------------------------------------------------------

static func _sample_pixels_to_lab(image: Image, max_dim: int) -> Array[Vector3]:
	var size := image.get_size()
	var w: int = size.x
	var h: int = size.y
	# Compute stride so that (w/stride)*(h/stride) <= max_dim*max_dim approximately.
	var target := float(max_dim * max_dim)
	var actual := float(w * h)
	var stride := 1
	if actual > target:
		stride = int(ceil(sqrt(actual / target)))
	var samples: Array[Vector3] = []
	var y := 0
	while y < h:
		var x := 0
		while x < w:
			var c := image.get_pixel(x, y)
			samples.append(rgb_to_lab(c))
			x += stride
		y += stride
	return samples

# ---- k-means++ init ----------------------------------------------------------

static func _kmeans_pp_init(samples: Array[Vector3], k: int, rng: RandomNumberGenerator) -> Array[Vector3]:
	var n := samples.size()
	var centroids: Array[Vector3] = []
	# First centroid: uniform random sample
	centroids.append(samples[rng.randi_range(0, n - 1)])

	# Per-sample squared distance to nearest existing centroid
	var dist_sq := PackedFloat32Array()
	dist_sq.resize(n)
	for i in n:
		dist_sq[i] = _sq_dist(samples[i], centroids[0])

	while centroids.size() < k:
		# Pick next centroid weighted by dist_sq (D^2 weighting)
		var total: float = 0.0
		for i in n:
			total += dist_sq[i]
		if total <= 0.0:
			# Degenerate: all samples already coincide with chosen centroids
			centroids.append(samples[rng.randi_range(0, n - 1)])
		else:
			var threshold := rng.randf() * total
			var cumulative := 0.0
			var picked_idx := n - 1
			for i in n:
				cumulative += dist_sq[i]
				if cumulative >= threshold:
					picked_idx = i
					break
			centroids.append(samples[picked_idx])
		# Update dist_sq with the new centroid
		var new_centroid: Vector3 = centroids[centroids.size() - 1]
		for i in n:
			var d := _sq_dist(samples[i], new_centroid)
			if d < dist_sq[i]:
				dist_sq[i] = d
	return centroids

# ---- Assignment and update ---------------------------------------------------

static func _assign_labels(samples: Array[Vector3], centroids: Array[Vector3]) -> PackedInt32Array:
	var n := samples.size()
	var k := centroids.size()
	var labels := PackedInt32Array()
	labels.resize(n)
	for i in n:
		var s: Vector3 = samples[i]
		var best := 0
		var best_d: float = _sq_dist(s, centroids[0])
		for c in range(1, k):
			var d := _sq_dist(s, centroids[c])
			if d < best_d:
				best_d = d
				best = c
		labels[i] = best
	return labels

static func _recompute_centroids(samples: Array[Vector3], labels: PackedInt32Array, k: int, prev: Array[Vector3]) -> Array[Vector3]:
	var sums: Array[Vector3] = []
	var counts := PackedInt32Array()
	sums.resize(k)
	counts.resize(k)
	for c in k:
		sums[c] = Vector3.ZERO
		counts[c] = 0
	var n := samples.size()
	for i in n:
		var c: int = labels[i]
		sums[c] = sums[c] + samples[i]
		counts[c] += 1
	var out: Array[Vector3] = []
	out.resize(k)
	for c in k:
		if counts[c] == 0:
			# Empty cluster — re-seed from the sample farthest from its
			# assigned centroid (standard "split largest cluster" heuristic).
			# Fallback to keep-prev if everything tied at distance 0.
			out[c] = _farthest_outlier(samples, labels, prev, c)
			if out[c] == Vector3.ZERO and prev[c] != Vector3.ZERO:
				out[c] = prev[c]
			push_warning("KMeans: cluster %d emptied — split outlier as new centroid" % c)
		else:
			out[c] = sums[c] / float(counts[c])
	return out

# For an empty cluster, pick the LAB sample with maximum squared distance
# to its currently-assigned centroid. Deterministic given fixed inputs.
static func _farthest_outlier(samples: Array[Vector3], labels: PackedInt32Array, prev: Array[Vector3], skip_cluster: int) -> Vector3:
	var best_d := -1.0
	var best := Vector3.ZERO
	for i in samples.size():
		var lbl := labels[i]
		if lbl == skip_cluster:
			continue
		var d := _sq_dist(samples[i], prev[lbl])
		if d > best_d:
			best_d = d
			best = samples[i]
	return best

static func _converged(old_c: Array[Vector3], new_c: Array[Vector3]) -> bool:
	var max_shift := 0.0
	for i in old_c.size():
		var d: float = old_c[i].distance_to(new_c[i])
		if d > max_shift:
			max_shift = d
	return max_shift < CONVERGENCE_THRESHOLD

static func _compute_weights(labels: PackedInt32Array, k: int) -> PackedFloat32Array:
	var counts := PackedInt32Array()
	counts.resize(k)
	for c in k:
		counts[c] = 0
	var n := labels.size()
	for i in n:
		counts[labels[i]] += 1
	var weights := PackedFloat32Array()
	weights.resize(k)
	var inv_n := 1.0 / float(n)
	for c in k:
		weights[c] = float(counts[c]) * inv_n
	return weights

static func _sort_indices_by_weight_desc(weights: PackedFloat32Array) -> PackedInt32Array:
	var k := weights.size()
	var pairs: Array = []
	for i in k:
		pairs.append([weights[i], i])
	pairs.sort_custom(func(a, b): return a[0] > b[0])
	var out := PackedInt32Array()
	out.resize(k)
	for i in k:
		out[i] = pairs[i][1]
	return out

# ---- Distance helper ---------------------------------------------------------

static func _sq_dist(a: Vector3, b: Vector3) -> float:
	var dx := a.x - b.x
	var dy := a.y - b.y
	var dz := a.z - b.z
	return dx * dx + dy * dy + dz * dz

# ---- sRGB <-> CIELAB (D65) ---------------------------------------------------

static func rgb_to_lab(c: Color) -> Vector3:
	var r := _srgb_to_linear(c.r)
	var g := _srgb_to_linear(c.g)
	var b := _srgb_to_linear(c.b)
	var x := 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
	var y := 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
	var z := 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
	var fx := _lab_f(x / D65_XN)
	var fy := _lab_f(y / D65_YN)
	var fz := _lab_f(z / D65_ZN)
	var L := 116.0 * fy - 16.0
	var aa := 500.0 * (fx - fy)
	var bb := 200.0 * (fy - fz)
	return Vector3(L, aa, bb)

static func lab_to_rgb(lab: Vector3) -> Color:
	var fy := (lab.x + 16.0) / 116.0
	var fx := lab.y / 500.0 + fy
	var fz := fy - lab.z / 200.0
	var x := D65_XN * _lab_f_inv(fx)
	var y := D65_YN * _lab_f_inv(fy)
	var z := D65_ZN * _lab_f_inv(fz)
	var r :=  3.2404542 * x + -1.5371385 * y + -0.4985314 * z
	var g := -0.9692660 * x +  1.8760108 * y +  0.0415560 * z
	var b :=  0.0556434 * x + -0.2040259 * y +  1.0572252 * z
	var sr: float = clampf(_linear_to_srgb(r), 0.0, 1.0)
	var sg: float = clampf(_linear_to_srgb(g), 0.0, 1.0)
	var sb: float = clampf(_linear_to_srgb(b), 0.0, 1.0)
	return Color(sr, sg, sb, 1.0)

static func _srgb_to_linear(c: float) -> float:
	if c <= 0.04045:
		return c / 12.92
	return pow((c + 0.055) / 1.055, 2.4)

static func _linear_to_srgb(c: float) -> float:
	if c <= 0.0031308:
		return 12.92 * c
	return 1.055 * pow(c, 1.0 / 2.4) - 0.055

const _LAB_DELTA := 6.0 / 29.0
const _LAB_DELTA_CUBED := (6.0 / 29.0) * (6.0 / 29.0) * (6.0 / 29.0)
const _LAB_DELTA_SQ_3 := 3.0 * (6.0 / 29.0) * (6.0 / 29.0)

static func _lab_f(t: float) -> float:
	if t > _LAB_DELTA_CUBED:
		return pow(t, 1.0 / 3.0)
	return t / _LAB_DELTA_SQ_3 + 4.0 / 29.0

static func _lab_f_inv(t: float) -> float:
	if t > _LAB_DELTA:
		return t * t * t
	return _LAB_DELTA_SQ_3 * (t - 4.0 / 29.0)
