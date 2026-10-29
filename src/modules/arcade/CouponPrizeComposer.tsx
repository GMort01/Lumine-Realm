import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AlertCircle, LoaderCircle, Pencil, Plus, Ticket, Trash2 } from 'lucide-react';
import AudiencePicker, { type AudienceSelection } from '../../components/ui/AudiencePicker';
import type { ContentAudienceFilter } from '../../components/ui/ContentAudienceFilter';
import { couponPrizesService } from '../../services/couponPrizesService';
import type { CouponPrize } from '../../services/couponPrizesService';
import { InputValidationError, safeUiError } from '../../utils/validation';

interface CouponPrizeComposerProps {
  user: SupabaseUser;
  isAdmin: boolean;
  audienceFilter: ContentAudienceFilter;
  refreshKey: number;
  onCatalogChanged: () => void;
}

const emptyAudience: AudienceSelection = { scope: 'realm', recipientUserId: '', relationshipId: '' };

export default function CouponPrizeComposer({ user, isAdmin, audienceFilter, refreshKey, onCatalogChanged }: CouponPrizeComposerProps) {
  const [prizes, setPrizes] = useState<CouponPrize[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPrize, setEditingPrize] = useState<CouponPrize | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<AudienceSelection>(emptyAudience);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyPrizeId, setBusyPrizeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPrizes = useCallback(async () => {
    try {
      const items = await couponPrizesService.getPrizesForManagement();
      setPrizes(items);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al cargar los premios que puedes gestionar:', error);
      setErrorMessage('No se pudieron cargar los premios. Comprueba los permisos y la migración.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadPrizes);
  }, [loadPrizes, refreshKey]);

  const visiblePrizes = useMemo(() => prizes.filter((prize) => (
    audienceFilter === 'relationship'
      ? prize.audience_scope === 'relationship'
      : prize.audience_scope !== 'relationship'
  )), [audienceFilter, prizes]);

  function startEditing(prize: CouponPrize) {
    setEditingPrize(prize);
    setTitle(prize.title);
    setDescription(prize.description);
    setAudience({
      scope: prize.audience_scope ?? 'realm',
      recipientUserId: prize.recipient_user_id ?? '',
      relationshipId: prize.relationship_id ?? '',
    });
  }

  function resetEditor() {
    setEditingPrize(null);
    setTitle('');
    setDescription('');
    setAudience(emptyAudience);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (audience.scope === 'individual' && !audience.recipientUserId) throw new InputValidationError('Selecciona el miembro que podrá ganar este premio.');
      if (audience.scope === 'relationship' && !audience.relationshipId) throw new InputValidationError('Selecciona el vínculo que podrá ganar este premio.');
      if (!editingPrize && visiblePrizes.filter((prize) => prize.is_active).length >= 8) {
        throw new InputValidationError('Esta ruleta ya tiene 8 premios activos. Desactiva uno antes de añadir otro.');
      }
      const values = {
        title,
        description,
        audience_scope: audience.scope,
        recipient_user_id: audience.scope === 'individual' ? audience.recipientUserId : null,
        relationship_id: audience.scope === 'relationship' ? audience.relationshipId : null,
      };
      if (editingPrize) {
        await couponPrizesService.updatePrize(editingPrize.id, values);
      } else {
        await couponPrizesService.createPrize(values);
      }
      resetEditor();
      await loadPrizes();
      onCatalogChanged();
    } catch (error) {
      console.error('Error al guardar premio de ruleta:', error);
      setErrorMessage(safeUiError(error, 'No se pudo guardar el premio.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(prize: CouponPrize) {
    setBusyPrizeId(prize.id);
    setErrorMessage(null);
    try {
      if (!prize.is_active && visiblePrizes.filter((item) => item.is_active).length >= 8) {
        throw new InputValidationError('Esta ruleta ya tiene 8 premios activos. Desactiva uno antes de activar otro.');
      }
      await couponPrizesService.updatePrize(prize.id, { is_active: !prize.is_active });
      await loadPrizes();
      onCatalogChanged();
    } catch (error) {
      console.error('Error al cambiar el estado del premio:', error);
      setErrorMessage(safeUiError(error, 'No se pudo cambiar el estado.'));
    } finally {
      setBusyPrizeId(null);
    }
  }

  async function deletePrize(prize: CouponPrize) {
    if (!window.confirm(`¿Eliminar permanentemente el premio "${prize.title}"?`)) return;
    setBusyPrizeId(prize.id);
    setErrorMessage(null);
    try {
      await couponPrizesService.deletePrize(prize.id);
      await loadPrizes();
      onCatalogChanged();
    } catch (error) {
      console.error('Error al eliminar premio de ruleta:', error);
      setErrorMessage(safeUiError(error, 'No se pudo eliminar el premio.'));
    } finally {
      setBusyPrizeId(null);
    }
  }

  return (
    <details className="group rounded-2xl border border-violet-400/15 bg-slate-900/65 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-2 text-amber-200"><Ticket className="h-4 w-4" /></span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-slate-100">Gestionar premios</span>
          <span className="block text-xs text-slate-400">{visiblePrizes.filter((prize) => prize.is_active).length}/8 activos en la ruleta de {audienceFilter === 'relationship' ? 'pareja' : 'grupo'}</span>
        </span>
        <Plus className="h-4 w-4 text-violet-300 transition group-open:rotate-45" />
      </summary>
      <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
      <details open={Boolean(editingPrize)} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3">
          <span className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-2 text-amber-200"><Ticket className="h-4 w-4" /></span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-slate-100">{editingPrize ? `Editar: ${editingPrize.title}` : 'Añadir premio'}</span>
            <span className="block text-xs text-slate-400">Crea premios para el Realm, una persona o tu pareja.</span>
          </span>
          <Plus className="h-4 w-4 text-violet-300 transition group-open:rotate-45" />
        </summary>
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3 border-t border-slate-800 pt-4">
          <input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nombre del premio" aria-label="Nombre del premio" className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
          <textarea maxLength={2000} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe qué se gana..." aria-label="Descripción del premio" className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400" />
          <AudiencePicker userId={user.id} value={audience} onChange={setAudience} />
          {errorMessage && <p role="alert" className="flex items-center gap-2 text-xs text-red-300"><AlertCircle className="h-4 w-4" />{errorMessage}</p>}
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isSubmitting ? 'Guardando...' : editingPrize ? 'Guardar cambios' : 'Añadir premio'}
          </button>
          {editingPrize && <button type="button" onClick={resetEditor} className="ml-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>}
        </form>
      </details>

      <div className="border-t border-slate-800 pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Premios de esta ruleta</h3>
        {isLoading ? <p role="status" className="flex items-center gap-2 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando premios...</p>
          : visiblePrizes.length === 0 ? <p className="text-xs text-slate-500">No hay premios para este filtro.</p>
            : <ul className="space-y-2">
              {visiblePrizes.map((prize) => {
                const canManage = isAdmin || prize.created_by === user.id;
                return (
                  <li key={prize.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">{prize.title}</p>
                      <p className="text-[10px] text-slate-500">{prize.audience_scope === 'relationship' ? 'Pareja' : prize.audience_scope === 'individual' ? 'Individual' : 'Grupo'} · {prize.is_active ? 'Activo' : 'Inactivo'}</p>
                    </div>
                    {canManage && <>
                      <button type="button" disabled={busyPrizeId !== null} onClick={() => startEditing(prize)} aria-label={`Editar ${prize.title}`} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-violet-400 hover:text-violet-200"><Pencil className="h-4 w-4" /></button>
                      <button type="button" disabled={busyPrizeId !== null} onClick={() => void toggleActive(prize)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-amber-400 hover:text-amber-200 disabled:opacity-50">{busyPrizeId === prize.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : prize.is_active ? 'Desactivar' : 'Activar'}</button>
                      <button type="button" disabled={busyPrizeId !== null} onClick={() => void deletePrize(prize)} aria-label={`Eliminar ${prize.title}`} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-red-400 hover:text-red-200"><Trash2 className="h-4 w-4" /></button>
                    </>}
                  </li>
                );
              })}
            </ul>}
      </div>
      </div>
    </details>
  );
}
