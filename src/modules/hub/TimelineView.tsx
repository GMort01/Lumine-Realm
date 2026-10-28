import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock3, Heart, LoaderCircle, Sparkles } from 'lucide-react';
import { timelineService } from '../../services/timelineService';
import type { TimelineEvent } from '../../services/timelineService';

interface CountdownTarget {
  event: TimelineEvent;
  date: Date;
}

function localDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getCountdownTarget(events: TimelineEvent[], now: Date): CountdownTarget | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidates = events.flatMap((event) => {
    const eventDate = localDate(event.event_date);
    if (event.is_anniversary) {
      const month = eventDate.getMonth();
      const day = eventDate.getDate();
      let next = new Date(now.getFullYear(), month, day);
      if (next.getTime() < today.getTime()) next = new Date(now.getFullYear() + 1, month, day);
      return [{ event, date: next }];
    }
    return eventDate.getTime() >= today.getTime() ? [{ event, date: eventDate }] : [];
  });

  return candidates.sort((left, right) => left.date.getTime() - right.date.getTime())[0] ?? null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(localDate(value));
}

function Countdown({ target, now }: { target: CountdownTarget; now: Date }) {
  const remaining = Math.max(0, target.date.getTime() - now.getTime());
  const secondsTotal = Math.floor(remaining / 1000);
  const units = [
    { label: 'Días', value: Math.floor(secondsTotal / 86_400) },
    { label: 'Horas', value: Math.floor((secondsTotal % 86_400) / 3_600) },
    { label: 'Minutos', value: Math.floor((secondsTotal % 3_600) / 60) },
    { label: 'Segundos', value: secondsTotal % 60 },
  ];

  return (
    <article className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-slate-900 via-violet-950/60 to-slate-900 p-6 shadow-xl shadow-violet-950/20 sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl" />
      <div className="relative">
        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-pink-300">
          <Heart className="h-3.5 w-3.5" /> Próximo momento especial
        </p>
        <h2 className="text-xl font-extrabold text-white sm:text-2xl">{target.event.title}</h2>
        <p className="mt-1 text-xs text-slate-400">{target.event.is_anniversary ? 'Aniversario' : 'Evento especial'} · {formatDate(target.event.event_date)}</p>
        <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-4">
          {units.map((unit) => (
            <div key={unit.label} className="rounded-2xl border border-white/10 bg-slate-950/50 px-2 py-4 text-center backdrop-blur-md sm:px-4">
              <p className="font-mono text-2xl font-black tabular-nums text-white sm:text-4xl">{String(unit.value).padStart(2, '0')}</p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400 sm:text-[10px]">{unit.label}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function TimelineView() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let active = true;
    void timelineService.getEvents()
      .then((items) => {
        if (active) {
          setEvents(items);
          setErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        console.error('Error al cargar la línea del tiempo:', error);
        if (active) setErrorMessage('No se pudo cargar la línea del tiempo. Comprueba que la migración esté aplicada.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const countdownTarget = useMemo(() => getCountdownTarget(events, now), [events, now]);

  return (
    <section aria-labelledby="timeline-title" className="mx-auto w-full max-w-5xl space-y-7">
      <header className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-r from-violet-950/70 via-slate-900 to-pink-950/50 px-6 py-7 shadow-xl shadow-violet-950/10 sm:px-8">
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300">
            <Sparkles className="h-3.5 w-3.5" /> Momentos que nos unen
          </p>
          <h1 id="timeline-title" className="text-2xl font-extrabold text-white sm:text-3xl">Línea del tiempo</h1>
          <p className="mt-2 text-sm text-slate-400">Recuerdos compartidos y fechas que esperamos con ilusión.</p>
        </div>
      </header>

      {countdownTarget ? (
        <Countdown target={countdownTarget} now={now} />
      ) : (
        <article className="rounded-3xl border border-violet-400/15 bg-slate-900/70 p-6 text-center">
          <CalendarDays className="mx-auto mb-3 h-7 w-7 text-violet-300" />
          <h2 className="font-bold text-slate-100">Aún no hay una fecha especial</h2>
          <p className="mt-1 text-sm text-slate-400">El administrador puede añadir un aniversario o evento futuro desde Admin.</p>
        </article>
      )}

      <section aria-labelledby="timeline-events-title">
        <div className="mb-5 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-pink-300" />
          <h2 id="timeline-events-title" className="text-sm font-bold uppercase tracking-wider text-slate-200">Nuestros hitos</h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">{events.length}</span>
        </div>

        {isLoading && <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-violet-200"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando recuerdos...</p>}
        {errorMessage && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{errorMessage}</p>}
        {!isLoading && !errorMessage && events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-5 py-10 text-center text-sm text-slate-400">
            Aún no hay recuerdos en la línea del tiempo.
          </div>
        )}

        <ol className="relative space-y-5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-gradient-to-b before:from-violet-400/60 before:via-pink-400/30 before:to-transparent sm:before:left-[19px]">
          {events.map((event, index) => (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.25) }}
              className="relative pl-10 sm:pl-12"
            >
              <span className="absolute left-[10px] top-5 h-3 w-3 rounded-full border-2 border-violet-200 bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.65)] sm:left-[14px]" />
              <article className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-lg shadow-black/10 backdrop-blur-md">
                {event.image_url && <img src={event.image_url} alt={event.title} className="max-h-80 w-full object-cover" loading="lazy" />}
                <div className="p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <time dateTime={event.event_date} className="font-mono text-[10px] uppercase tracking-wider text-violet-300">{formatDate(event.event_date)}</time>
                    {event.is_anniversary && <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">Aniversario anual</span>}
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">{event.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{event.description}</p>
                </div>
              </article>
            </motion.li>
          ))}
        </ol>
      </section>
    </section>
  );
}
