import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

export interface Gift {
  id: string;
  title: string;
  description: string;
  category: string;
  rarity: string;
  media_url?: string;
  unlock_date?: string;
  is_unlocked: boolean;
  code_or_link?: string;
  created_at: string;
}

export type NewGift = Omit<Gift, 'id' | 'created_at'>;

const GIFT_ATTACHMENTS_BUCKET = 'gift-attachments';

export const giftsService = {
  async getAllGifts(): Promise<Gift[]> {
    const { data, error } = await supabase
      .from('gifts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as Gift[];
  },

  async createGift(newGift: NewGift): Promise<Gift> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw authError;
    }
    if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Solo el administrador puede crear regalos.');
    }

    const { data, error } = await supabase
      .from('gifts')
      .insert(newGift)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Gift;
  },

  async uploadGiftAttachment(file: File): Promise<{ path: string }> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf']);
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'pdf']);

    if (!allowedTypes.has(file.type) || !extension || !allowedExtensions.has(extension)) {
      throw new Error('El archivo debe ser una imagen compatible o un PDF.');
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new Error('El archivo no puede superar los 20 MB.');
    }

    const path = `gift-cards/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(GIFT_ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      throw error;
    }

    return { path };
  },

  async getGiftAttachmentUrl(reference: string): Promise<string> {
    const bucket = GIFT_ATTACHMENTS_BUCKET;
    let path = reference;

    if (/^https?:\/\//i.test(reference)) {
      const publicMarker = `/storage/v1/object/public/${bucket}/`;
      const signedMarker = `/storage/v1/object/sign/${bucket}/`;
      const marker = reference.includes(publicMarker) ? publicMarker : reference.includes(signedMarker) ? signedMarker : null;

      if (!marker) {
        return reference;
      }

      const markerIndex = reference.indexOf(marker);
      path = decodeURIComponent(reference.slice(markerIndex + marker.length).split(/[?#]/, 1)[0]);
    } else if (path.startsWith(`${bucket}/`)) {
      path = path.slice(bucket.length + 1);
    }

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) {
      throw error;
    }

    return data.signedUrl;
  },

  async removeGiftAttachment(path: string): Promise<void> {
    const { error } = await supabase.storage.from(GIFT_ATTACHMENTS_BUCKET).remove([path]);
    if (error) {
      throw error;
    }
  },
};