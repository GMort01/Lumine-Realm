import { useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock3, LoaderCircle, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { ADMIN_EMAIL } from '../../config/roles';
import ContentAudienceFilter, { type ContentAudienceFilter as AudienceFilter } from '../../components/ui/ContentAudienceFilter';
import { timelineService } from '../../services/timelineService';
import type { TimelineEvent } from '../../services/timelineService';
import TimelineMemoryComposer from './TimelineMemoryComposer';

function localDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(localDate(value));
}

export default function TimelineView({ user }: { user: SupabaseUser | null }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(user));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('realm');
  const [editingMemory, setEditingMemory] = useState<TimelineEvent | null>(null);
  
  // Estado para controlar la imagen abierta en pantalla completa (Lightbox)
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const visibleEvents = events.filter((event) => {
    if (audienceFilter === 'relationship') {
      return (
        event.audience_scope === 'relationship' || 
        event.audience_scope === 'individual' ||
        event.recipient_user_id === user?.id
      );
    }
    return event.audience_scope === 'realm' || event.audience_scope === 'individual';
  });

  async function handleDeleteMemory(memory: TimelineEvent) {
    if (!window.confirm(`¿Eliminar el recuerdo "${memory.title}"?`)) return;
    try {
      await timelineService.deleteEvent(memory.id);
      if (memory.image_path) {
        try {
          await timelineService.removeImage(memory.image_path);
        } catch (storageError) {
          console.error('El recuerdo se eliminó, pero no se pudo borrar su imagen:', storageError);
        }
      }
      setEvents((current) => current.filter((event) => event.id !== memory.id));
    } catch (error) {
      console.error('Error al eliminar recuerdo:', error);
      window.alert('No se pudo eliminar el recuerdo.');
    }
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    setIsLoading(true);

    void timelineService.getEvents()
      .then((items) => {
        if (active) {
          setEvents(items);
          setErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        console.error('Error al cargar la línea del tiempo:', error);
        if (active) setErrorMessage('No se pudo cargar la línea del tiempo. Comprueba que las políticas de Supabase estén activas.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadVersion, user]);

  return (
    <section aria-labelledby="timeline-title" className="mx-auto w-full max-w-5xl space-y-7">
      <header className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-r from-violet-950/70 via-slate-900 to-pink-950/50 px-6 py-7 shadow-xl shadow-violet-950/10 sm:px-8">
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300">
            <Sparkles className="h-3.5 w-3.5" /> Momentos que nos unen
          </p>
          <h1 id="timeline-title" className="text-2xl font-extrabold text-white sm:text-3xl">Galería de recuerdos</h1>
          <p className="mt-2 text-sm text-slate-400">Momentos que ya vivimos y queremos conservar en el Realm.</p>
        </div>
      </header>

      {!user ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-sm text-slate-400">Inicia sesión para ver y guardar recuerdos del Realm.</p>
      ) : (
      <>
      {editingMemory ? (
        <TimelineMemoryComposer
          key={editingMemory.id}
          user={user}
          memory={editingMemory}
          onMemoryCreated={() => setReloadVersion((version) => version + 1)}
          onMemoryUpdated={() => {
            setEditingMemory(null);
            setReloadVersion((version) => version + 1);
          }}
          onCancel={() => setEditingMemory(null)}
        />
      ) : (
        <TimelineMemoryComposer user={user} onMemoryCreated={() => setReloadVersion((version) => version + 1)} />
      )}
      <section aria-labelledby="timeline-events-title">
        <div className="mb-5 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-pink-300" />
          <h2 id="timeline-events-title" className="text-sm font-bold uppercase tracking-wider text-slate-200">Nuestros momentos</h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">{visibleEvents.length}</span>
          <div className="ml-auto"><ContentAudienceFilter value={audienceFilter} onChange={setAudienceFilter} /></div>
        </div>

        {isLoading && <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-violet-200"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando recuerdos...</p>}
        {errorMessage && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{errorMessage}</p>}
        {!isLoading && !errorMessage && visibleEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-5 py-10 text-center text-sm text-slate-400">
            Aún no hay recuerdos en esta sección.
          </div>
        )}

        <ol className="relative space-y-5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-gradient-to-b before:from-violet-400/60 before:via-pink-400/30 before:to-transparent sm:before:left-[19px]">
          {visibleEvents.map((event, index) => (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.25) }}
              className="relative pl-10 sm:pl-12"
            >
              <span className="absolute left-[10px] top-5 h-3 w-3 rounded-full border-2 border-violet-200 bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.65)] sm:left-[14px]" />
              <article className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-lg shadow-black/10 backdrop-blur-md">
                
                {/* Contenedor de la Imagen Adaptable y Clickeable */}
                {event.image_url && (
                  <div 
                    className="relative group cursor-pointer overflow-hidden bg-slate-950/80 flex items-center justify-center p-2 border-b border-slate-800/50"
                    onClick={() => setSelectedImage({ url: event.image_url!, title: event.title })}
                  >
                    <img 
                      src={event.image_url} 
                      alt={event.title} 
                      className="max-h-[450px] w-full object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]" 
                      loading="lazy" 
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <span className="bg-slate-900/90 text-violet-200 text-xs px-3 py-1.5 rounded-full border border-violet-500/30 backdrop-blur-sm shadow-md">
                        Ver foto completa 🔍
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <time dateTime={event.event_date} className="font-mono text-[10px] uppercase tracking-wider text-violet-300">{formatDate(event.event_date)}</time>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">{event.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{event.description}</p>
                  {user && (isAdmin || event.created_by === user.id) && (
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => setEditingMemory(event)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-violet-400 hover:text-violet-200"><Pencil className="h-3.5 w-3.5" />Editar</button>
                      <button type="button" onClick={() => void handleDeleteMemory(event)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-red-400 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" />Eliminar</button>
                    </div>
                  )}
                </div>
              </article>
            </motion.li>
          ))}
        </ol>
      </section>
      </>
      )}

      {/* MODAL LIGHTBOX PARA VER IMAGEN A PANTALLA COMPLETA */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 rounded-full bg-slate-800/80 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-violet-500/20"
              />
              <p className="mt-3 font-mono text-xs text-slate-300 bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-800">
                {selectedImage.title}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}