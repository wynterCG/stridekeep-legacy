export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type Team = 'red' | 'blue';

export type CaseTier = 'starter' | 'premium' | 'luxury';

export type RarityWeights = Partial<Record<Rarity, number>>;

export interface Case {
  tier: CaseTier;
  name: string;
  emoji: string;
  stepsRequired: number;
  valueBand: { min: number; max: number };
  rarityWeights: RarityWeights;
}

export interface Item {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  tier: CaseTier;
  value: number;
}

export interface KeptItem extends Item {
  uid: string;
}

export interface CaseState {
  starter: { progress: number; pending: number };
  premium: { progress: number; pending: number };
  luxury: { progress: number; pending: number };
}

export interface Milestone {
  id: string;
  name: string;
  emoji: string;
  threshold: number;
}
