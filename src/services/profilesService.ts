import { supabase } from '../config/supabase';

const AVATARS_BUCKET = 'profile-avatars';

export interface PlayerProfile {
  id: string;
  username: string | null;
  country: string | null;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  custom_status: string | null;
  badge: string | null;
}

export interface EditablePlayerProfile {
  username: string;
  country: string;
  avatar_url: string;
  bio?: string;
  banner_url?: string;
  custom_status?: string;
}

async function uploadProfileImage(userId: string, file: File, imageName: string): Promise<string> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!allowedTypes.has(file.type) || !extension || !/^(jpe?g|png|webp|gif|avif)$/.test(extension)) {
    throw new Error(`${imageName} debe ser una imagen JPG, PNG, WebP, GIF o AVIF.`);
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`${imageName} no puede superar los 5 MB.`);
  }

  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data: publicUrl } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(data.path);
  if (!publicUrl.publicUrl) {
    throw new Error(`No se pudo obtener la dirección de la imagen de ${imageName.toLowerCase()}.`);
  }
  return publicUrl.publicUrl;
}

export const profilesService = {
  async uploadAvatar(userId: string, file: File): Promise<string> {
    return uploadProfileImage(userId, file, 'El avatar');
  },

  async uploadBanner(userId: string, file: File): Promise<string> {
    return uploadProfileImage(userId, file, 'El banner');
  },

  async getMyProfile(userId: string): Promise<PlayerProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, country, avatar_url, bio, banner_url, custom_status, badge')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PlayerProfile | null;
  },

  async updateMyProfile(userId: string, updates: EditablePlayerProfile): Promise<PlayerProfile> {
    const profileUpdates: Record<string, string | null> = {
      username: updates.username.trim(),
      country: updates.country,
      avatar_url: updates.avatar_url.trim() || null,
    };
    if (updates.bio !== undefined) profileUpdates.bio = updates.bio.trim() || null;
    if (updates.banner_url !== undefined) profileUpdates.banner_url = updates.banner_url.trim() || null;
    if (updates.custom_status !== undefined) profileUpdates.custom_status = updates.custom_status.trim() || null;

    const { data, error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)
      .select('id, username, country, avatar_url, bio, banner_url, custom_status, badge')
      .single();

    if (error) {
      throw error;
    }

    return data as PlayerProfile;
  },
};
