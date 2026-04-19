import type { Case, CaseTier, Item, Milestone } from '../types';

export const CASES: Record<CaseTier, Case> = {
  starter: {
    tier: 'starter',
    name: 'Basic Supplies',
    emoji: '📦',
    stepsRequired: 200,
    valueBand: { min: 100, max: 200 },
    rarityWeights: { common: 60, uncommon: 30, rare: 10 },
  },
  premium: {
    tier: 'premium',
    name: 'Quality Materials',
    emoji: '🧰',
    stepsRequired: 1500,
    valueBand: { min: 520, max: 850 },
    rarityWeights: { common: 50, uncommon: 30, rare: 15, epic: 5 },
  },
  luxury: {
    tier: 'luxury',
    name: 'Fine Craftsmanship',
    emoji: '🏛️',
    stepsRequired: 5000,
    valueBand: { min: 2200, max: 4200 },
    rarityWeights: { common: 40, uncommon: 30, rare: 20, epic: 8, legendary: 2 },
  },
};

export const ITEMS_BY_TIER: Record<CaseTier, Item[]> = {
  starter: [
    { id: 'clay_bricks', name: 'Clay Bricks', emoji: '🧱', rarity: 'common', tier: 'starter', value: 100 },
    { id: 'rough_planks', name: 'Rough Planks', emoji: '🪵', rarity: 'common', tier: 'starter', value: 110 },
    { id: 'iron_nails', name: 'Iron Nails', emoji: '🔩', rarity: 'common', tier: 'starter', value: 120 },
    { id: 'mortar_mix', name: 'Mortar Mix', emoji: '🪣', rarity: 'common', tier: 'starter', value: 140 },
    { id: 'oak_beams', name: 'Oak Beams', emoji: '🪵', rarity: 'uncommon', tier: 'starter', value: 165 },
    { id: 'hand_tools', name: 'Hand Tools', emoji: '🔨', rarity: 'uncommon', tier: 'starter', value: 180 },
    { id: 'blueprints', name: 'Blueprints', emoji: '📜', rarity: 'rare', tier: 'starter', value: 200 },
  ],
  premium: [
    { id: 'cut_limestone', name: 'Cut Limestone', emoji: '🪨', rarity: 'common', tier: 'premium', value: 520 },
    { id: 'slate_tiles', name: 'Slate Tiles', emoji: '🟫', rarity: 'common', tier: 'premium', value: 580 },
    { id: 'cast_iron_hinges', name: 'Cast-Iron Hinges', emoji: '⚙️', rarity: 'uncommon', tier: 'premium', value: 600 },
    { id: 'copper_piping', name: 'Copper Piping', emoji: '🟠', rarity: 'uncommon', tier: 'premium', value: 650 },
    { id: 'stained_glass', name: 'Stained Glass', emoji: '🪟', rarity: 'rare', tier: 'premium', value: 720 },
    { id: 'wrought_iron_gate', name: 'Wrought Iron Gate', emoji: '🚪', rarity: 'rare', tier: 'premium', value: 780 },
    { id: 'master_carpenter', name: 'Master Carpenter', emoji: '👷', rarity: 'epic', tier: 'premium', value: 850 },
  ],
  luxury: [
    { id: 'polished_marble', name: 'Polished Marble', emoji: '⬜', rarity: 'common', tier: 'luxury', value: 2200 },
    { id: 'clock_mechanism', name: 'Clock Mechanism', emoji: '⏰', rarity: 'uncommon', tier: 'luxury', value: 2500 },
    { id: 'bronze_statue', name: 'Bronze Statue', emoji: '🗿', rarity: 'uncommon', tier: 'luxury', value: 2800 },
    { id: 'gilded_dome', name: 'Gilded Dome', emoji: '🏛️', rarity: 'rare', tier: 'luxury', value: 3100 },
    { id: 'carved_archway', name: 'Carved Archway', emoji: '🕍', rarity: 'rare', tier: 'luxury', value: 3400 },
    { id: 'grand_chandelier', name: 'Grand Chandelier', emoji: '💎', rarity: 'epic', tier: 'luxury', value: 3800 },
    { id: 'master_architect', name: 'Master Architect', emoji: '👑', rarity: 'legendary', tier: 'luxury', value: 4200 },
  ],
};

export const MILESTONES: Milestone[] = [
  { id: 'village_fountain', name: 'Village Fountain', emoji: '⛲', threshold: 5000 },
  { id: 'stone_houses', name: 'Stone Houses', emoji: '🏘️', threshold: 25000 },
  { id: 'town_school', name: 'Town School', emoji: '🏫', threshold: 100000 },
  { id: 'hospital', name: 'Hospital', emoji: '🏥', threshold: 500000 },
  { id: 'grand_library', name: 'Grand Library', emoji: '📚', threshold: 2000000 },
  { id: 'cathedral', name: 'Cathedral', emoji: '⛪', threshold: 10000000 },
  { id: 'central_station', name: 'Central Station', emoji: '🚉', threshold: 50000000 },
];
