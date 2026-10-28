import { Shield } from 'lucide-react';
import RealmMembersAdmin from './RealmMembersAdmin';

export default function AdminPanel() {
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
            <p className="mt-1 text-sm text-slate-400">Gestiona el acceso de las personas y el estado general del Realm.</p>
          </div>
        </div>
      </header>

      <RealmMembersAdmin />
    </section>
  );
}
