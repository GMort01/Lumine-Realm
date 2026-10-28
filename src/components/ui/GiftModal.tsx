import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { AlertCircle, Download, FileText, Gift as GiftIcon, Heart, LoaderCircle, X } from 'lucide-react';
import { giftsService } from '../../services/giftsService';
import type { Gift } from '../../services/giftsService';

interface GiftModalProps {
  gift: Gift;
  onClose: () => void;
}

function formatGiftDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(date);
}

export default function GiftModal({ gift, onClose }: GiftModalProps) {
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState(false);
  const isPdf = gift.media_url ? /\.pdf(?:[?#]|$)/i.test(gift.media_url) : false;

  useEffect(() => {
    let active = true;

    if (gift.media_url) {
      void giftsService.getGiftAttachmentUrl(gift.media_url)
        .then((url) => {
          if (active) {
            setAttachmentUrl(url);
            setAttachmentError(false);
          }
        })
        .catch((error: unknown) => {
          console.error('Error al obtener el archivo del regalo:', error);
          if (active) {
            setAttachmentError(true);
          }
        });
    } else {
      setAttachmentUrl(null);
      setAttachmentError(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gift.media_url, onClose]);

  function celebrate() {
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.65 },
      colors: ['#c084fc', '#f472b6', '#fbbf24', '#ffffff'],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-modal-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-violet-400/30 bg-slate-900 shadow-2xl shadow-violet-950/50"
        onClick={(event) => event.stopPropagation()}
      >
        {attachmentUrl && !isPdf && (
          <img
            src={attachmentUrl}
            alt={gift.title}
            className="max-h-[70vh] w-full bg-slate-950/70 object-contain"
          />
        )}

        <div className="p-6 sm:p-8">
          <button
            type="button"
            aria-label="Cerrar detalle"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-950/80 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-violet-300">
            <GiftIcon className="h-4 w-4" />
            <span>{gift.category}</span>
            <span className="text-slate-600">·</span>
            <span>{gift.rarity}</span>
          </div>
          <h2 id="gift-modal-title" className="mb-2 text-2xl font-bold text-pink-800">
            {gift.title}
          </h2>
          <p className="mb-6 text-xs text-slate-500">{formatGiftDate(gift.created_at)}</p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {gift.description}
          </p>

          {gift.media_url && isPdf && attachmentUrl && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:border-violet-300/50 hover:bg-violet-500/20"
            >
              <FileText className="h-4 w-4" />
              Ver / Descargar PDF del Regalo
              <Download className="ml-auto h-4 w-4" />
            </a>
          )}
          {gift.media_url && !attachmentUrl && !attachmentError && (
            <p role="status" className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Cargando archivo...
            </p>
          )}
          {attachmentError && (
            <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No se pudo abrir el archivo. Inicia sesión y verifica los permisos de Storage.
            </p>
          )}

          <button
            type="button"
            onClick={celebrate}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/15 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300"
          >
            <Heart className="h-4 w-4" />
            Celebrar este recuerdo
          </button>
        </div>
      </section>
    </div>
  );
}
