-- Stridekeep · 0010_season_palette (Phase-4 Mosaic Edition · Step 5 / S5.A)
--
-- Per-season palette + craft recipes. Each season has its OWN palette
-- (10-16 colors typical), seeded by the standalone Godot mural-prep tool
-- at tools/mural-prep-godot/ via seed_next_mural. There is NO global
-- master palette — entire palette regenerates each season.
--
-- Plan numbering: this was spec 0009 but renumbered to 0010 because of
-- the FK dependency on seasons (created in 0009). See 0009's header for
-- the full ordering rationale.

-- ─── season_colors ────────────────────────────────────────────────────────
-- One row per color per season. color_id is season-scoped (e.g. "s1_bone",
-- "s2_pine") so identifiers never collide across seasons. color_code is
-- the deterministic 2-char accessibility code baked at seed time so every
-- consumer (CanvasView, ColorCell, TilePicker, LiveFeed, ShopModal,
-- CraftModal, SeasonEndCeremony) shows THE SAME code for the same color.
create table if not exists public.season_colors (
  season_number   int not null references public.seasons(number) on delete cascade,
  color_id        text not null,
  name            text not null,
  hex             text not null,
  category        text not null check (category in ('case', 'shop', 'craft')),
  tier            text null check (tier is null or tier in ('starter', 'quality', 'fine')),
  shop_price      int null check (shop_price is null or shop_price > 0),
  base_value      int not null default 100 check (base_value > 0),
  drop_weight_pct numeric(5, 2) null check (drop_weight_pct is null or (drop_weight_pct > 0 and drop_weight_pct <= 100)),
  color_code      text not null,
  primary key (season_number, color_id),
  -- Same color_code never appears twice in a single season's palette so
  -- the colorblind overlay stays unambiguous within a season.
  unique (season_number, color_code),
  -- Structural rules from plan §337-338. Aggregate rules (drop_weight_pct
  -- sums to 100 per (season, tier)) are enforced inside seed_next_mural
  -- because CHECK constraints can't aggregate.
  constraint season_colors_tier_required_for_case
    check (
      (category = 'case'  and tier is not null) or
      (category <> 'case' and tier is null)
    ),
  constraint season_colors_shop_price_required_for_shop
    check (
      (category = 'shop'  and shop_price is not null) or
      (category <> 'shop' and shop_price is null)
    ),
  constraint season_colors_drop_weight_required_for_case
    check (
      (category = 'case'  and drop_weight_pct is not null) or
      (category <> 'case' and drop_weight_pct is null)
    )
);

-- ─── season_craft_recipes ─────────────────────────────────────────────────
-- One row per recipe per season. inputs is a jsonb object {colorId: qty, ...}.
-- Tier-3 invariant (no fine-tier color as input) is enforced in seed_next_mural
-- because validating arbitrary JSON keys against another table's column needs
-- a function body, not a CHECK constraint.
create table if not exists public.season_craft_recipes (
  season_number    int not null references public.seasons(number) on delete cascade,
  recipe_id        text not null,
  output_color_id  text not null,
  inputs           jsonb not null,
  primary key (season_number, recipe_id),
  -- output_color_id is a same-season palette color_id. Composite FK ensures
  -- the recipe can't reference a color from a different season.
  foreign key (season_number, output_color_id)
    references public.season_colors(season_number, color_id)
    on delete cascade
);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Read-everything for any authenticated user (palette/recipes are public-
-- ish info — every player needs to know what colors and recipes exist).
-- All writes go through seed_next_mural (SECURITY DEFINER, bypasses RLS).

alter table public.season_colors        enable row level security;
alter table public.season_craft_recipes enable row level security;

drop policy if exists season_colors_select_all on public.season_colors;
create policy season_colors_select_all on public.season_colors
  for select using (auth.role() = 'authenticated');

drop policy if exists season_craft_recipes_select_all on public.season_craft_recipes;
create policy season_craft_recipes_select_all on public.season_craft_recipes
  for select using (auth.role() = 'authenticated');
