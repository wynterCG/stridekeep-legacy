class_name MuralTheme extends RefCounted

# Stridekeep Mural Prep — Slate & Brass tokens.
# Mirrors the Stridekeep app's UI chrome. Mural-content palettes (per-season)
# are NOT bound by these — those come from kmeans extraction.
# See SKILL.md §4.

const BG_SLATE      := Color("#2b3138")
const CARD          := Color("#353c46")
const CARD_HIGHLIGHT := Color("#3f4754")
const TEXT_CREAM    := Color("#f1ede4")
const TEXT_DIM      := Color("#a09689")
const BRASS         := Color("#c79c4a")
const BRASS_LIGHT   := Color("#f0d091")

# Team accents (used in canvas/preview painting elsewhere; kept for parity).
const TEAM_RED      := Color("#c44b3a")
const TEAM_BLUE     := Color("#6589b8")

# Status colors.
const SUCCESS       := Color("#7ca84d")
const WARNING       := Color("#d97a3a")
const ERROR         := Color("#c44b3a")

# Font names (load deferred to Slice 2 — these are just identifiers for now).
const FONT_BODY    := "Outfit"
const FONT_DISPLAY := "Bebas Neue"
const FONT_SERIF   := "Playfair Display"

# Layout constants (used across scenes once UI work begins).
const RADIUS_CARD := 12.0
const RADIUS_CHIP := 20.0
const PAD_CARD    := 16.0
const PAD_ROW     := 8.0
