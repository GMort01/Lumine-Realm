import { supabase } from '../config/supabase';
import { InputValidationError, sanitizePlainText, validateAudience, validateUuid } from '../utils/validation';

const TIMELINE_BUCKET = 'realm-timeline-images';

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  image_path: string | null;
  image_url: string | null;
  is_anniversary: boolean;
  audience_scope: 'realm' | 'individual' | 'relationship';
  recipient_user_id: string | null;
  relationship_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NewTimelineEvent {
  title: string;
  description: string;
  event_date: string;
  image_path?: string | null;
  is_anniversary?: boolean;
  audience_scope?: 'realm' | 'individual' | 'relationship';
  recipient_user_id?: string | null;
  relationship_id?: string | null;
}

function todayAsDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function validateEventDate(value: string) {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new InputValidationError('La fecha del recuerdo no es válida.');
  }
  if (value > todayAsDateString()) throw new InputValidationError('Los recuerdos deben tener una fecha presente o pasada.');
}

function validateImagePath(path: string | null | undefined) {
  const match = path == null ? null : /^events\/([0-9a-f-]{36})\/[a-z0-9-]+\.(?:avif|gif|jpe?g|png|webp)$/i.exec(path);
  if (path != null && !match) {
    throw new InputValidationError('La ruta de la imagen no es válida.');
  }
  if (match) validateUuid(match[1], 'La ruta de la imagen');
}

export const timelineService = {
  async getEvents(): Promise<TimelineEvent[]> {
    // Traer todos los eventos de la línea de tiempo ordenados por fecha
    const { data, error } = await supabase
      .from('timeline_events')
      .select('id, title, description, event_date, image_path, is_anniversary, audience_scope, recipient_user_id, relationship_id, created_by, created_at')
      .lte('event_date', todayAsDateString())
      .order('event_date', { ascending: false });

    if (error) throw error;

    // Procesar imágenes con fallback de URL pública o firmada sin romper la carga global
    return Promise.all(
      data.map(async (event) => {
        if (!event.image_path) return { ...event, image_url: null };

        try {
          // Intentar obtener primero la URL pública
          const { data: publicUrlData } = supabase.storage
            .from(TIMELINE_BUCKET)
            .getPublicUrl(event.image_path);

          if (publicUrlData?.publicUrl) {
            return { ...event, image_url: publicUrlData.publicUrl };
          }

          // Si requiere URL firmada:
          const { data: signedData, error: imageError } = await supabase.storage
            .from(TIMELINE_BUCKET)
            .createSignedUrl(event.image_path, 60 * 60 * 24); // Válido por 24h

          if (imageError || !signedData) {
            console.warn(`No se pudo generar la URL para la imagen ${event.image_path}:`, imageError);
            return { ...event, image_url: null };
          }

          return { ...event, image_url: signedData.signedUrl };
        } catch (err) {
          console.error('Error al resolver la imagen del recuerdo:', err);
          return { ...event, image_url: null };
        }
      })
    );
  },

  async uploadImage(file: File): Promise<string> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para adjuntar una foto al recuerdo.');
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    if (!allowedTypes.has(file.type)) throw new InputValidationError('Selecciona una imagen JPG, PNG, WebP, GIF o AVIF.');
    if (file.size > 10 * 1024 * 1024) {
      throw new InputValidationError('La imagen no puede superar los 10 MB.');
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !/^(jpe?g|png|webp|gif|avif)$/.test(extension)) {
      throw new InputValidationError('El formato de imagen no es válido.');
    }

    const path = `events/${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(TIMELINE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  },

  async createEvent(event: NewTimelineEvent): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para añadir un recuerdo.');
    validateUuid(user.id, 'La cuenta');
    validateEventDate(event.event_date);
    validateImagePath(event.image_path);
    const audienceScope = event.audience_scope ?? 'realm';
    const recipientUserId = event.recipient_user_id ?? null;
    const relationshipId = event.relationship_id ?? null;
    validateAudience(audienceScope, recipientUserId, relationshipId);

    const { error } = await supabase
      .from('timeline_events')
      .insert({
        title: sanitizePlainText(event.title, 'El título', 80),
        description: sanitizePlainText(event.description, 'La descripción', 5000),
        event_date: event.event_date,
        image_path: event.image_path ?? null,
        is_anniversary: false,
        audience_scope: audienceScope,
        recipient_user_id: recipientUserId,
        relationship_id: relationshipId,
        created_by: user.id,
      });

    if (error) throw error;
  },

  async updateEvent(eventId: string, updates: Partial<NewTimelineEvent>): Promise<void> {
    validateUuid(eventId, 'El recuerdo');
    if (updates.event_date !== undefined) validateEventDate(updates.event_date);
    if (updates.image_path !== undefined) validateImagePath(updates.image_path);
    if (updates.audience_scope !== undefined) {
      validateAudience(updates.audience_scope, updates.recipient_user_id, updates.relationship_id);
    } else if (updates.recipient_user_id !== undefined || updates.relationship_id !== undefined) {
      throw new InputValidationError('Selecciona una audiencia para cambiar el destinatario.');
    }
    if (updates.recipient_user_id) validateUuid(updates.recipient_user_id, 'El destinatario');
    if (updates.relationship_id) validateUuid(updates.relationship_id, 'El vínculo de pareja');

    const { error } = await supabase
      .from('timeline_events')
      .update({
        ...(updates.title !== undefined ? { title: sanitizePlainText(updates.title, 'El título', 80) } : {}),
        ...(updates.description !== undefined ? { description: sanitizePlainText(updates.description, 'La descripción', 5000) } : {}),
        ...(updates.event_date !== undefined ? { event_date: updates.event_date } : {}),
        ...(updates.image_path !== undefined ? { image_path: updates.image_path } : {}),
        ...(updates.audience_scope !== undefined ? { audience_scope: updates.audience_scope } : {}),
        ...(updates.recipient_user_id !== undefined ? { recipient_user_id: updates.recipient_user_id } : {}),
        ...(updates.relationship_id !== undefined ? { relationship_id: updates.relationship_id } : {}),
      })
      .eq('id', eventId);
    if (error) throw error;
  },

  async deleteEvent(eventId: string): Promise<void> {
    validateUuid(eventId, 'El recuerdo');
    const { error } = await supabase.from('timeline_events').delete().eq('id', eventId);
    if (error) throw error;
  },

  async removeImage(path: string): Promise<void> {
    validateImagePath(path);
    if (!path) throw new Error('La ruta de la imagen no es válida.');
    const { error } = await supabase.storage.from(TIMELINE_BUCKET).remove([path]);
    if (error) throw error;
  },
};