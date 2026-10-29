import { useState, type FormEvent } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AlertCircle, FileImage, LoaderCircle, Plus } from 'lucide-react';
import AudiencePicker, { type AudienceSelection } from '../../components/ui/AudiencePicker';
import { timelineService } from '../../services/timelineService';
import type { TimelineEvent } from '../../services/timelineService';
import { InputValidationError, safeUiError } from '../../utils/validation';

interface TimelineMemoryComposerProps {
  user: SupabaseUser;
  memory?: TimelineEvent | null;
  onMemoryCreated: () => void;
  onMemoryUpdated?: () => void;
  onCancel?: () => void;
}

function todayAsInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function TimelineMemoryComposer({ user, memory = null, onMemoryCreated, onMemoryUpdated, onCancel }: TimelineMemoryComposerProps) {
  const initialAudience: AudienceSelection = {
    scope: memory?.audience_scope ?? 'realm',
    recipientUserId: memory?.recipient_user_id ?? '',
    relationshipId: memory?.relationship_id ?? '',
  };
  const [title, setTitle] = useState(memory?.title ?? '');
  const [description, setDescription] = useState(memory?.description ?? '');
  const [eventDate, setEventDate] = useState(memory?.event_date ?? todayAsInputValue());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audience, setAudience] = useState(initialAudience);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    let uploadedPath: string | null = null;
    let memorySaved = false;
    try {
      if (audience.scope === 'individual' && !audience.recipientUserId) throw new InputValidationError('Selecciona a quién compartir el recuerdo.');
      if (audience.scope === 'relationship' && !audience.relationshipId) throw new InputValidationError('Selecciona un vínculo de pareja aceptado.');
      if (imageFile) uploadedPath = await timelineService.uploadImage(imageFile);
      const eventData = {
        title,
        description,
        event_date: eventDate,
        image_path: uploadedPath ?? memory?.image_path,
        audience_scope: audience.scope,
        recipient_user_id: audience.scope === 'individual' ? audience.recipientUserId : null,
        relationship_id: audience.scope === 'relationship' ? audience.relationshipId : null,
      };
      if (memory) {
        await timelineService.updateEvent(memory.id, eventData);
        memorySaved = true;
        onMemoryUpdated?.();
        if (uploadedPath && memory.image_path) {
          try {
            await timelineService.removeImage(memory.image_path);
          } catch (storageError) {
            console.error('El recuerdo se actualizó, pero no se pudo borrar su imagen anterior:', storageError);
          }
        }
        setSuccessMessage('Recuerdo actualizado.');
      } else {
        await timelineService.createEvent(eventData);
        memorySaved = true;
        setTitle('');
        setDescription('');
        setEventDate(todayAsInputValue());
        setImageFile(null);
        setAudience(initialAudience);
        setSuccessMessage('El recuerdo quedó guardado.');
        onMemoryCreated();
      }
    } catch (error) {
      console.error('Error al guardar un recuerdo:', error);
      let message = safeUiError(error, 'No se pudo guardar el recuerdo.');
      if (uploadedPath && !memorySaved) {
        try {
          await timelineService.removeImage(uploadedPath);
        } catch (cleanupError) {
          console.error('No se pudo limpiar la imagen del recuerdo:', cleanupError);
          message += ' No se pudo limpiar la imagen subida. Contacta al administrador.';
        }
      }
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <details open={Boolean(memory)} className="group rounded-2xl border border-violet-400/15 bg-slate-900/65 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="rounded-xl border border-violet-300/20 bg-violet-400/10 p-2 text-violet-200"><Plus className="h-4 w-4" /></span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-slate-100">{memory ? `Editar: ${memory.title}` : 'Añadir recuerdo'}</span>
          <span className="block text-xs text-slate-400">Un momento vivido, con fecha pasada o de hoy.</span>
        </span>
        <Plus className="h-4 w-4 text-violet-300 transition group-open:rotate-45" />
      </summary>
      <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4 border-t border-slate-800 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título del recuerdo" aria-label="Título del recuerdo" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
          <input required type="date" max={todayAsInputValue()} value={eventDate} onChange={(event) => setEventDate(event.target.value)} aria-label="Fecha del recuerdo" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
        </div>
        <textarea required maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Cuenta qué pasó y por qué quieres recordarlo..." aria-label="Descripción" className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
        <label className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300"><FileImage className="h-4 w-4 text-violet-300" />Foto opcional</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200" />
          <span className="mt-1 block text-[10px] text-slate-500">{imageFile ? imageFile.name : 'JPG, PNG, WebP, GIF o AVIF · máximo 10 MB'}</span>
        </label>
        <AudiencePicker userId={user.id} value={audience} onChange={setAudience} />
        {errorMessage && <p role="alert" className="flex items-center gap-2 text-xs text-red-300"><AlertCircle className="h-4 w-4" />{errorMessage}</p>}
        {successMessage && <p role="status" className="text-xs text-emerald-200">{successMessage}</p>}
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isSubmitting ? 'Guardando...' : memory ? 'Guardar cambios' : 'Guardar recuerdo'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="ml-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>}
      </form>
    </details>
  );
}
