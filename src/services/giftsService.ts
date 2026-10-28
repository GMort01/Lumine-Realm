import { supabase } from '../config/supabase';

export type GiftAudience = 'realm' | 'individual' | 'relationship';

export interface Gift {
  id: string;
  title: string;
  description: string;
  category: string;
  rarity: string;
  media_url?: string | null;
  unlock_date?: string;
  is_unlocked: boolean;
  code_or_link?: string;
  audience_scope?: GiftAudience;
  recipient_user_id?: string | null;
  relationship_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type NewGift = Omit<Gift, 'id' | 'created_at' | 'created_by'>;

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

  async updateGift(giftId: string, updates: Partial<NewGift>): Promise<Gift> {
    const { data, error } = await supabase
      .from('gifts')
      .update(updates)
      .eq('id', giftId)
      .select()
      .single();
    if (error) throw error;
    return data as Gift;
  },

  async deleteGift(giftId: string): Promise<void> {
    const { data, error } = await supabase
      .from('gifts')
      .delete()
      .eq('id', giftId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error('Supabase no confirmó el borrado. Comprueba que la migración de permisos de regalos esté aplicada y que seas autor del regalo o Game Master.');
    }
  },

  async createGift(newGift: NewGift): Promise<Gift> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para añadir un regalo al Realm.');

    const { data, error } = await supabase
      .from('gifts')
      .insert({
        ...newGift,
        audience_scope: newGift.audience_scope ?? 'realm',
        recipient_user_id: newGift.recipient_user_id ?? null,
        relationship_id: newGift.relationship_id ?? null,
        created_by: user.id,
      })
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para subir un archivo.');

    const path = `${user.id}/gift-cards/${crypto.randomUUID()}.${extension}`;
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