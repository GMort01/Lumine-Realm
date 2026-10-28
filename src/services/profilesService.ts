import { supabase } from '../config/supabase';

const AVATARS_BUCKET = 'profile-avatars';

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
  async uploadAvatar(userId: string, file: File): Promise<string> {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.has(file.type) || !extension || !/^(jpe?g|png|webp|gif|avif)$/.test(extension)) {
      throw new Error('El avatar debe ser una imagen JPG, PNG, WebP, GIF o AVIF.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('El avatar no puede superar los 5 MB.');
    }

    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data: publicUrl } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(data.path);
    if (!publicUrl.publicUrl) {
      throw new Error('No se pudo obtener la dirección del avatar subido.');
    }
    return publicUrl.publicUrl;
  },

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
