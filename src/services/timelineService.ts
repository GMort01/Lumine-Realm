import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

const TIMELINE_BUCKET = 'realm-timeline-images';

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  image_path: string | null;
  image_url: string | null;
  is_anniversary: boolean;
  created_at: string;
}

export interface NewTimelineEvent {
  title: string;
  description: string;
  event_date: string;
  image_path?: string | null;
  is_anniversary: boolean;
}

async function requireAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Solo el administrador puede gestionar la línea del tiempo.');
  }
}

export const timelineService = {
  async getEvents(): Promise<TimelineEvent[]> {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('id, title, description, event_date, image_path, is_anniversary, created_at')
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
    await requireAdmin();
    if (!file.type.startsWith('image/')) {
      throw new Error('Selecciona un archivo de imagen.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('La imagen no puede superar los 10 MB.');
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !/^[a-z0-9]{2,5}$/.test(extension)) {
      throw new Error('El formato de imagen no es válido.');
    }

    const path = `events/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(TIMELINE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  },

  async createEvent(event: NewTimelineEvent): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Solo el administrador puede gestionar la línea del tiempo.');
    }

    const { error } = await supabase
      .from('timeline_events')
      .insert({
        title: event.title.trim(),
        description: event.description.trim(),
        event_date: event.event_date,
        image_path: event.image_path ?? null,
        is_anniversary: event.is_anniversary,
        created_by: user.id,
      });

    if (error) throw error;
  },

  async removeImage(path: string): Promise<void> {
    const { error } = await supabase.storage.from(TIMELINE_BUCKET).remove([path]);
    if (error) throw error;
  },
};
