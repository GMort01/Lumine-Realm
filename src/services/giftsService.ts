import { supabase } from '../config/supabase';
import { InputValidationError, sanitizePlainText, validateAudience, validateHttpsUrl, validateUuid } from '../utils/validation';

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

function validateMediaReference(value: string | null | undefined): string | null {
  const mediaReference = value?.trim() ?? '';
  if (!mediaReference) return null;
  if (/^https:\/\//i.test(mediaReference)) {
    return validateHttpsUrl(mediaReference, 'El enlace del medio');
  }
  const match = /^([0-9a-f-]{36})\/gift-cards\/[a-z0-9-]+\.(?:avif|gif|jpe?g|pdf|png|webp)$/i.exec(mediaReference);
  if (!match) {
    throw new InputValidationError('La ruta del archivo adjunto no es válida.');
  }
  validateUuid(match[1], 'La ruta del archivo adjunto');
  return mediaReference;
}

function validateRarity(rarity: string) {
  if (!['common', 'rare', 'epic', 'legendary'].includes(rarity)) {
    throw new InputValidationError('La rareza seleccionada no es válida.');
  }
}

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
    validateUuid(giftId, 'El regalo');
    const values: Partial<NewGift> = {};
    if (updates.title !== undefined) values.title = sanitizePlainText(updates.title, 'El título', 80);
    if (updates.description !== undefined) values.description = sanitizePlainText(updates.description, 'La descripción', 5000);
    if (updates.category !== undefined) values.category = sanitizePlainText(updates.category, 'La categoría', 80);
    if (updates.rarity !== undefined) {
      validateRarity(updates.rarity);
      values.rarity = updates.rarity;
    }
    if (updates.media_url !== undefined) values.media_url = validateMediaReference(updates.media_url);
    if (updates.audience_scope !== undefined) {
      validateAudience(updates.audience_scope, updates.recipient_user_id, updates.relationship_id);
      values.audience_scope = updates.audience_scope;
      values.recipient_user_id = updates.recipient_user_id ?? null;
      values.relationship_id = updates.relationship_id ?? null;
    } else if (updates.recipient_user_id !== undefined || updates.relationship_id !== undefined) {
      throw new InputValidationError('Selecciona una audiencia para cambiar el destinatario.');
    }
    if (updates.is_unlocked !== undefined) {
      if (typeof updates.is_unlocked !== 'boolean') throw new InputValidationError('El estado del regalo no es válido.');
      values.is_unlocked = updates.is_unlocked;
    }

    const { data, error } = await supabase
      .from('gifts')
      .update(values)
      .eq('id', giftId)
      .select()
      .single();
    if (error) throw error;
    return data as Gift;
  },

  async deleteGift(giftId: string): Promise<void> {
    validateUuid(giftId, 'El regalo');
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
    validateUuid(user.id, 'La cuenta');
    const audienceScope = newGift.audience_scope ?? 'realm';
    const recipientUserId = newGift.recipient_user_id ?? null;
    const relationshipId = newGift.relationship_id ?? null;
    validateAudience(audienceScope, recipientUserId, relationshipId);
    validateRarity(newGift.rarity);
    if (typeof newGift.is_unlocked !== 'boolean') throw new InputValidationError('El estado del regalo no es válido.');
    const safeMediaUrl = validateMediaReference(newGift.media_url);

    const { data, error } = await supabase
      .from('gifts')
      .insert({
        title: sanitizePlainText(newGift.title, 'El título', 80),
        description: sanitizePlainText(newGift.description, 'La descripción', 5000),
        category: sanitizePlainText(newGift.category, 'La categoría', 80),
        rarity: newGift.rarity,
        is_unlocked: newGift.is_unlocked,
        media_url: safeMediaUrl,
        audience_scope: audienceScope,
        recipient_user_id: recipientUserId,
        relationship_id: relationshipId,
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
      throw new InputValidationError('El archivo debe ser una imagen compatible o un PDF.');
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new InputValidationError('El archivo no puede superar los 20 MB.');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para subir un archivo.');
    validateUuid(user.id, 'La cuenta');

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

    if (/^https:\/\//i.test(reference)) {
      const safeUrl = validateHttpsUrl(reference, 'El enlace del medio');
      const publicMarker = `/storage/v1/object/public/${bucket}/`;
      const signedMarker = `/storage/v1/object/sign/${bucket}/`;
      const marker = safeUrl?.includes(publicMarker) ? publicMarker : safeUrl?.includes(signedMarker) ? signedMarker : null;

      if (!marker) {
        if (!safeUrl) throw new InputValidationError('El enlace del medio no es válido.');
        return safeUrl;
      }

      const markerIndex = safeUrl.indexOf(marker);
      path = decodeURIComponent(safeUrl.slice(markerIndex + marker.length).split(/[?#]/, 1)[0]);
      path = validateMediaReference(path) ?? '';
      if (!path || /^https:\/\//i.test(path)) throw new InputValidationError('La ruta del archivo adjunto no es válida.');
    } else if (path.startsWith(`${bucket}/`)) {
      path = validateMediaReference(path.slice(bucket.length + 1)) ?? '';
    } else {
      path = validateMediaReference(path) ?? '';
      if (!path || /^https:\/\//i.test(path)) throw new InputValidationError('La ruta del archivo adjunto no es válida.');
    }

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) {
      throw error;
    }

    return data.signedUrl;
  },

  async removeGiftAttachment(path: string): Promise<void> {
    const safePath = validateMediaReference(path);
    if (!safePath || /^https:\/\//i.test(safePath)) throw new InputValidationError('La ruta del archivo adjunto no es válida.');
    const { error } = await supabase.storage.from(GIFT_ATTACHMENTS_BUCKET).remove([safePath]);
    if (error) {
      throw error;
    }
  },
};