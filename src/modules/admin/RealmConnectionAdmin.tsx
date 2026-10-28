import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, Radio } from 'lucide-react';
import { realmStatusService } from '../../services/realmStatusService';

export default function RealmConnectionAdmin() {
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void realmStatusService.getStatus()
      .then((status) => {
        if (active) setConnected(status.is_player2_connected);
      })
      .catch((error: unknown) => {
        console.error('Error al leer el estado del Realm:', error);
        if (active) setErrorMessage('No se pudo leer realm_status. Comprueba que su migración esté aplicada.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleToggle() {
    if (isLoading || isUpdating) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const updated = await realmStatusService.setPlayer2Connected(!connected);
      setConnected(updated.is_player2_connected);
    } catch (error) {
      console.error('Error al actualizar conexión del Realm:', error);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo actualizar la conexión.');
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section aria-labelledby="realm-connection-admin-title" className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl shadow-black/10 backdrop-blur-md sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border p-2.5 ${connected ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200' : 'border-violet-300/20 bg-violet-400/10 text-violet-200'}`}>
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h3 id="realm-connection-admin-title" className="text-sm font-bold text-slate-100">Conexión del Realm</h3>
            <p className="mt-1 text-xs text-slate-400">{connected ? 'El indicador legacy de Player 2 está conectado.' : 'El indicador legacy de Player 2 está desconectado.'}</p>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={connected} aria-label="Cambiar conexión del Realm" disabled={isLoading || isUpdating} onClick={() => void handleToggle()} className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-wait disabled:opacity-60 ${connected ? 'border-emerald-300/50 bg-emerald-500/70' : 'border-slate-600 bg-slate-800'}`}>
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${connected ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>
      {isLoading && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-slate-400"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Cargando estado...</p>}
      {isUpdating && <p role="status" className="mt-3 text-xs text-violet-200">Actualizando conexión...</p>}
      {errorMessage && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-red-200"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{errorMessage}</p>}
    </section>
  );
}
