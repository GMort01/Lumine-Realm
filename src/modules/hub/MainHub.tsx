import { Suspense, lazy, useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CalendarDays, Clock, Compass, Gamepad2, Gift as GiftIcon, Moon, Pencil, Settings2, Sparkles, Sun, Trash2, User, Users } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { ADMIN_EMAIL } from '../../config/roles';
import GiftModal from '../../components/ui/GiftModal';
import ContentAudienceFilter, { type ContentAudienceFilter as AudienceFilter } from '../../components/ui/ContentAudienceFilter';
import { giftsService } from '../../services/giftsService';
import type { Gift } from '../../services/giftsService';

const WorldMapHome = lazy(() => import('./WorldMapHome'));
const GachaWheel = lazy(() => import('../arcade/GachaWheel'));
const AdminPanel = lazy(() => import('../admin/AdminPanel'));
const UserProfile = lazy(() => import('./UserProfile'));
const TimelineView = lazy(() => import('./TimelineView'));
const RealmDirectory = lazy(() => import('./RealmDirectory'));
const GiftComposer = lazy(() => import('./GiftComposer'));
const CouponPrizeComposer = lazy(() => import('../arcade/CouponPrizeComposer'));

interface MainHubProps {
  gifts: Gift[];
  onGiftCreated: (gift: Gift) => void;
  onGiftUpdated: (gift: Gift) => void;
  onGiftDeleted: (giftId: string) => void;
}

type HubTab = 'home' | 'inventory' | 'arcade' | 'timeline' | 'community' | 'profile' | 'admin';
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  return window.localStorage.getItem('lumine-realm-theme') === 'light' ? 'light' : 'dark';
}

const rarityStyles: Record<string, string> = {
  legendary: 'border-amber-400/60 hover:border-amber-300 text-amber-300',
  epic: 'border-violet-400/60 hover:border-violet-300 text-violet-300',
  rare: 'border-sky-400/60 hover:border-sky-300 text-sky-300',
  common: 'border-slate-500/60 hover:border-slate-400 text-slate-300',
};

function formatGiftDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date);
}

export default function MainHub({ gifts, onGiftCreated, onGiftUpdated, onGiftDeleted }: MainHubProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('home');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [prizeCatalogVersion, setPrizeCatalogVersion] = useState(0);
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('realm');
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const visibleTab = activeTab === 'admin' && !isAdmin ? 'inventory' : activeTab;
  const visibleGifts = gifts.filter((gift) => (
    audienceFilter === 'relationship'
      ? gift.audience_scope === 'relationship'
      : gift.audience_scope !== 'relationship'
  ));

  async function handleDeleteGift(gift: Gift) {
    if (!window.confirm(`¿Eliminar "${gift.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await giftsService.deleteGift(gift.id);
      onGiftDeleted(gift.id);
    } catch (error) {
      console.error('Error al eliminar regalo:', error);
      window.alert(error instanceof Error ? `No se pudo eliminar: ${error.message}` : 'No se pudo eliminar el regalo.');
      return;
    }

    if (gift.media_url && !/^https?:\/\//i.test(gift.media_url)) {
      try {
        await giftsService.removeGiftAttachment(gift.media_url);
      } catch (storageError) {
        console.error('El regalo se eliminó, pero no se pudo borrar su archivo adjunto:', storageError);
        window.alert('El regalo se eliminó, pero no se pudo limpiar su archivo de Storage.');
      }
    }
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('lumine-realm-theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setAuthReady(true);
        if (session) setAuthError(null);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        throw error;
      }
      if (active) {
        setUser(data.session?.user ?? null);
        setAuthReady(true);
      }
    }).catch((error: unknown) => {
      console.error('Error al comprobar la sesión:', error);
      if (active) {
        setAuthError('No se pudo comprobar la sesión de Supabase.');
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setAuthError(null);
    setIsSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setAuthError('No se pudo cerrar la sesión. Inténtalo nuevamente.');
    } finally {
      setIsSigningOut(false);
    }
  }

  const localTime = new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(currentTime);

  const tabs: { id: HubTab; label: string; Icon: typeof GiftIcon }[] = [
    { id: 'home', label: 'Inicio', Icon: Compass },
    { id: 'inventory', label: 'Inventario', Icon: GiftIcon },
    { id: 'arcade', label: 'Minijuegos', Icon: Gamepad2 },
    { id: 'timeline', label: 'Línea del tiempo', Icon: CalendarDays },
    { id: 'community', label: 'Comunidad', Icon: Users },
    { id: 'profile', label: 'Perfil', Icon: User },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', Icon: Settings2 }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-slate-100 selection:bg-pink-500 selection:text-white">
      <header className="sticky top-0 z-30 flex w-full flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/90 px-5 py-4 shadow-lg shadow-black/10 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 p-2 shadow-lg shadow-pink-500/20">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider text-violet-300">
              LUMINE&apos;S REALM
            </h1>
            <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-violet-300">
              VERSION 1.0
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 font-mono text-xs text-slate-300">
            <Clock className="h-3.5 w-3.5 text-violet-400" />
            <span>Hora local</span>
            <time dateTime={currentTime.toISOString()}>{localTime}</time>
          </div>
          <button
            type="button"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-violet-400/40 hover:text-violet-200"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-violet-400" />}
            <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <nav
          aria-label="Navegación principal"
          className={`mx-auto grid w-full max-w-5xl grid-cols-2 gap-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5 shadow-xl shadow-black/10 sm:grid-cols-3 ${isAdmin ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}
        >
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={visibleTab === id ? 'page' : undefined}
              onClick={() => setActiveTab(id)}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold tracking-wide transition duration-200 sm:gap-2 sm:px-3 ${
                visibleTab === id
                  ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-md shadow-pink-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        {visibleTab === 'home' && (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm text-violet-200">Cargando mapa del Realm...</p>}>
            <WorldMapHome user={user} />
          </Suspense>
        )}

        {visibleTab === 'inventory' && (
          <section aria-labelledby="inventory-title" className="space-y-5">
            {user && !editingGift && (
              <Suspense fallback={<p role="status" className="text-center text-xs text-violet-200">Cargando formulario de regalos...</p>}>
                <GiftComposer user={user} onGiftCreated={onGiftCreated} />
              </Suspense>
            )}
            {user && editingGift && (
              <Suspense fallback={<p role="status" className="text-center text-xs text-violet-200">Cargando editor...</p>}>
                <GiftComposer
                  key={editingGift.id}
                  user={user}
                  gift={editingGift}
                  onGiftCreated={onGiftCreated}
                  onGiftUpdated={(gift) => {
                    onGiftUpdated(gift);
                    setEditingGift(null);
                  }}
                  onCancel={() => setEditingGift(null)}
                />
              </Suspense>
            )}
            <div className="flex items-center justify-between">
              <h2 id="inventory-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
                <GiftIcon className="h-4 w-4 text-pink-400" />
                Regalos y recuerdos
                <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">{visibleGifts.length}</span>
              </h2>
              <ContentAudienceFilter value={audienceFilter} onChange={setAudienceFilter} />
            </div>

            {visibleGifts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-12 text-center">
                <GiftIcon className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-400">Todavía no hay regalos en el inventario.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleGifts.map((item) => {
                  const rarityClass = rarityStyles[item.rarity.toLowerCase()] ?? 'border-slate-700 hover:border-pink-400/50 text-pink-300';
                  const canManageGift = Boolean(user && (isAdmin || item.created_by === user.id));

                  return (
                    <article
                      key={item.id}
                      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-slate-900/70 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-500/10 ${rarityClass}`}
                    >
                      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-pink-500/5 blur-2xl transition group-hover:bg-pink-500/10" />
                      <div className="relative">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className={`rounded-full border border-current/30 bg-slate-950/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest ${rarityClass.split(' ')[2]}`}>
                            {item.rarity}
                          </span>
                          <time dateTime={item.created_at} className="text-[10px] font-mono text-slate-500">
                            {formatGiftDate(item.created_at)}
                          </time>
                        </div>
                        <h3 className="mb-2 text-base font-bold text-pink-800 transition group-hover:text-pink-700">
                          {item.title}
                        </h3>
                        <p className="mb-5 text-xs leading-relaxed text-slate-400">
                          {item.description}
                        </p>
                      </div>
                      <div className="relative flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGift(item)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-pink-400/50 hover:bg-pink-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-400"
                      >
                        Abrir Detalle
                      </button>
                      {canManageGift && (
                        <>
                          <button type="button" aria-label={`Editar ${item.title}`} onClick={() => setEditingGift(item)} className="rounded-xl border border-slate-700 px-3 text-slate-300 hover:border-violet-400 hover:text-violet-200"><Pencil className="h-4 w-4" /></button>
                          <button type="button" aria-label={`Eliminar ${item.title}`} onClick={() => void handleDeleteGift(item)} className="rounded-xl border border-slate-700 px-3 text-slate-400 hover:border-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {visibleTab === 'arcade' && (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm text-violet-200">Cargando arcade...</p>}>
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Ruleta de premios</h2>
                <ContentAudienceFilter value={audienceFilter} onChange={setAudienceFilter} />
              </div>
              <GachaWheel key={prizeCatalogVersion} audienceFilter={audienceFilter} onOpenProfile={() => setActiveTab('profile')} />
              {user && (
                <Suspense fallback={<p role="status" className="text-center text-xs text-violet-200">Cargando formulario de premios...</p>}>
                  <CouponPrizeComposer
                    user={user}
                    isAdmin={isAdmin}
                    audienceFilter={audienceFilter}
                    refreshKey={prizeCatalogVersion}
                    onCatalogChanged={() => setPrizeCatalogVersion((value) => value + 1)}
                  />
                </Suspense>
              )}
            </div>
          </Suspense>
        )}

        {visibleTab === 'timeline' && (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm text-violet-200">Cargando línea del tiempo...</p>}>
            <TimelineView user={user} />
          </Suspense>
        )}

        {visibleTab === 'community' && (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm text-violet-200">Cargando comunidad...</p>}>
            <RealmDirectory user={user} />
          </Suspense>
        )}

        {visibleTab === 'profile' && (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm text-violet-200">Cargando perfil...</p>}>
            <UserProfile
              user={user}
              isAdmin={isAdmin}
              authReady={authReady}
              giftsUnlocked={gifts.filter((gift) => gift.is_unlocked).length}
              authError={authError}
              isSigningOut={isSigningOut}
              onSignOut={() => void handleSignOut()}
            />
          </Suspense>
        )}

        {visibleTab === 'admin' && isAdmin && (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm text-violet-200">Cargando administración...</p>}>
            <AdminPanel />
          </Suspense>
        )}
      </main>

      {selectedGift && (
        <GiftModal gift={selectedGift} onClose={() => setSelectedGift(null)} />
      )}
    </div>
  );
}
