import { useEffect, useState, type FormEvent } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Award, CalendarDays, Check, Crown, Gift, Heart, LoaderCircle, LogIn, LogOut, MapPin, Pencil, Save, Ticket, User, UserPlus, X } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { couponsService } from '../../services/couponsService';
import type { Coupon } from '../../services/couponsService';
import { profilesService } from '../../services/profilesService';
import type { PlayerProfile } from '../../services/profilesService';

type AuthMode = 'login' | 'signup';

interface UserProfileProps {
  user: SupabaseUser | null;
  isAdmin: boolean;
  authReady: boolean;
  giftsUnlocked: number;
  authError: string | null;
  isSigningOut: boolean;
  onSignOut: () => void;
}

function daysInRealm(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return 1;
  }
  return Math.max(1, Math.floor((Date.now() - created.getTime()) / 86_400_000) + 1);
}

export default function UserProfile({
  user,
  isAdmin,
  authReady,
  giftsUnlocked,
  authError,
  isSigningOut,
  onSignOut,
}: UserProfileProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [requestedCoupons, setRequestedCoupons] = useState<Coupon[]>([]);
  const [adminCouponsLoading, setAdminCouponsLoading] = useState(false);
  const [adminCouponError, setAdminCouponError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCoupons([]);
      setCouponError(null);
      setCouponsLoading(false);
      return;
    }

    let active = true;
    setCouponsLoading(true);
    setCouponError(null);

    void couponsService.getMyCoupons()
      .then((items) => {
        if (active) {
          setCoupons(items);
        }
      })
      .catch((error: unknown) => {
        console.error('Error al cargar los cupones del perfil:', error);
        if (active) {
          setCouponError('No se pudieron cargar tus cupones. Comprueba la configuración de Supabase.');
        }
      })
      .finally(() => {
        if (active) {
          setCouponsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setRequestedCoupons([]);
      return;
    }

    let active = true;
    setProfileLoading(true);
    setProfileError(null);
    void profilesService.getMyProfile(user.id)
      .then((result) => {
        if (active) {
          setProfile(result);
          setEditUsername(result?.username ?? (typeof user.user_metadata.nickname === 'string' ? user.user_metadata.nickname : ''));
          setEditCountry(result?.country ?? (typeof user.user_metadata.country === 'string' ? user.user_metadata.country : ''));
          setEditAvatarUrl(result?.avatar_url ?? (typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : ''));
        }
      })
      .catch((error: unknown) => {
        console.error('Error al cargar el perfil desde Supabase:', error);
        if (active) {
          setProfileError('No se pudieron cargar los datos editables del perfil.');
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !isAdmin) {
      setRequestedCoupons([]);
      return;
    }

    let active = true;
    setAdminCouponsLoading(true);
    setAdminCouponError(null);
    void couponsService.getRequestedCouponsForAdmin()
      .then((items) => {
        if (active) setRequestedCoupons(items);
      })
      .catch((error: unknown) => {
        console.error('Error al cargar solicitudes de canje:', error);
        if (active) setAdminCouponError('No se pudieron cargar las solicitudes de canje.');
      })
      .finally(() => {
        if (active) setAdminCouponsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, isAdmin]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setAuthMessage(null);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: nickname.trim(),
              nickname: nickname.trim(),
              country,
              avatar_url: avatarUrl.trim(),
            },
          },
        });
        if (error) {
          throw error;
        }
        if (!data.session) {
          setAuthMessage('Revisa tu correo para confirmar tu cuenta y luego inicia sesión.');
        }
      }
    } catch (error) {
      console.error('Error de autenticación desde el perfil:', error);
      setFormError(authMode === 'login'
        ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.'
        : 'No se pudo crear la cuenta. Verifica los datos e inténtalo de nuevo.');
    }
  }

  async function handleRequestRedemption(couponId: string) {
    if (redeemingId) {
      return;
    }
    setRedeemingId(couponId);
    setCouponError(null);

    try {
      const updatedCoupon = await couponsService.requestRedemption(couponId);
      setCoupons((current) => current.map((coupon) => coupon.id === updatedCoupon.id ? updatedCoupon : coupon));
    } catch (error) {
      console.error('Error al solicitar canje del cupón:', error);
      setCouponError('No se pudo solicitar el canje. Puede que ya se haya solicitado.');
    } finally {
      setRedeemingId(null);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || isSavingProfile) return;

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const updatedProfile = await profilesService.updateMyProfile(user.id, {
        username: editUsername,
        country: editCountry,
        avatar_url: editAvatarUrl,
      });
      setProfile(updatedProfile);
      setIsEditingProfile(false);
      setProfileMessage('Perfil actualizado correctamente.');
    } catch (error) {
      console.error('Error al guardar el perfil:', error);
      setProfileError('No se pudo guardar el perfil. Verifica los permisos de la tabla profiles.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleApproveRedemption(couponId: string) {
    if (approvingId) return;
    setApprovingId(couponId);
    setAdminCouponError(null);
    try {
      const updatedCoupon = await couponsService.approveRedemption(couponId);
      setRequestedCoupons((current) => current.filter((coupon) => coupon.id !== updatedCoupon.id));
      setCoupons((current) => current.map((coupon) => coupon.id === updatedCoupon.id ? updatedCoupon : coupon));
    } catch (error) {
      console.error('Error al aprobar el canje:', error);
      setAdminCouponError('No se pudo aprobar el canje. Actualiza la lista e inténtalo otra vez.');
    } finally {
      setApprovingId(null);
    }
  }

  if (!authReady) {
    return (
      <section role="status" className="mx-auto flex min-h-80 w-full max-w-3xl items-center justify-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 text-sm text-violet-200">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        Cargando el perfil del jugador...
      </section>
    );
  }

  if (!user) {
    return (
      <section aria-labelledby="profile-login-title" className="relative mx-auto w-full max-w-lg overflow-hidden rounded-3xl border border-violet-400/20 bg-slate-900/90 p-6 shadow-2xl shadow-violet-950/30 sm:p-9">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-violet-600/30 via-pink-500/25 to-amber-400/20 blur-2xl" />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-500/20 to-pink-500/20 text-violet-200 shadow-lg shadow-violet-500/10">
            {authMode === 'login' ? <LogIn className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}
          </div>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.25em] text-pink-300">Lumine&apos;s Realm</p>
          <h2 id="profile-login-title" className="mt-2 text-center text-2xl font-extrabold text-slate-100">
            {authMode === 'login' ? 'Tu aventura te espera' : 'Únete al Realm'}
          </h2>
          <p className="mb-7 mt-2 text-center text-sm text-slate-400">
            {authMode === 'login' ? 'Inicia sesión para ver tu perfil y tus recuerdos.' : 'Crea una cuenta para guardar tus cupones y recuerdos.'}
          </p>

          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <>
                <div>
                  <label htmlFor="profile-nickname" className="mb-1.5 block text-xs font-medium text-slate-300">Nombre de usuario / Apodo</label>
                  <input
                    id="profile-nickname"
                    type="text"
                    autoComplete="nickname"
                    maxLength={40}
                    required
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15"
                    placeholder="Ej. Alex"
                  />
                </div>
                <div>
                  <label htmlFor="profile-country" className="mb-1.5 block text-xs font-medium text-slate-300">País / Ubicación</label>
                  <input
                    id="profile-country"
                    type="text"
                    autoComplete="country-name"
                    maxLength={80}
                    required
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    placeholder="Ej. Perú 🇵🇪, Colombia 🇨🇴"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15"
                  />
                </div>
                <div>
                  <label htmlFor="profile-avatar" className="mb-1.5 block text-xs font-medium text-slate-300">URL de Avatar <span className="text-slate-500">(opcional)</span></label>
                  <input
                    id="profile-avatar"
                    type="url"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15"
                    placeholder="https://ejemplo.com/avatar.jpg"
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="profile-email" className="mb-1.5 block text-xs font-medium text-slate-300">Correo electrónico</label>
              <input
                id="profile-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15"
                placeholder="tu@correo.com"
              />
            </div>
            <div>
              <label htmlFor="profile-password" className="mb-1.5 block text-xs font-medium text-slate-300">Contraseña</label>
              <input
                id="profile-password"
                type="password"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15"
                placeholder="Al menos 6 caracteres"
              />
            </div>
            {formError && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{formError}</p>}
            {authMessage && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{authMessage}</p>}
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/15 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300">
              {authMode === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login');
              setFormError(null);
              setAuthMessage(null);
            }}
            className="mt-5 w-full text-center text-xs text-slate-400 transition hover:text-pink-300"
          >
            {authMode === 'login' ? '¿Aún no tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </section>
    );
  }

  const unlockedCoupons = coupons.filter((coupon) => coupon.status === 'available' && !coupon.is_redeemed).length;
  const redeemedCoupons = coupons.filter((coupon) => coupon.status === 'redeemed' || coupon.is_redeemed).length;
  const profileName = isAdmin
    ? 'Manuel • Game Master'
    : (profile?.username?.trim() && profile.username.trim() !== 'Jugador')
      ? profile.username.trim()
      : (typeof user.user_metadata.nickname === 'string' && user.user_metadata.nickname.trim())
        ? user.user_metadata.nickname.trim()
        : 'Aventurero/a';
  const location = isAdmin
    ? 'Colombia 🇨🇴'
    : (profile?.country?.trim() || (typeof user.user_metadata.country === 'string' && user.user_metadata.country.trim()))
      ? (profile?.country?.trim() || user.user_metadata.country as string)
      : 'Ubicación no configurada';
  const rank = isAdmin ? 'Admin / Creador del Realm' : 'Miembro del Realm';
  const profileAvatar = profile?.avatar_url || (typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : '');

  return (
    <section aria-labelledby="profile-title" className="mx-auto w-full max-w-5xl space-y-6">
      <article className="relative overflow-hidden rounded-3xl border border-realm-border/80 bg-card shadow-2xl shadow-black/25">
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-r from-violet-900/80 via-fuchsia-900/55 to-amber-800/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.2),transparent_45%)]" />
        <div className="relative flex flex-col items-center gap-5 px-6 pb-7 pt-10 text-center sm:flex-row sm:items-end sm:px-9 sm:text-left">
          <div className="relative shrink-0">
            <div className={`flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 bg-slate-950 shadow-xl ${isAdmin ? 'border-amber-400' : 'border-pink-400'}`}>
              {profileAvatar ? (
                <img src={profileAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className={`h-12 w-12 ${isAdmin ? 'text-amber-300' : 'text-pink-300'}`} />
              )}
            </div>
            <span className={`absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold shadow-lg ${isAdmin ? 'border-amber-300/40 bg-amber-300 text-[#332f2d]' : 'border-pink-300/40 bg-pink-500 text-pink-950'}`}>
              {isAdmin ? <Crown className="h-3 w-3" /> : <Heart className="h-3 w-3" />}
              {isAdmin ? 'Game Master 👑' : 'En Línea ✨'}
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70">Ficha del aventurero</p>
            <h2 id="profile-title" className="mt-1 text-2xl font-extrabold text-white drop-shadow sm:text-3xl">{profileName}</h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/85 sm:justify-start">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{location}</span>
              <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-amber-200" />{rank}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditUsername(profile?.username ?? (typeof user.user_metadata.nickname === 'string' ? user.user_metadata.nickname : ''));
                setEditCountry(profile?.country ?? (typeof user.user_metadata.country === 'string' ? user.user_metadata.country : ''));
                setEditAvatarUrl(profile?.avatar_url ?? (typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : ''));
                setProfileError(null);
                setProfileMessage(null);
                setIsEditingProfile(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-slate-950/35 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur transition hover:border-violet-200/50 hover:bg-slate-950/60"
            >
              <Pencil className="h-4 w-4" />
              Editar perfil
            </button>
            <button
              type="button"
              disabled={isSigningOut}
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-slate-950/35 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur transition hover:border-pink-200/50 hover:bg-slate-950/60 disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Cerrando...' : 'Cerrar Sesión'}
            </button>
          </div>
        </div>
        <div className="relative border-t border-white/10 bg-slate-950/35 px-6 py-3 text-center text-xs text-slate-300 sm:px-9 sm:text-left">
          {user.email ?? 'Correo no disponible'}
        </div>
      </article>

      {authError && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{authError}</p>}
      {profileError && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{profileError}</p>}
      {profileMessage && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{profileMessage}</p>}
      {profileLoading && <p role="status" className="text-xs text-slate-400">Sincronizando perfil...</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-pink-400/15 bg-gradient-to-br from-pink-950/35 to-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Regalos desbloqueados</span>
            <Gift className="h-4 w-4 text-pink-300" />
          </div>
          <p className="text-3xl font-extrabold text-pink-800">{giftsUnlocked}</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">Recuerdos disponibles</p>
        </article>
        <article className="rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-950/35 to-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cupones ganados</span>
            <Ticket className="h-4 w-4 text-violet-300" />
          </div>
          <p className="text-3xl font-extrabold text-violet-800">{coupons.length}</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{unlockedCoupons} disponibles · {redeemedCoupons} canjeados</p>
        </article>
        <article className="rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-950/30 to-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Días en el Realm</span>
            <CalendarDays className="h-4 w-4 text-amber-300" />
          </div>
          <p className="text-3xl font-extrabold text-amber-800">{daysInRealm(user.created_at)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">La aventura continúa</p>
        </article>
      </div>

      <section aria-labelledby="profile-coupons-title" className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="profile-coupons-title" className="flex items-center gap-2 text-lg font-bold text-slate-100">
              <Ticket className="h-5 w-5 text-pink-300" />
              Mis cupones
            </h3>
            <p className="mt-1 text-xs text-slate-500">Premios obtenidos en la Ruleta Gacha.</p>
          </div>
          <span className="rounded-full border border-pink-400/15 bg-pink-400/10 px-3 py-1 font-mono text-xs text-pink-200">{coupons.length}</span>
        </div>

        {couponsLoading && <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando cupones...</p>}
        {couponError && <p role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{couponError}</p>}
        {!couponsLoading && coupons.length === 0 && !couponError && (
          <p className="rounded-2xl border border-dashed border-slate-700 px-5 py-9 text-center text-sm text-slate-500">Todavía no tienes cupones guardados. ¡Prueba tu suerte en la Ruleta Gacha!</p>
        )}
        <ul className="grid gap-3 md:grid-cols-2">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-violet-400/15 bg-slate-950/50 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-pink-800">{coupon.title}</h4>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    coupon.status === 'redeemed' || coupon.is_redeemed
                      ? 'bg-slate-800 text-slate-500'
                      : coupon.status === 'requested'
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-emerald-500/10 text-emerald-300'
                  }`}>
                    {coupon.status === 'redeemed' || coupon.is_redeemed ? 'Canjeado' : coupon.status === 'requested' ? 'Solicitado' : coupon.expires_at && new Date(coupon.expires_at) < new Date() ? 'Vencido' : 'Disponible'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{coupon.description}</p>
              </div>
              {coupon.status === 'redeemed' || coupon.is_redeemed ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                  <Check className="h-3.5 w-3.5" />
                  {coupon.redeemed_at ? new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(coupon.redeemed_at)) : 'Canjeado'}
                </span>
              ) : coupon.status === 'requested' ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-amber-300">
                  <LoaderCircle className="h-3.5 w-3.5" />
                  Esperando aprobación
                </span>
              ) : coupon.expires_at && new Date(coupon.expires_at) < new Date() ? (
                <span className="shrink-0 text-xs text-slate-500">Cupón vencido</span>
              ) : (
                <button
                  type="button"
                  disabled={redeemingId !== null}
                  onClick={() => void handleRequestRedemption(coupon.id)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-pink-400/20 bg-pink-500/10 px-3 py-2 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/20 disabled:cursor-wait disabled:opacity-60"
                >
                  {redeemingId === coupon.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
                  Solicitar Canje
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && (
        <section aria-labelledby="admin-redemptions-title" className="rounded-3xl border border-amber-300/15 bg-slate-900/70 p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 id="admin-redemptions-title" className="flex items-center gap-2 text-lg font-bold text-slate-100">
                <Crown className="h-5 w-5 text-amber-300" />
                Solicitudes de canje
              </h3>
              <p className="mt-1 text-xs text-slate-500">Revisa y aprueba los cupones solicitados por jugadores.</p>
            </div>
            <span className="rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1 font-mono text-xs text-amber-200">{requestedCoupons.length}</span>
          </div>
          {adminCouponsLoading && <p role="status" className="text-xs text-slate-400">Cargando solicitudes...</p>}
          {adminCouponError && <p role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{adminCouponError}</p>}
          {!adminCouponsLoading && requestedCoupons.length === 0 && !adminCouponError && (
            <p className="rounded-2xl border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-500">No hay solicitudes pendientes.</p>
          )}
          <ul className="space-y-3">
            {requestedCoupons.map((coupon) => (
              <li key={coupon.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-300/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-amber-800">{coupon.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{coupon.description}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-600">Jugador: {coupon.user_id}</p>
                </div>
                <button
                  type="button"
                  disabled={approvingId !== null}
                  onClick={() => void handleApproveRedemption(coupon.id)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-[#332f2d] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
                >
                  {approvingId === coupon.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aprobar / Marcar como Canjeado
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setIsEditingProfile(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="w-full max-w-lg rounded-3xl border border-violet-400/20 bg-slate-900 p-6 shadow-2xl shadow-violet-950/40 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300">Personalización</p>
                <h3 id="edit-profile-title" className="mt-1 text-xl font-bold text-slate-100">Editar perfil</h3>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setIsEditingProfile(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <form className="space-y-4" onSubmit={(event) => void handleSaveProfile(event)}>
              <div>
                <label htmlFor="edit-profile-username" className="mb-1.5 block text-xs font-medium text-slate-300">Nombre de usuario</label>
                <input id="edit-profile-username" required maxLength={40} value={editUsername} onChange={(event) => setEditUsername(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400" />
              </div>
              <div>
                <label htmlFor="edit-profile-country" className="mb-1.5 block text-xs font-medium text-slate-300">País / Ubicación</label>
                <input
                  id="edit-profile-country"
                  type="text"
                  autoComplete="country-name"
                  maxLength={80}
                  required
                  value={editCountry}
                  onChange={(event) => setEditCountry(event.target.value)}
                  placeholder="Ej. Perú 🇵🇪, Colombia 🇨🇴"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400"
                />
              </div>
              <div>
                <label htmlFor="edit-profile-avatar" className="mb-1.5 block text-xs font-medium text-slate-300">URL del avatar <span className="text-slate-500">(opcional)</span></label>
                <input id="edit-profile-avatar" type="url" value={editAvatarUrl} onChange={(event) => setEditAvatarUrl(event.target.value)} placeholder="https://..." className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400" />
              </div>
              {profileError && <p role="alert" className="text-xs text-red-300">{profileError}</p>}
              <button type="submit" disabled={isSavingProfile || profileLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60">
                {isSavingProfile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingProfile ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
