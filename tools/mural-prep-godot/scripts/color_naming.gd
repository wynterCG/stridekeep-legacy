class_name ColorNaming extends RefCounted

# Stridekeep Mural Prep — Slice 1
# Generic perceptual color naming. No thematic lexicon, no data file.
# Produces descriptive starting-point names like "deep red", "muted teal",
# "warm gold". Always overwritten by the user during curation.
#
# See SKILL.md §8.

# ---- Public API --------------------------------------------------------------

static func suggest(c: Color) -> String:
	var hsl := _to_hsl(c)
	var h := hsl.x  # 0-360
	var s := hsl.y  # 0-1
	var l := hsl.z  # 0-1

	var lightness_mod := ""
	if l < 0.20:
		lightness_mod = "very dark "
	elif l < 0.40:
		lightness_mod = "dark "
	elif l > 0.80:
		lightness_mod = "very light "
	elif l > 0.65:
		lightness_mod = "light "

	# Very low saturation: render as a gray, no hue label.
	if s < 0.10:
		return (lightness_mod + _gray_label(l)).strip_edges()

	var sat_mod := ""
	if s < 0.30:
		sat_mod = "muted "
	elif s > 0.80:
		sat_mod = "vivid "

	var hue_label := _hue_to_label(h)
	return (lightness_mod + sat_mod + hue_label).strip_edges()

# ---- HSL conversion (returns Vector3 with x=hue 0-360, y=sat 0-1, z=light 0-1)

static func _to_hsl(c: Color) -> Vector3:
	var r: float = c.r
	var g: float = c.g
	var b: float = c.b
	var max_c: float = maxf(r, maxf(g, b))
	var min_c: float = minf(r, minf(g, b))
	var l: float = (max_c + min_c) * 0.5
	var s: float = 0.0
	var h: float = 0.0
	if not is_equal_approx(max_c, min_c):
		var d: float = max_c - min_c
		if l > 0.5:
			s = d / (2.0 - max_c - min_c)
		else:
			s = d / (max_c + min_c)
		if max_c == r:
			h = fmod((g - b) / d, 6.0)
		elif max_c == g:
			h = (b - r) / d + 2.0
		else:
			h = (r - g) / d + 4.0
		h *= 60.0
		if h < 0.0:
			h += 360.0
	return Vector3(h, s, l)

# ---- Hue / gray labels -------------------------------------------------------

static func _hue_to_label(h: float) -> String:
	# 12 hue buckets at 30° intervals
	if h < 15.0 or h >= 345.0: return "red"
	elif h < 45.0:  return "warm orange"
	elif h < 75.0:  return "orange"
	elif h < 105.0: return "yellow"
	elif h < 135.0: return "yellow-green"
	elif h < 165.0: return "green"
	elif h < 195.0: return "teal"
	elif h < 225.0: return "cyan"
	elif h < 255.0: return "blue"
	elif h < 285.0: return "indigo"
	elif h < 315.0: return "purple"
	else: return "magenta"

static func _gray_label(l: float) -> String:
	if l < 0.15: return "black"
	elif l < 0.30: return "charcoal"
	elif l < 0.50: return "dark gray"
	elif l < 0.70: return "gray"
	elif l < 0.85: return "light gray"
	else: return "off-white"
