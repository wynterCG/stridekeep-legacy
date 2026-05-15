class_name ColorNaming extends RefCounted

# Stridekeep Mural Prep — color naming (LAB nearest-anchor edition).
#
# Produces a generic perceptual label by finding the nearest entry in a
# fixed table of ~50 named anchor colors in CIELAB space, then optionally
# prepending a "dark"/"light"/"muted" modifier when the input is far from
# the anchor's representative L* or chroma.
#
# Replaces the original 12-hue-bucket HSL classifier. The old algorithm's
# arbitrary boundaries (e.g. H=195° between "teal" and "cyan") meant
# perceptually-adjacent colors got opposite labels; this version uses the
# same CIELAB metric k-means uses, so the labels match how the centroids
# were clustered in the first place.
#
# Anchors are generic perceptual color words (red, teal, sage, slate,
# rust, ...) — NOT a thematic lexicon (per SKILL.md §10). They cover the
# common color space at enough lightness/chroma levels that modifiers
# rarely fire; when they do fire it's because the input genuinely sits
# between anchors.
#
# Labels are still always overwritten by the user during curation. The
# suggestion just removes the blank-field friction.

const KMeansLib := preload("res://scripts/kmeans.gd")

# ---- Anchor table ------------------------------------------------------------
# Each entry: {name, hex}. Hex is parsed once and the LAB conversion is
# cached lazily on first call. Names are deliberately one-or-two-word
# generic descriptors — no thematic adjectives.
const ANCHORS := [
	# Reds
	{"name": "red",         "hex": 0xc03030},
	{"name": "crimson",     "hex": 0xa01818},
	{"name": "maroon",      "hex": 0x5a1414},
	{"name": "salmon",      "hex": 0xe89080},
	{"name": "coral",       "hex": 0xe07a52},
	# Oranges & warm browns
	{"name": "orange",      "hex": 0xe07f2a},
	{"name": "peach",       "hex": 0xf4b888},
	{"name": "amber",       "hex": 0xc8862e},
	{"name": "rust",        "hex": 0x8e4823},
	{"name": "tan",         "hex": 0xb89070},
	{"name": "brown",       "hex": 0x6e4828},
	{"name": "chocolate",   "hex": 0x4a2e1a},
	{"name": "beige",       "hex": 0xd8c4a0},
	{"name": "sand",        "hex": 0xd8c088},
	{"name": "khaki",       "hex": 0xbcaa70},
	# Yellows
	{"name": "cream",       "hex": 0xf0e4c0},
	{"name": "yellow",      "hex": 0xe8c828},
	{"name": "gold",        "hex": 0xd8a828},
	{"name": "mustard",     "hex": 0xb89020},
	# Greens (spread across L*)
	{"name": "olive",       "hex": 0x5e5a28},
	{"name": "lime",        "hex": 0x88c828},
	{"name": "chartreuse",  "hex": 0xbcd84a},
	{"name": "sage",        "hex": 0x9aae88},
	{"name": "mint",        "hex": 0xa8dab0},
	{"name": "green",       "hex": 0x4a8838},
	{"name": "forest",      "hex": 0x2a5e2a},
	{"name": "pine",        "hex": 0x1e3e1e},
	{"name": "emerald",     "hex": 0x2e8e48},
	{"name": "jade",        "hex": 0x4a9878},
	# Teals & cyans (extra density here — old HSL classifier was worst around H=195°)
	{"name": "teal",        "hex": 0x2e8a88},
	{"name": "seafoam",     "hex": 0x88c8b8},
	{"name": "turquoise",   "hex": 0x38c8c0},
	{"name": "cyan",        "hex": 0x4ab8d8},
	{"name": "aqua",        "hex": 0x80d8d8},
	# Blues
	{"name": "sky",         "hex": 0x80b8d8},
	{"name": "slate",       "hex": 0x607080},
	{"name": "steel",       "hex": 0x486080},
	{"name": "blue",        "hex": 0x3868b8},
	{"name": "cobalt",      "hex": 0x1e48a8},
	{"name": "navy",        "hex": 0x14264e},
	# Purples
	{"name": "indigo",      "hex": 0x3838a8},
	{"name": "violet",      "hex": 0x8838b8},
	{"name": "purple",      "hex": 0x6028a0},
	{"name": "lavender",    "hex": 0xb0a0d0},
	{"name": "plum",        "hex": 0x6a2a5a},
	# Pinks & magentas
	{"name": "magenta",     "hex": 0xb038a8},
	{"name": "pink",        "hex": 0xd88fb0},
	{"name": "rose",        "hex": 0xd86090},
	# Neutrals (six L* steps — keeps low-chroma inputs from getting hue labels)
	{"name": "white",       "hex": 0xf0f0f0},
	{"name": "bone",        "hex": 0xdcd8cc},
	{"name": "ash",         "hex": 0xb0b0b0},
	{"name": "gray",        "hex": 0x808080},
	{"name": "charcoal",    "hex": 0x444444},
	{"name": "black",       "hex": 0x1a1a1a},
]

# Cache: LAB Vector3 per anchor, populated on first call. Kept as a
# static var on the script-class so it survives across suggest() calls
# without recomputing 53 sRGB→LAB transforms every time.
static var _anchor_labs: Array[Vector3] = []
static var _anchor_chromas: PackedFloat32Array = PackedFloat32Array()
# Set of anchor names that are pure neutrals — modifiers are suppressed
# for these because "dark white" or "muted gray" reads as nonsense.
const _NEUTRAL_NAMES := ["white", "bone", "ash", "gray", "charcoal", "black"]

# ---- Public API --------------------------------------------------------------

static func suggest(c: Color) -> String:
	_ensure_anchor_cache()
	var in_lab := KMeansLib.rgb_to_lab(c)
	var in_chroma := sqrt(in_lab.y * in_lab.y + in_lab.z * in_lab.z)

	# Find the LAB-nearest anchor. Squared distance suffices for argmin.
	var best_idx := 0
	var best_d := _sq_dist(in_lab, _anchor_labs[0])
	for i in range(1, _anchor_labs.size()):
		var d := _sq_dist(in_lab, _anchor_labs[i])
		if d < best_d:
			best_d = d
			best_idx = i

	var anchor: Dictionary = ANCHORS[best_idx]
	var anchor_name: String = anchor.name
	var anchor_lab: Vector3 = _anchor_labs[best_idx]
	var anchor_chroma: float = _anchor_chromas[best_idx]

	# Pure-neutral anchors get returned as-is. Six gray steps give enough
	# resolution that the nearest match is the right shade without need-
	# ing prefixes like "very dark gray".
	if anchor_name in _NEUTRAL_NAMES:
		return anchor_name

	# "muted" — input is significantly more desaturated than the anchor.
	# Threshold chosen so a clearly-greyed version of "teal" reads as
	# "muted teal", but a slightly-greyed teal stays just "teal".
	if anchor_chroma >= 18.0 and in_chroma < anchor_chroma * 0.55:
		return "muted " + anchor_name

	# Lightness offsets relative to the anchor's L*. CIELAB L* is 0-100,
	# so a 12-point delta is ~12% perceptual lightness — about the small-
	# est step that reads as "noticeably darker/lighter" to the eye.
	var dL := in_lab.x - anchor_lab.x
	if dL <= -22.0:
		return "very dark " + anchor_name
	if dL <= -11.0:
		return "dark " + anchor_name
	if dL >= 22.0:
		return "very light " + anchor_name
	if dL >= 11.0:
		return "light " + anchor_name

	return anchor_name

# ---- Cache ------------------------------------------------------------------

static func _ensure_anchor_cache() -> void:
	if not _anchor_labs.is_empty():
		return
	_anchor_labs.resize(ANCHORS.size())
	_anchor_chromas.resize(ANCHORS.size())
	for i in ANCHORS.size():
		var rgb := _hex_to_color(ANCHORS[i].hex)
		var lab := KMeansLib.rgb_to_lab(rgb)
		_anchor_labs[i] = lab
		_anchor_chromas[i] = sqrt(lab.y * lab.y + lab.z * lab.z)

static func _hex_to_color(hex: int) -> Color:
	var r := ((hex >> 16) & 0xff) / 255.0
	var g := ((hex >> 8) & 0xff) / 255.0
	var b := (hex & 0xff) / 255.0
	return Color(r, g, b, 1.0)

static func _sq_dist(a: Vector3, b: Vector3) -> float:
	var dx := a.x - b.x
	var dy := a.y - b.y
	var dz := a.z - b.z
	return dx * dx + dy * dy + dz * dz
