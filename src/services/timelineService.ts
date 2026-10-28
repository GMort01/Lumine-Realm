import { supabase } from '../config/supabase';

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

export const timelineService = {
  async getEvents(): Promise<TimelineEvent[]> {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('id, title, description, event_date, image_path, is_anniversary, audience_scope, recipient_user_id, relationship_id, created_by, created_at')
      .lte('event_date', todayAsDateString())
      .order('event_date', { ascending: false });

    if (error) throw error;

    return Promise.all(data.map(async (event) => {
      if (!event.image_path) return { ...event, image_url: null };
      const { data: image, error: imageError } = await supabase.storage
        .from(TIMELINE_BUCKET)
        .createSignedUrl(event.image_path, 60 * 60);
      if (imageError) throw imageError;
      return { ...event, image_url: image.signedUrl };
    })) as Promise<TimelineEvent[]>;
  },

  async uploadImage(file: File): Promise<string> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para adjuntar una foto al recuerdo.');
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    if (!allowedTypes.has(file.type)) throw new Error('Selecciona una imagen JPG, PNG, WebP, GIF o AVIF.');
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('La imagen no puede superar los 10 MB.');
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !/^(jpe?g|png|webp|gif|avif)$/.test(extension)) {
      throw new Error('El formato de imagen no es válido.');
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
    if (event.event_date > todayAsDateString()) throw new Error('Los recuerdos deben tener una fecha presente o pasada.');

    const { error } = await supabase
      .from('timeline_events')
      .insert({
        title: event.title.trim(),
        description: event.description.trim(),
        event_date: event.event_date,
        image_path: event.image_path ?? null,
        is_anniversary: false,
        audience_scope: event.audience_scope ?? 'realm',
        recipient_user_id: event.recipient_user_id ?? null,
        relationship_id: event.relationship_id ?? null,
        created_by: user.id,
      });

    if (error) throw error;
  },

  async updateEvent(eventId: string, updates: Partial<NewTimelineEvent>): Promise<void> {
    if (updates.event_date && updates.event_date > todayAsDateString()) {
      throw new Error('Los recuerdos deben tener una fecha presente o pasada.');
    }

    const { error } = await supabase
      .from('timeline_events')
      .update({
        ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
        ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
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
    const { error } = await supabase.from('timeline_events').delete().eq('id', eventId);
    if (error) throw error;
  },

  async removeImage(path: string): Promise<void> {
    const { error } = await supabase.storage.from(TIMELINE_BUCKET).remove([path]);
    if (error) throw error;
  },
};
