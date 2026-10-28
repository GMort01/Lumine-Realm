import { useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, FileImage, Gift, LoaderCircle, Plus, Shield } from 'lucide-react';
import { giftsService } from '../../services/giftsService';
import CouponPrizesAdmin from './CouponPrizesAdmin';
import RealmConnectionAdmin from './RealmConnectionAdmin';
import RealmMembersAdmin from './RealmMembersAdmin';
import TimelineEventsAdmin from './TimelineEventsAdmin';
import type { Gift as GiftType, NewGift } from '../../services/giftsService';

interface AdminPanelProps {
  onGiftCreated: (gift: GiftType) => void;
}

const initialForm = {
  title: '',
  description: '',
  category: '',
  rarity: 'common',
  media_url: '',
  is_unlocked: false,
};

export default function AdminPanel({ onGiftCreated }: AdminPanelProps) {
  const [form, setForm] = useState(initialForm);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    let uploadedAttachmentPath: string | null = null;

    try {
      let mediaUrl = form.media_url.trim();
      if (attachmentFile) {
        const uploaded = await giftsService.uploadGiftAttachment(attachmentFile);
        uploadedAttachmentPath = uploaded.path;
        mediaUrl = uploaded.path;
      }

      const newGift: NewGift = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        rarity: form.rarity,
        is_unlocked: form.is_unlocked,
        ...(mediaUrl ? { media_url: mediaUrl } : {}),
      };
      const createdGift = await giftsService.createGift(newGift);
      onGiftCreated(createdGift);
      setForm(initialForm);
      setAttachmentFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessMessage('El regalo se creó correctamente y ya está en el inventario.');
    } catch (error) {
      console.error('Error al crear el regalo:', error);
      let message = error instanceof Error ? error.message : 'Error inesperado.';
      if (uploadedAttachmentPath) {
        try {
          await giftsService.removeGiftAttachment(uploadedAttachmentPath);
        } catch (cleanupError) {
          console.error('No se pudo limpiar el archivo que quedó sin regalo:', cleanupError);
          message += ' No se pudo eliminar el archivo subido; revisa el bucket de Storage.';
        }
      }
      setErrorMessage(`No se pudo crear el regalo. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15';

  return (
    <section aria-labelledby="admin-title" className="mx-auto w-full max-w-5xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-realm-border/80 bg-gradient-to-r from-violet-950/60 via-card to-pink-950/40 p-6 shadow-xl shadow-black/20 backdrop-blur-md sm:p-8">
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 p-3 text-violet-200">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300">Panel de control</p>
            <h2 id="admin-title" className="mt-1 text-2xl font-extrabold text-slate-100 sm:text-3xl">Administración del Realm</h2>
            <p className="mt-1 text-sm text-slate-400">Gestiona quién participa y qué recuerdos aparecen en el Realm.</p>
          </div>
        </div>
      </header>

      <RealmMembersAdmin />
      <CouponPrizesAdmin />
      <TimelineEventsAdmin />
      <RealmConnectionAdmin />

      <section aria-labelledby="create-gift-title" className="rounded-3xl border border-violet-400/15 bg-slate-900/70 p-5 shadow-xl shadow-violet-950/10 sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="rounded-xl border border-pink-300/20 bg-pink-400/10 p-2.5 text-pink-200">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h3 id="create-gift-title" className="text-lg font-bold text-slate-100">Crear un regalo</h3>
            <p className="text-xs text-slate-400">Añade un recuerdo, experiencia o archivo al inventario.</p>
          </div>
        </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="gift-title" className="mb-1.5 block text-xs font-medium text-slate-300">Título</label>
          <input
            id="gift-title"
            className={inputClassName}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            maxLength={120}
            required
            placeholder="Nombre del regalo"
          />
        </div>

        <div>
          <label htmlFor="gift-description" className="mb-1.5 block text-xs font-medium text-slate-300">Descripción</label>
          <textarea
            id="gift-description"
            className={`${inputClassName} min-h-28 resize-y`}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={5000}
            required
            placeholder="Cuenta la historia detrás de este recuerdo..."
          />
        </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="gift-category" className="mb-1.5 block text-xs font-medium text-slate-300">Categoría</label>
            <input
              id="gift-category"
              className={inputClassName}
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              maxLength={80}
              required
              placeholder="Ej. Recuerdo, Experiencia"
            />
          </div>
          <div>
            <label htmlFor="gift-rarity" className="mb-1.5 block text-xs font-medium text-slate-300">Rareza</label>
            <select
              id="gift-rarity"
              className={inputClassName}
              value={form.rarity}
              onChange={(event) => setForm({ ...form, rarity: event.target.value })}
            >
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div>
              <label htmlFor="gift-media-url" className="block text-xs font-medium text-slate-300">Enlace de imagen o PDF <span className="text-slate-500">(opcional)</span></label>
              <input
                id="gift-media-url"
                type="url"
                className={`${inputClassName} mt-2`}
                value={form.media_url}
                onChange={(event) => setForm({ ...form, media_url: event.target.value })}
                placeholder="https://ejemplo.com/archivo"
              />
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500">Puedes pegar un enlace o seleccionar un archivo para subirlo.</p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center gap-3">
            <FileImage className="h-4 w-4 shrink-0 text-violet-300" />
            <div className="min-w-0 flex-1">
              <label htmlFor="gift-attachment" className="mb-1.5 block text-xs font-medium text-slate-300">O subir archivo a Supabase Storage</label>
              <input
                ref={fileInputRef}
                id="gift-attachment"
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(event) => {
                  setAttachmentFile(event.target.files?.[0] ?? null);
                  setErrorMessage(null);
                }}
                className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200 hover:file:bg-violet-500/25"
              />
            </div>
          </div>
          {attachmentFile && (
            <p className="text-[11px] text-slate-400">
              Archivo seleccionado: <span className="text-violet-200">{attachmentFile.name}</span>
              {form.media_url.trim() && ' · El archivo subido reemplazará la URL.'}
            </p>
          )}
          <p className="text-[10px] text-slate-500">Imágenes o PDF, máximo 20 MB. Los archivos se guardan en privado y solo usuarios autenticados pueden abrirlos.</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3">
          <input
            type="checkbox"
            checked={form.is_unlocked}
            onChange={(event) => setForm({ ...form, is_unlocked: event.target.checked })}
            className="h-4 w-4 accent-violet-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-200">Regalo desbloqueado</span>
            <span className="block text-xs text-slate-500">Indica si ya se puede abrir.</span>
          </span>
        </label>

        {errorMessage && (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMessage}
          </p>
        )}

        <div className="flex justify-end border-t border-slate-800 pt-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/10 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-48"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isSubmitting ? 'Guardando...' : 'Crear regalo'}
        </button>
        </div>
      </form>
      </section>
    </section>
  );
}
