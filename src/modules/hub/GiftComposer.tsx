import { useState, type FormEvent } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AlertCircle, Gift, LoaderCircle, Plus } from 'lucide-react';
import AudiencePicker, { type AudienceSelection } from '../../components/ui/AudiencePicker';
import { giftsService } from '../../services/giftsService';
import type { Gift as GiftItem, NewGift } from '../../services/giftsService';

interface GiftComposerProps {
  user: SupabaseUser;
  gift?: GiftItem | null;
  onGiftCreated: (gift: GiftItem) => void;
  onGiftUpdated?: (gift: GiftItem) => void;
  onCancel?: () => void;
}

export default function GiftComposer({ user, gift = null, onGiftCreated, onGiftUpdated, onCancel }: GiftComposerProps) {
  const [title, setTitle] = useState(gift?.title ?? '');
  const [description, setDescription] = useState(gift?.description ?? '');
  const [category, setCategory] = useState(gift?.category ?? '');
  const [rarity, setRarity] = useState(gift?.rarity ?? 'common');
  const [audience, setAudience] = useState<AudienceSelection>({
    scope: gift?.audience_scope ?? 'realm',
    recipientUserId: gift?.recipient_user_id ?? '',
    relationshipId: gift?.relationship_id ?? '',
  });
  const [mediaUrl, setMediaUrl] = useState(gift?.media_url ?? '');
  const [isUnlocked, setIsUnlocked] = useState(gift?.is_unlocked ?? true);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
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
    let giftSaved = false;
    try {
      if (audience.scope === 'individual' && !audience.recipientUserId) throw new Error('Selecciona a quién quieres enviar el regalo.');
      if (audience.scope === 'relationship' && !audience.relationshipId) throw new Error('Selecciona el vínculo de pareja que podrá ver el regalo.');

      if (attachmentFile) {
        const uploaded = await giftsService.uploadGiftAttachment(attachmentFile);
        uploadedPath = uploaded.path;
      }

      const newGift: NewGift = {
        title,
        description,
        category,
        rarity,
        is_unlocked: isUnlocked,
        media_url: uploadedPath ?? (mediaUrl.trim() || null),
        audience_scope: audience.scope,
        recipient_user_id: audience.scope === 'individual' ? audience.recipientUserId : null,
        relationship_id: audience.scope === 'relationship' ? audience.relationshipId : null,
      };

      if (gift) {
        const updatedGift = await giftsService.updateGift(gift.id, newGift);
        giftSaved = true;
        onGiftUpdated?.(updatedGift);
        if (gift.media_url && gift.media_url !== newGift.media_url && !/^https?:\/\//i.test(gift.media_url)) {
          try {
            await giftsService.removeGiftAttachment(gift.media_url);
          } catch (storageError) {
            console.error('El regalo se actualizó, pero no se pudo borrar su archivo anterior:', storageError);
          }
        }
        setSuccessMessage('Regalo actualizado.');
      } else {
        const createdGift = await giftsService.createGift(newGift);
        giftSaved = true;
        onGiftCreated(createdGift);
        setTitle('');
        setDescription('');
        setCategory('');
        setRarity('common');
        setAudience({ scope: 'realm', recipientUserId: '', relationshipId: '' });
        setMediaUrl('');
        setIsUnlocked(true);
        setSuccessMessage('El regalo quedó guardado con la audiencia seleccionada.');
      }
      setAttachmentFile(null);
    } catch (error) {
      console.error('Error al guardar el regalo:', error);
      let message = error instanceof Error ? error.message : 'Error inesperado.';
      if (uploadedPath && !giftSaved) {
        try {
          await giftsService.removeGiftAttachment(uploadedPath);
        } catch (cleanupError) {
          console.error('No se pudo limpiar el archivo que quedó sin regalo:', cleanupError);
          message += ' No se pudo eliminar el archivo subido; revisa Storage.';
        }
      }
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <details open={Boolean(gift)} className="group rounded-2xl border border-violet-400/15 bg-slate-900/65 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="rounded-xl border border-pink-300/20 bg-pink-400/10 p-2 text-pink-200"><Gift className="h-4 w-4" /></span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-slate-100">{gift ? `Editar: ${gift.title}` : 'Compartir un regalo'}</span>
          <span className="block text-xs text-slate-400">Elige si será para todo el Realm, una persona o tu pareja.</span>
        </span>
        <Plus className="h-4 w-4 text-violet-300 transition group-open:rotate-45" />
      </summary>
      <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4 border-t border-slate-800 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nombre del regalo" aria-label="Título del regalo" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
          <input required maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Categoría, por ejemplo Recuerdo" aria-label="Categoría" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
        </div>
        <textarea required maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Cuenta la historia detrás de este regalo..." aria-label="Descripción" className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={rarity} onChange={(event) => setRarity(event.target.value)} aria-label="Rareza" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400">
            <option value="common">Común</option><option value="rare">Raro</option><option value="epic">Épico</option><option value="legendary">Legendario</option>
          </select>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} aria-label="Adjuntar imagen o PDF" className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200" />
        </div>
        <input type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Enlace externo opcional" aria-label="Enlace de medio externo" className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={isUnlocked} onChange={(event) => setIsUnlocked(event.target.checked)} className="accent-violet-500" />
          Regalo desbloqueado
        </label>
        <AudiencePicker userId={user.id} value={audience} onChange={setAudience} />
        {errorMessage && <p role="alert" className="flex items-center gap-2 text-xs text-red-300"><AlertCircle className="h-4 w-4" />{errorMessage}</p>}
        {successMessage && <p role="status" className="text-xs text-emerald-200">{successMessage}</p>}
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isSubmitting ? 'Guardando...' : gift ? 'Guardar cambios' : 'Compartir regalo'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="ml-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>}
      </form>
    </details>
  );
}
