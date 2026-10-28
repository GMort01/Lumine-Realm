import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from './config/supabase';
import MainHub from './modules/hub/MainHub';
import { giftsService } from './services/giftsService';
import type { Gift } from './services/giftsService';

export default function App() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let requestId = 0;

    async function loadGifts(hasSession: boolean) {
      const currentRequestId = ++requestId;
      if (!hasSession) {
        if (isMounted) {
          setGifts([]);
          setErrorMessage(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await giftsService.getAllGifts();
        if (isMounted && currentRequestId === requestId) {
          setGifts(data);
        }
      } catch (error) {
        console.error('Error al cargar los regalos:', error);
        if (isMounted && currentRequestId === requestId) {
          setErrorMessage('No se pudieron cargar los regalos. Revisa la conexión e inténtalo de nuevo.');
        }
      } finally {
        if (isMounted && currentRequestId === requestId) {
          setLoading(false);
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadGifts(Boolean(session));
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      void loadGifts(Boolean(data.session));
    }).catch((error: unknown) => {
      console.error('Error al recuperar la sesión para cargar el inventario:', error);
      if (isMounted) {
        setErrorMessage('No se pudo comprobar la sesión para cargar los regalos.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <MainHub
        gifts={gifts}
        onGiftCreated={(gift) => setGifts((currentGifts) => [gift, ...currentGifts])}
        onGiftUpdated={(gift) => setGifts((currentGifts) => currentGifts.map((current) => current.id === gift.id ? gift : current))}
        onGiftDeleted={(giftId) => setGifts((currentGifts) => currentGifts.filter((gift) => gift.id !== giftId))}
      />
      {loading && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-xl border border-violet-500/30 bg-slate-900 px-4 py-3 text-sm font-medium text-violet-300 shadow-lg"
        >
          Cargando inventario...
        </p>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-red-500/30 bg-slate-900 px-4 py-3 text-sm text-red-400 shadow-lg"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </>
  );
}
