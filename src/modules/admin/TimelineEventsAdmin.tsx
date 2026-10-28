import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, FileImage, LoaderCircle, Plus } from 'lucide-react';
import { timelineService } from '../../services/timelineService';
import type { TimelineEvent } from '../../services/timelineService';

function todayAsInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function TimelineEventsAdmin() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(todayAsInputValue);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await timelineService.getEvents());
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al cargar hitos para administración:', error);
      setErrorMessage('No se pudieron cargar los hitos. Comprueba la migración y los permisos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadEvents);
  }, [loadEvents]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    let uploadedPath: string | null = null;

    try {
      if (imageFile) uploadedPath = await timelineService.uploadImage(imageFile);
      await timelineService.createEvent({
        title,
        description,
        event_date: eventDate,
        image_path: uploadedPath,
      });
      setTitle('');
      setDescription('');
      setEventDate(todayAsInputValue());
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccessMessage('El hito se añadió a la línea del tiempo.');
      await loadEvents();
    } catch (error) {
      console.error('Error al crear un hito:', error);
      let message = error instanceof Error ? error.message : 'Error inesperado.';
      if (uploadedPath) {
        try {
          await timelineService.removeImage(uploadedPath);
        } catch (cleanupError) {
          console.error('No se pudo limpiar la imagen del hito:', cleanupError);
          message += ' La imagen quedó en Storage; revisa el bucket.';
        }
      }
      setErrorMessage(`No se pudo guardar el hito. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="timeline-admin-title" className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl shadow-black/10 backdrop-blur-md sm:p-7">
      <header className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-5">
        <div className="rounded-xl border border-pink-300/20 bg-pink-400/10 p-2.5 text-pink-200"><CalendarDays className="h-5 w-5" /></div>
        <div>
          <h3 id="timeline-admin-title" className="text-lg font-bold text-slate-100">Línea del tiempo</h3>
          <p className="mt-1 text-xs text-slate-400">Añade un momento que ya ocurrió, con una fecha pasada o de hoy.</p>
        </div>
      </header>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="timeline-title" className="mb-1.5 block text-xs font-medium text-slate-300">Título del recuerdo</label>
            <input id="timeline-title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Nuestro primer viaje" className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400" />
          </div>
          <div>
            <label htmlFor="timeline-date" className="mb-1.5 block text-xs font-medium text-slate-300">Fecha del recuerdo</label>
            <input id="timeline-date" type="date" required max={todayAsInputValue()} value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
          </div>
        </div>

        <div>
          <label htmlFor="timeline-description" className="mb-1.5 block text-xs font-medium text-slate-300">Descripción</label>
          <textarea id="timeline-description" required maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Cuenta por qué este momento es especial..." className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400" />
        </div>

        <div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <label htmlFor="timeline-image" className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300"><FileImage className="h-4 w-4 text-violet-300" />Imagen <span className="text-slate-500">(opcional)</span></label>
            <input ref={fileInputRef} id="timeline-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200" />
            <p className="mt-2 text-[10px] text-slate-500">{imageFile ? imageFile.name : 'JPG, PNG, WebP o GIF · máximo 10 MB'}</p>
          </div>
        </div>

        {errorMessage && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{errorMessage}</p>}
        {successMessage && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0" />{successMessage}</p>}

        <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isSubmitting ? 'Guardando recuerdo...' : 'Añadir recuerdo'}
        </button>
      </form>

      <p className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
        {isLoading ? 'Cargando hitos...' : `${events.length} ${events.length === 1 ? 'hito guardado' : 'hitos guardados'}`}
      </p>
    </section>
  );
}
