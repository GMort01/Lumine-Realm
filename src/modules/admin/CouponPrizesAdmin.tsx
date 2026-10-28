import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, LoaderCircle, Pencil, Plus, Save, Ticket, X } from 'lucide-react';
import { couponPrizesService } from '../../services/couponPrizesService';
import type { CouponPrize } from '../../services/couponPrizesService';

interface PrizeDraft {
  title: string;
  description: string;
}

const MAX_ACTIVE_PRIZES = 8;

export default function CouponPrizesAdmin() {
  const [prizes, setPrizes] = useState<CouponPrize[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PrizeDraft>({ title: '', description: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const activePrizeCount = prizes.filter((prize) => prize.is_active).length;

  const loadPrizes = useCallback(async () => {
    try {
      setPrizes(await couponPrizesService.getAllPrizesForAdmin());
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al cargar premios para administración:', error);
      setErrorMessage('No se pudo cargar el catálogo de premios. Verifica la migración y los permisos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrizes();
  }, [loadPrizes]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAdding || activePrizeCount >= MAX_ACTIVE_PRIZES) return;
    setIsAdding(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await couponPrizesService.createPrize({ title, description });
      setPrizes((current) => [...current, created]);
      setTitle('');
      setDescription('');
      setSuccessMessage('Premio añadido al catálogo.');
    } catch (error) {
      console.error('Error al añadir premio:', error);
      setErrorMessage('No se pudo añadir el premio.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSave(prizeId: string) {
    if (busyId) return;
    setBusyId(prizeId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await couponPrizesService.updatePrize(prizeId, draft);
      setPrizes((current) => current.map((prize) => prize.id === prizeId ? updated : prize));
      setEditingId(null);
      setSuccessMessage('Premio actualizado.');
    } catch (error) {
      console.error('Error al actualizar premio:', error);
      setErrorMessage('No se pudo guardar el premio.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(prize: CouponPrize) {
    if (busyId) return;
    if (!prize.is_active && activePrizeCount >= MAX_ACTIVE_PRIZES) {
      setErrorMessage(`La ruleta admite como máximo ${MAX_ACTIVE_PRIZES} premios activos.`);
      setSuccessMessage(null);
      return;
    }
    setBusyId(prize.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await couponPrizesService.updatePrize(prize.id, { is_active: !prize.is_active });
      setPrizes((current) => current.map((item) => item.id === prize.id ? updated : item));
      setSuccessMessage(updated.is_active ? 'Premio activado para la ruleta.' : 'Premio desactivado; ya no podrá salir.');
    } catch (error) {
      console.error('Error al cambiar estado del premio:', error);
      setErrorMessage('No se pudo cambiar el estado del premio.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="coupon-prizes-admin-title" className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl shadow-black/10 backdrop-blur-md sm:p-7">
      <header className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-5">
        <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-2.5 text-amber-200"><Ticket className="h-5 w-5" /></div>
        <div>
          <h3 id="coupon-prizes-admin-title" className="text-lg font-bold text-slate-100">Premios de la ruleta</h3>
          <p className="mt-1 text-xs text-slate-400">Edita el catálogo y activa solo los premios que quieres ofrecer.</p>
        </div>
      </header>

      <form onSubmit={(event) => void handleAdd(event)} className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
        <input aria-label="Título del nuevo premio" required maxLength={70} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título del premio" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400" />
        <input aria-label="Descripción del nuevo premio" required maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción breve" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400" />
        <button type="submit" disabled={isAdding || activePrizeCount >= MAX_ACTIVE_PRIZES} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60">
          {isAdding ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir premio
        </button>
      </form>
      <p className="mt-2 text-[10px] text-slate-500">{activePrizeCount}/{MAX_ACTIVE_PRIZES} espacios activos en la ruleta.</p>

      {isLoading ? (
        <p role="status" className="mt-5 flex items-center gap-2 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando premios...</p>
      ) : prizes.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-slate-400">Todavía no hay premios configurados.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {prizes.map((prize) => (
            <li key={prize.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="space-y-4">
                <div className="min-w-0">
                  {editingId === prize.id ? (
                    <div className="space-y-2">
                      <input aria-label={`Editar título de ${prize.title}`} maxLength={70} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400" />
                      <textarea aria-label={`Editar descripción de ${prize.title}`} maxLength={300} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400" />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-100">{prize.title}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${prize.is_active ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                          {prize.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{prize.description}</p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {editingId === prize.id ? 'Edición del premio' : `Estado: ${prize.is_active ? 'Activo' : 'Inactivo'}`}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                  {editingId === prize.id ? (
                    <>
                      <button type="button" aria-label="Guardar cambios del premio" disabled={busyId === prize.id || !draft.title.trim() || !draft.description.trim()} onClick={() => void handleSave(prize.id)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300/20 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/10 disabled:opacity-50">
                        {busyId === prize.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
                      </button>
                      <button type="button" aria-label="Cancelar edición" onClick={() => setEditingId(null)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"><X className="h-4 w-4" /> Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button type="button" aria-label={`Editar ${prize.title}`} onClick={() => { setEditingId(prize.id); setDraft({ title: prize.title, description: prize.description }); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:border-violet-300/40 hover:bg-violet-400/10 hover:text-violet-200"><Pencil className="h-4 w-4" /> Editar</button>
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={prize.is_active}
                          aria-label={`${prize.is_active ? 'Desactivar' : 'Activar'} ${prize.title}`}
                          disabled={busyId === prize.id || (!prize.is_active && activePrizeCount >= MAX_ACTIVE_PRIZES)}
                          onClick={() => void handleToggle(prize)}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${prize.is_active ? 'border-emerald-300/40 bg-emerald-500/70' : 'border-slate-600 bg-slate-800'}`}
                        >
                          <span className={`block h-5 w-5 shrink-0 rounded-full bg-white shadow transition-transform ${prize.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <span className={`min-w-[4.75rem] text-xs font-semibold ${prize.is_active ? 'text-emerald-200' : 'text-slate-400'}`}>
                          {prize.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </span>
                    </>
                  )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {errorMessage && <p role="alert" className="mt-4 text-xs text-red-300">{errorMessage}</p>}
      {successMessage && <p role="status" className="mt-4 flex items-center gap-2 text-xs text-emerald-200"><Check className="h-3.5 w-3.5" />{successMessage}</p>}
    </section>
  );
}
