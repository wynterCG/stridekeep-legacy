import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { Badge } from '../types';

// Per-user badge collection. Badges are the SOLE form of cross-season
// progression — everything else (inventory, purse, pity) wipes at season
// rollover. Each badge IS a completed mural; the image URL is derived
// from the season number via the deterministic storage path.

export async function loadMyBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('season_number,season_name,won_at')
    .order('won_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    seasonNumber: Number(r.season_number),
    seasonName: typeof r.season_name === 'string' ? r.season_name : null,
    wonAt: String(r.won_at),
  }));
}

// Public storage URL for a season's mural PNG. The bucket is public-read
// (0011a_murals_storage), so no signed URL is needed — pass straight to
// <Image source={{ uri: ... }} />.
export function badgeImageUrl(seasonNumber: number): string {
  const url = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
  if (!url) {
    throw new Error('badgeImageUrl: missing supabaseUrl in expoConfig.extra');
  }
  return `${url}/storage/v1/object/public/murals/season_${seasonNumber}.png`;
}
