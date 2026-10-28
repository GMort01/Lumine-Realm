import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Check,
  CircleHelp,
  Crown,
  Gift,
  LoaderCircle,
  RotateCw,
  Sparkles,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../config/supabase';
import { ADMIN_EMAIL } from '../../config/roles';
import { couponPrizesService } from '../../services/couponPrizesService';
import { couponsService } from '../../services/couponsService';
import { gachaService } from '../../services/gachaService';
import type { CouponPrize } from '../../services/couponPrizesService';
import type { Coupon } from '../../services/couponsService';

const prizeColors = ['#a98bb6', '#d89aaa', '#9aa8c3', '#cf8b85', '#d4b56d', '#8cb59d', '#82afbd', '#ba8aaa'];
const MAX_PRIZES = prizeColors.length;

interface GachaWheelProps {
  onOpenProfile: () => void;
}

export default function GachaWheel({ onOpenProfile }: GachaWheelProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<CouponPrize[]>([]);
  const [prizesLoading, setPrizesLoading] = useState(false);
  const [prizesError, setPrizesError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<CouponPrize | null>(null);
  const [wonCoupon, setWonCoupon] = useState<Coupon | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [deletingCouponId, setDeletingCouponId] = useState<string | null>(null);

  const wheelBackground = prizes.length
    ? `conic-gradient(${prizes.map((_, index) => {
      const segment = 360 / prizes.length;
      const start = index * segment;
      const end = (index + 1) * segment;
      return `#302445 ${start}deg ${start + 0.7}deg, ${prizeColors[index % prizeColors.length]} ${start + 0.7}deg ${end - 0.7}deg, #302445 ${end - 0.7}deg ${end}deg`;
    }).join(', ')})`
    : 'conic-gradient(#ded0e6, #f3cfd5, #ded0e6)';

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUserId(session?.user.id ?? null);
        setIsAdmin(session?.user.email?.toLowerCase() === ADMIN_EMAIL);
        setAuthReady(true);
        setAuthError(null);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        throw error;
      }
      if (active) {
        setUserId(data.session?.user.id ?? null);
        setIsAdmin(data.session?.user.email?.toLowerCase() === ADMIN_EMAIL);
        setAuthReady(true);
      }
    }).catch((error: unknown) => {
      console.error('Error al comprobar la sesión:', error);
      if (active) {
        setAuthError('No se pudo comprobar tu sesión. Inténtalo de nuevo.');
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setCoupons([]);
      setPrizes([]);
      return;
    }

    let active = true;
    setCouponsLoading(true);
    setPrizesLoading(true);
    setCouponError(null);
    setPrizesError(null);

    void couponsService.getMyCoupons()
      .then((items) => {
        if (active) setCoupons(items);
      })
      .catch((error: unknown) => {
        console.error('Error al cargar los cupones:', error);
        if (active) setCouponError('No se pudieron cargar tus cupones. Comprueba la configuración de Supabase.');
      })
      .finally(() => {
        if (active) setCouponsLoading(false);
      });

    void couponPrizesService.getActivePrizes()
      .then((items) => {
        if (active) setPrizes(items);
      })
      .catch((error: unknown) => {
        console.error('Error al cargar los premios de la ruleta:', error);
        if (active) setPrizesError('No se pudo cargar el catálogo. Aplica la migración de premios de la ruleta en Supabase.');
      })
      .finally(() => {
        if (active) setPrizesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  async function spinWheel() {
    if (isSpinning || prizes.length === 0 || prizes.length > MAX_PRIZES) {
      return;
    }

    setSpinError(null);
    setWonPrize(null);
    setWonCoupon(null);
    setIsSpinning(true);

    try {
      const result = await gachaService.spin();
      if (result.prizes.length < 2 || result.prizes.length > MAX_PRIZES) {
        throw new Error('El catálogo del servidor no coincide con los espacios de la ruleta.');
      }

      const prizeIndex = result.prizes.findIndex((prize) => prize.id === result.prize.id);
      if (prizeIndex < 0) {
        throw new Error('El premio ganador no forma parte del catálogo devuelto por el servidor.');
      }

      setPrizes(result.prizes);
      setWonPrize(result.prize);
      setWonCoupon(result.coupon);
      setCoupons((currentCoupons) => [result.coupon, ...currentCoupons]);

      const segment = 360 / result.prizes.length;
      const targetRotation = (360 - (prizeIndex * segment + segment / 2)) % 360;
      const currentRotation = ((rotation % 360) + 360) % 360;
      const remainingRotation = (targetRotation - currentRotation + 360) % 360;
      setRotation((currentRotationTotal) => currentRotationTotal + (360 * 6) + remainingRotation);
    } catch (error) {
      console.error('Error al girar la ruleta en el servidor:', error);
      setIsSpinning(false);
      setSpinError('No se pudo girar la ruleta. Comprueba que la función de Supabase esté desplegada y vuelve a intentarlo.');
    }
  }

  function handleSpinComplete() {
    if (!isSpinning) return;
    setIsSpinning(false);
    confetti({
      particleCount: 140,
      spread: 85,
      origin: { y: 0.62 },
      colors: ['#9274a1', '#bd758a', '#ad8c4c', '#ffffff'],
    });
  }

  async function removeCoupon(coupon: Coupon) {
    if (deletingCouponId) return;
    if (!window.confirm(`¿Eliminar "${coupon.title}" de tus cupones? Esta acción no se puede deshacer.`)) return;

    setDeletingCouponId(coupon.id);
    setCouponError(null);
    try {
      await couponsService.deleteMyCoupon(coupon.id);
      setCoupons((current) => current.filter((item) => item.id !== coupon.id));
    } catch (error) {
      console.error('Error al eliminar el cupón:', error);
      setCouponError('No se pudo eliminar el cupón. Inténtalo de nuevo.');
    } finally {
      setDeletingCouponId(null);
    }
  }

  if (!authReady) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-sm text-violet-200">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Comprobando sesión...
      </div>
    );
  }

  if (!userId) {
    return (
      <section className="relative mx-auto flex min-h-72 w-full max-w-3xl flex-col items-center justify-center overflow-hidden rounded-3xl border border-violet-500/20 bg-slate-900/70 px-6 py-10 text-center shadow-xl shadow-violet-950/10 sm:px-10">
        <div className="pointer-events-none absolute inset-x-1/4 top-0 h-40 rounded-full bg-gradient-to-r from-violet-600/20 via-pink-500/20 to-amber-400/15 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
            <Ticket className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">La ruleta te espera</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">Inicia sesión desde tu perfil para jugar y guardar tus cupones.</p>
          {authError && <p role="alert" className="mt-3 text-xs text-red-300">{authError}</p>}
          <button type="button" onClick={onOpenProfile} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/15 transition hover:brightness-110">
            Ir a iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  const canSpin = !prizesLoading && prizes.length >= 2 && prizes.length <= MAX_PRIZES && !prizesError;

  return (
    <section aria-labelledby="gacha-title" className="space-y-7">
      <header className="relative overflow-hidden rounded-3xl border border-violet-300/50 bg-gradient-to-r from-violet-100 via-slate-900 to-pink-100 px-6 py-7 shadow-xl shadow-violet-900/5 sm:px-8">
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Una sorpresa te espera
            </p>
            <h2 id="gacha-title" className="text-2xl font-extrabold text-slate-100 sm:text-3xl">Ruleta de la Fortuna</h2>
            <p className="mt-2 text-sm text-slate-400">Gira, descubre un premio y guárdalo en tu colección.</p>
          </div>
          {isAdmin && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200">
              <Crown className="h-3.5 w-3.5" />
              Game Master
            </span>
          )}
        </div>
      </header>

      {!isAdmin && prizesError && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{prizesError}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="relative flex min-h-[480px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-violet-400/15 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.12),transparent_58%),linear-gradient(145deg,#111827,#0b0f19_62%)] px-5 py-8 shadow-lg shadow-violet-950/20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(196,181,253,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
          {prizesLoading ? (
            <p role="status" className="relative flex items-center gap-2 text-sm text-violet-200"><LoaderCircle className="h-4 w-4 animate-spin" />Preparando premios...</p>
          ) : prizes.length === 0 ? (
            <div className="relative max-w-sm text-center">
              <CircleHelp className="mx-auto mb-3 h-9 w-9 text-violet-300" />
              <p className="font-semibold text-slate-100">La ruleta aún no tiene premios</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{isAdmin ? 'Añade premios arriba para preparar la ruleta.' : 'El Game Master todavía está preparando sorpresas.'}</p>
            </div>
          ) : prizes.length > MAX_PRIZES ? (
            <p role="alert" className="relative max-w-sm text-center text-sm text-amber-200">El catálogo supera los {MAX_PRIZES} espacios que caben en la ruleta. Pide al administrador que retire algunos premios.</p>
          ) : (
            <>
              <div className="relative z-10 grid w-full items-center gap-6 lg:grid-cols-[minmax(0,1fr)_190px]">
                <div className="flex min-w-0 flex-col items-center">
                  <div className="relative mb-5 mt-4 h-72 w-72 shrink-0 sm:h-80 sm:w-80">
                <div className="pointer-events-none absolute -inset-3 rounded-full border border-violet-200/10 shadow-[0_0_60px_rgba(168,85,247,0.2)]" />
                <div className="pointer-events-none absolute inset-0 rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.65)_0deg_1deg,transparent_1deg_15deg)] opacity-30 [mask-image:radial-gradient(circle,transparent_68%,black_70%,black_73%,transparent_75%)]" />
                <div className="absolute -top-5 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center drop-shadow-[0_3px_8px_rgba(251,191,36,0.65)]" aria-hidden="true">
                  <span className="h-4 w-8 rounded-t-full border border-amber-100/80 bg-gradient-to-b from-amber-100 to-amber-400" />
                  <span className="-mt-0.5 h-0 w-0 border-x-[13px] border-t-[24px] border-x-transparent border-t-amber-300" />
                  <span className="-mt-1 h-2.5 w-2.5 rounded-full border-2 border-amber-100 bg-amber-400" />
                </div>
                <div
                  className="relative h-full w-full rounded-full border-[9px] border-[#302445] shadow-[inset_0_0_22px_rgba(15,23,42,0.72),0_0_0_2px_rgba(251,191,36,0.35),0_18px_48px_rgba(0,0,0,0.55)]"
                  style={{
                    background: wheelBackground,
                    transform: `rotate(${rotation}deg)`,
                    transition: isSpinning ? 'transform 6.8s cubic-bezier(0.08, 0.78, 0.12, 1)' : 'none',
                  }}
                  onTransitionEnd={(event) => {
                    if (event.propertyName === 'transform') handleSpinComplete();
                  }}
                >
                  {prizes.map((prize, index) => {
                    const segment = 360 / prizes.length;
                    const angle = index * segment + segment / 2;
                    const radians = (angle * Math.PI) / 180;
                    const radius = 32;
                    return (
                      <span
                        key={prize.id}
                        className="pointer-events-none absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/90 text-xs font-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.7)] [text-shadow:0_1px_2px_rgba(0,0,0,1)]"
                        style={{
                          left: `${50 + Math.sin(radians) * radius}%`,
                          top: `${50 - Math.cos(radians) * radius}%`,
                          backgroundColor: prizeColors[index % prizeColors.length],
                        }}
                        title={prize.title}
                      >
                        {index + 1}
                      </span>
                    );
                  })}
                  <div className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-[#302445] bg-gradient-to-br from-amber-200 via-pink-200 to-violet-300 shadow-[0_0_25px_rgba(255,255,255,0.35)]">
                    <Gift className="h-6 w-6 text-violet-900" />
                  </div>
                </div>
              </div>
                  <button
                    type="button"
                    disabled={!canSpin || isSpinning}
                    onClick={() => void spinWheel()}
                    className="inline-flex min-w-52 items-center justify-center gap-2 rounded-xl border border-pink-200/20 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_28px_rgba(217,70,239,0.28)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-wait disabled:opacity-55"
                  >
                    <RotateCw className={`h-4 w-4 ${isSpinning ? 'animate-spin' : ''}`} />
                    {isSpinning ? 'Girando...' : 'Girar Ruleta'}
                  </button>
                  <p className="mt-3 text-center text-xs text-slate-400">El premio se selecciona y se guarda de forma segura en el servidor.</p>
                  {spinError && <p role="alert" className="mt-3 max-w-sm text-center text-xs text-red-300">{spinError}</p>}
                </div>

                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                  {prizes.map((prize, index) => (
                    <div key={prize.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-2.5 py-2 backdrop-blur-sm">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 text-xs font-black text-white shadow-inner"
                        style={{ backgroundColor: prizeColors[index % prizeColors.length] }}
                      >
                        {index + 1}
                      </span>
                      <span className="line-clamp-2 min-w-0 break-words text-left text-[11px] font-medium leading-tight text-slate-200" title={prize.title}>{prize.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-black/10 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-100"><Ticket className="h-4 w-4 text-pink-300" />Mis cupones</h3>
              <p className="mt-1 text-[10px] text-slate-500">Tu colección personal de premios.</p>
            </div>
            <span className="rounded-full border border-violet-400/15 bg-violet-400/10 px-2.5 py-1 font-mono text-xs text-violet-200">{coupons.length}</span>
          </div>

          {couponsLoading && <p role="status" className="flex items-center gap-2 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando...</p>}
          {couponError && <p role="alert" className="mb-3 text-xs text-red-300">{couponError}</p>}
          {!couponsLoading && !couponError && coupons.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-9 text-center">
              <Ticket className="mx-auto mb-3 h-7 w-7 text-slate-600" />
              <p className="text-xs leading-relaxed text-slate-500">Todavía no tienes cupones guardados. ¡Gira la ruleta para ganar uno!</p>
            </div>
          )}
          <ul className="space-y-3">
            {coupons.map((coupon, index) => (
              <li key={coupon.id} className="group relative overflow-hidden rounded-2xl border border-violet-400/15 bg-gradient-to-r from-slate-950/90 to-violet-950/30 p-4">
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-pink-400 to-violet-500" />
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-300/15 bg-pink-400/10 text-pink-200">
                    <Ticket className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-pink-800">{coupon.title}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${
                        coupon.status === 'redeemed' || coupon.is_redeemed
                          ? 'bg-slate-800 text-slate-500'
                          : coupon.status === 'requested'
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-emerald-500/10 text-emerald-300'
                      }`}>
                        {coupon.status === 'redeemed' || coupon.is_redeemed ? 'Canjeado' : coupon.status === 'requested' ? 'Solicitado' : 'Disponible'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{coupon.description}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar mi cupón ${coupon.title}`}
                    title="Eliminar de mis cupones"
                    disabled={deletingCouponId !== null}
                    onClick={() => void removeCoupon(coupon)}
                    className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-wait disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    {deletingCouponId === coupon.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
                <span className="absolute bottom-1 right-3 font-mono text-[8px] tracking-widest text-slate-700">REWARD #{String(coupons.length - index).padStart(3, '0')}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {wonPrize && !isSpinning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-md" onClick={() => setWonPrize(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="won-coupon-title" className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/30 bg-slate-900 p-7 text-center shadow-2xl shadow-violet-950/50" onClick={(event) => event.stopPropagation()}>
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-violet-600/20 via-pink-500/20 to-amber-400/15 blur-2xl" />
            <button type="button" aria-label="Cerrar" onClick={() => setWonPrize(null)} className="absolute right-4 top-4 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><X className="h-4 w-4" /></button>
            <div className="relative">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300 shadow-lg shadow-amber-500/10"><Gift className="h-8 w-8" /></div>
              <p className="mb-2 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300"><Sparkles className="h-3.5 w-3.5" />¡Premio obtenido!</p>
              <h3 id="won-coupon-title" className="text-2xl font-extrabold text-pink-800">{wonPrize.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{wonPrize.description}</p>
              <p role="status" className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                Cupón guardado automáticamente en tu colección
              </p>
              {wonCoupon && <p className="mt-2 font-mono text-[10px] text-slate-500">Cupón #{wonCoupon.id.slice(0, 8).toUpperCase()}</p>}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
