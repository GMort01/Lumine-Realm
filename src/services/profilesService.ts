import { supabase } from '../config/supabase';

export interface PlayerProfile {
  id: string;
  username: string | null;
  country: string | null;
  avatar_url: string | null;
}

export interface EditablePlayerProfile {
  username: string;
  country: string;
  avatar_url: string;
}

export const profilesService = {
  async getMyProfile(userId: string): Promise<PlayerProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, country, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PlayerProfile | null;
  },

  async updateMyProfile(userId: string, updates: EditablePlayerProfile): Promise<PlayerProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: updates.username.trim(),
        country: updates.country,
        avatar_url: updates.avatar_url.trim() || null,
      })
      .eq('id', userId)
      .select('id, username, country, avatar_url')
      .single();

    if (error) {
      throw error;
    }

    return data as PlayerProfile;
  },
};
