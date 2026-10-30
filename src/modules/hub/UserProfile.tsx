import { useEffect, useState, type FormEvent } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Award, BadgeCheck, CalendarDays, Check, Crown, Gift, Heart, LoaderCircle, LogIn, LogOut, MapPin, Pencil, Save, Ticket, User, UserPlus, X } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { couponsService } from '../../services/couponsService';
import type { Coupon } from '../../services/couponsService';
import CouponRedemptionDialog from '../../components/ui/CouponRedemptionDialog';
import ContentAudienceFilter from '../../components/ui/ContentAudienceFilter';
import type { ContentAudienceFilter as AudienceFilter } from '../../components/ui/ContentAudienceFilter';
import { profilesService } from '../../services/profilesService';
import type { PlayerProfile } from '../../services/profilesService';
import { realmMembersService } from '../../services/realmMembersService';
import type { RealmMember } from '../../services/realmMembersService';
import { sanitizePlainText, validateEmail } from '../../utils/validation';

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponAudienceFilter, setCouponAudienceFilter] = useState<AudienceFilter>('realm');
  const [redemptionCoupon, setRedemptionCoupon] = useState<Coupon | null>(null);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editBannerFile, setEditBannerFile] = useState<File | null>(null);
  const [editCustomStatus, setEditCustomStatus] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [requestedCoupons, setRequestedCoupons] = useState<Coupon[]>([]);
  const [incomingCoupons, setIncomingCoupons] = useState<Coupon[]>([]);
  const [incomingCouponsLoading, setIncomingCouponsLoading] = useState(false);
  const [incomingCouponsError, setIncomingCouponsError] = useState<string | null>(null);
  const [respondingCouponId, setRespondingCouponId] = useState<string | null>(null);
  const [incomingCouponNotice, setIncomingCouponNotice] = useState<string | null>(null);
  const [realmMembers, setRealmMembers] = useState<RealmMember[]>([]);
  const [adminCouponsLoading, setAdminCouponsLoading] = useState(false);
  const [adminCouponError, setAdminCouponError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const visibleCoupons = coupons.filter((coupon) => coupon.audience_scope === couponAudienceFilter);
  const memberNames = new Map(realmMembers.map((member) => [member.user_id, member.username]));

  // Recarga sincronizada para actualización inmediata en UI
  function refreshCoupons() {
    if (!user) return;
    void couponsService.getMyCoupons().then(setCoupons).catch(console.error);
    void couponsService.getMyIncomingRedemptionRequests().then(setIncomingCoupons).catch(console.error);
    if (isAdmin) {
      void couponsService.getRequestedCouponsForAdmin().then(setRequestedCoupons).catch(console.error);
    }
  }

  useEffect(() => {
    let active = true;
    if (!user) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setCoupons([]);
        setCouponError(null);
        setCouponsLoading(false);
      });
      return () => {
        active = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!active) return;
      setCouponsLoading(true);
      setCouponError(null);
    });

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
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) {
      void Promise.resolve().then(() => {
        if (active) setIncomingCoupons([]);
      });
      return () => {
        active = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!active) return;
      setIncomingCouponsLoading(true);
      setIncomingCouponsError(null);
    });
    void couponsService.getMyIncomingRedemptionRequests()
      .then((items) => {
        if (active) setIncomingCoupons(items);
      })
      .catch((error: unknown) => {
        console.error('Error al cargar solicitudes personales de canje:', error);
        if (active) setIncomingCouponsError('No se pudieron cargar las solicitudes de canje recibidas.');
      })
      .finally(() => {
        if (active) setIncomingCouponsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setProfile(null);
        setRequestedCoupons([]);
      });
      return () => {
        active = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!active) return;
      setProfileLoading(true);
      setProfileError(null);
    });
    void profilesService.getMyProfile(user.id)
      .then((result) => {
        if (active) {
          setProfile(result);
          setEditUsername(result?.username ?? (typeof user.user_metadata.nickname === 'string' ? user.user_metadata.nickname : ''));
          setEditCountry(result?.country ?? (typeof user.user_metadata.country === 'string' ? user.user_metadata.country : ''));
          setEditAvatarUrl(result?.avatar_url ?? (typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : ''));
          setEditBio(result?.bio ?? '');
          setEditBannerUrl(result?.banner_url ?? '');
          setEditCustomStatus(result?.custom_status ?? '');
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
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user || !isAdmin) {
      void Promise.resolve().then(() => {
        if (active) {
          setRequestedCoupons([]);
          setRealmMembers([]);
        }
      });
      return () => {
        active = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!active) return;
      setAdminCouponsLoading(true);
      setAdminCouponError(null);
    });
    void Promise.all([
      couponsService.getRequestedCouponsForAdmin(),
      realmMembersService.getMembers(),
    ])
      .then(([items, members]) => {
        if (active) {
          setRequestedCoupons(items);
          setRealmMembers(members);
        }
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
  }, [user, isAdmin]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setAuthMessage(null);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: validateEmail(email), password });
        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: validateEmail(email),
          password,
          options: {
            data: {
              username: sanitizePlainText(nickname, 'El nombre de usuario', 40),
              nickname: sanitizePlainText(nickname, 'El nombre de usuario', 40),
              country: sanitizePlainText(country, 'La ubicación', 80),
            },
          },
        });
        if (error) {
          throw error;
        }
        if (data.session && data.user && avatarFile) {
          try {
            const uploadedAvatar = await profilesService.uploadAvatar(data.user.id, avatarFile);
            await profilesService.updateMyProfile(data.user.id, {
              username: nickname,
              country,
              avatar_url: uploadedAvatar,
            });
          } catch (avatarError) {
            console.error('La cuenta se creó, pero no se pudo guardar el avatar:', avatarError);
            setProfileError('La cuenta se creó, pero no se pudo subir el avatar. Puedes intentarlo desde Editar perfil.');
          }
        }
        if (!data.session) {
          setAuthMessage('Revisa tu correo para confirmar tu cuenta y luego inicia sesión.');
          if (avatarFile) {
            setAuthMessage('Revisa tu correo para confirmar la cuenta. Podrás subir el avatar al iniciar sesión.');
          }
        } else {
          setAuthMessage('Cuenta creada. Ya puedes entrar al Realm.');
        }
      }
    } catch (error) {
      console.error('Error de autenticación desde el perfil:', error);
      setFormError(authMode === 'login'
        ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.'
        : 'No se pudo crear la cuenta. Verifica los datos e inténtalo de nuevo.');
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
        avatar_url: editAvatarFile
          ? await profilesService.uploadAvatar(user.id, editAvatarFile)
          : editAvatarUrl,
        bio: editBio,
        banner_url: editBannerFile
          ? await profilesService.uploadBanner(user.id, editBannerFile)
          : editBannerUrl,
        custom_status: editCustomStatus,
      });
      setProfile(updatedProfile);
      setEditAvatarFile(null);
      setEditBannerFile(null);
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
      await couponsService.approveRedemption(couponId);
      refreshCoupons();
    } catch (error) {
      console.error('Error al aprobar el canje:', error);
      setAdminCouponError('No se pudo aprobar el canje. Actualiza la lista e inténtalo otra vez.');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRespondToRedemption(couponId: string, accept: boolean) {
    if (respondingCouponId) return;
    setRespondingCouponId(couponId);
    setIncomingCouponsError(null);
    setIncomingCouponNotice(null);
    try {
      await couponsService.respondToRedemption(couponId, accept);
      setIncomingCouponNotice(accept
        ? 'Aceptaste el cupón. ¡Ahora pueden coordinar el canje!'
        : 'Rechazaste la solicitud. El cupón quedó disponible para que su dueño vuelva a solicitarlo.');
      refreshCoupons();
    } catch (error) {
      console.error('Error al responder solicitud de canje:', error);
      setIncomingCouponsError('No se pudo responder la solicitud. Actualiza la página e inténtalo de nuevo.');
    } finally {
      setRespondingCouponId(null);
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
                  <label htmlFor="profile-avatar" className="mb-1.5 block text-xs font-medium text-slate-300">Avatar <span className="text-slate-500">(opcional)</span></label>
                  <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200" />
                  <p className="mt-1 text-[10px] text-slate-500">{avatarFile ? avatarFile.name : 'JPG, PNG, WebP, GIF o AVIF · máximo 5 MB'}</p>
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
                maxLength={128}
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
  const profileBadge = isAdmin ? 'Game Master' : profile?.badge || 'Player';
  const profileAvatar = profile?.avatar_url || (typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : '');

  return (
    <section aria-labelledby="profile-title" className="mx-auto w-full max-w-5xl space-y-6">
      <article className="relative overflow-hidden rounded-3xl border border-realm-border/80 bg-card shadow-2xl shadow-black/25">
        <div
          className="absolute inset-x-0 top-0 h-44 bg-gradient-to-r from-violet-900/80 via-fuchsia-900/55 to-amber-800/50 bg-cover bg-center"
          style={profile?.banner_url ? { backgroundImage: `linear-gradient(90deg,rgba(76,29,149,.72),rgba(112,26,117,.5),rgba(120,53,15,.5)),url("${profile.banner_url}")` } : undefined}
        />
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
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/40 px-2.5 py-1 text-[10px] font-bold text-white/90"><BadgeCheck className="h-3 w-3 text-violet-200" />{profileBadge}</span>
            </div>
            {(profile?.custom_status || profile?.bio) && (
              <div className="mt-3 max-w-xl rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-left backdrop-blur-sm">
                {profile.custom_status && <p className="text-xs font-semibold text-emerald-200">{profile.custom_status}</p>}
                {profile.bio && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/75">{profile.bio}</p>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditUsername(profile?.username ?? (typeof user.user_metadata.nickname === 'string' ? user.user_metadata.nickname : ''));
                setEditCountry(profile?.country ?? (typeof user.user_metadata.country === 'string' ? user.user_metadata.country : ''));
                setEditAvatarUrl(profile?.avatar_url ?? (typeof user.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : ''));
                setEditBio(profile?.bio ?? '');
                setEditBannerUrl(profile?.banner_url ?? '');
                setEditBannerFile(null);
                setEditCustomStatus(profile?.custom_status ?? '');
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
          <div className="flex items-center gap-3">
            <ContentAudienceFilter value={couponAudienceFilter} onChange={setCouponAudienceFilter} />
            <span className="rounded-full border border-pink-400/15 bg-pink-400/10 px-3 py-1 font-mono text-xs text-pink-200">{visibleCoupons.length}</span>
          </div>
        </div>

        {couponsLoading && <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando cupones...</p>}
        {couponError && <p role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{couponError}</p>}
        {!couponsLoading && visibleCoupons.length === 0 && !couponError && (
          <p className="rounded-2xl border border-dashed border-slate-700 px-5 py-9 text-center text-sm text-slate-500">No tienes cupones de {couponAudienceFilter === 'realm' ? 'grupo' : 'pareja'} todavía. ¡Prueba tu suerte en la ruleta!</p>
        )}
        <ul className="grid gap-3 md:grid-cols-2">
          {visibleCoupons.map((coupon) => (
            <li key={coupon.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-violet-400/15 bg-slate-950/50 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-pink-800">{coupon.title}</h4>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    coupon.status === 'redeemed' || coupon.is_redeemed
                      ? 'bg-slate-800 text-slate-500'
                      : coupon.status === 'requested'
                        ? 'bg-amber-500/10 text-amber-300'
                        : coupon.status === 'declined'
                          ? 'bg-red-500/10 text-red-300'
                        : 'bg-emerald-500/10 text-emerald-300'
                  }`}>
                    {coupon.status === 'redeemed' || coupon.is_redeemed ? 'Canjeado' : coupon.status === 'requested' ? 'Solicitado' : coupon.status === 'declined' ? 'Rechazado' : coupon.expires_at && new Date(coupon.expires_at) < new Date() ? 'Vencido' : 'Disponible'}
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
                  Esperando respuesta
                </span>
              ) : coupon.expires_at && new Date(coupon.expires_at) < new Date() ? (
                <span className="shrink-0 text-xs text-slate-500">Cupón vencido</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRedemptionCoupon(coupon)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-pink-400/20 bg-pink-500/10 px-3 py-2 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/20 disabled:cursor-wait disabled:opacity-60"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  {coupon.status === 'declined' ? 'Solicitar de nuevo' : 'Solicitar Canje'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="incoming-redemptions-title" className="rounded-3xl border border-pink-300/15 bg-slate-900/70 p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 id="incoming-redemptions-title" className="flex items-center gap-2 text-lg font-bold text-slate-100">
              <Heart className="h-5 w-5 text-pink-300" />
              Cupones para ti
            </h3>
            <p className="mt-1 text-xs text-slate-500">Acepta o rechaza solicitudes de tu pareja o de miembros del Realm.</p>
          </div>
          <span className="rounded-full border border-pink-300/15 bg-pink-300/10 px-3 py-1 font-mono text-xs text-pink-200">{incomingCoupons.length}</span>
        </div>
        {incomingCouponsLoading && <p role="status" className="text-xs text-slate-400">Cargando solicitudes recibidas...</p>}
        {incomingCouponsError && <p role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{incomingCouponsError}</p>}
        {incomingCouponNotice && <p role="status" className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">{incomingCouponNotice}</p>}
        {!incomingCouponsLoading && incomingCoupons.length === 0 && !incomingCouponsError && (
          <p className="rounded-2xl border border-dashed border-slate-700 px-5 py-7 text-center text-sm text-slate-500">No tienes solicitudes pendientes.</p>
        )}
        <ul className="space-y-3">
          {incomingCoupons.map((coupon) => (
            <li key={coupon.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-pink-300/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold text-pink-100">{coupon.title}</p>
                <p className="mt-1 text-xs text-slate-400">{coupon.description}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-pink-300">
                  {coupon.audience_scope === 'relationship' ? 'Vínculo de pareja' : 'Miembro del Realm'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={respondingCouponId !== null}
                  onClick={() => void handleRespondToRedemption(coupon.id, false)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  disabled={respondingCouponId !== null}
                  onClick={() => void handleRespondToRedemption(coupon.id, true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {respondingCouponId === coupon.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aceptar
                </button>
              </div>
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
                  <p className="mt-1 text-xs text-amber-200">
                    Audiencia: {coupon.audience_scope === 'relationship' ? 'Pareja' : 'Grupo'} · Destino: {coupon.redemption_for_all
                      ? 'Todos los miembros'
                      : coupon.redemption_target_user_id
                        ? memberNames.get(coupon.redemption_target_user_id) ?? coupon.redemption_target_user_id
                        : 'Sin destinatario'}
                  </p>
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

      {redemptionCoupon && (
        <CouponRedemptionDialog
          coupon={redemptionCoupon}
          userId={user.id}
          onClose={() => setRedemptionCoupon(null)}
          onSuccess={(updatedCoupon) => {
            setCoupons((current) => current.map((coupon) => coupon.id === updatedCoupon.id ? updatedCoupon : coupon));
            refreshCoupons();
          }}
        />
      )}

      {/* MODAL COMPLETA EDITAR PERFIL CON TODOS TUS INPUTS */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setIsEditingProfile(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-violet-400/20 bg-slate-900 p-6 shadow-2xl shadow-violet-950/40 sm:p-8"
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
                <label htmlFor="edit-profile-banner" className="mb-1.5 block text-xs font-medium text-slate-300">Banner del perfil <span className="text-slate-500">(URL de imagen opcional)</span></label>
                <input
                  id="edit-profile-banner"
                  type="url"
                  maxLength={2048}
                  value={editBannerUrl}
                  onChange={(event) => setEditBannerUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400"
                />
                <input
                  aria-label="Subir imagen para banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  onChange={(event) => setEditBannerFile(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200"
                />
                <p className="mt-1 text-[10px] text-slate-500">{editBannerFile ? `${editBannerFile.name} · se usará la imagen subida` : 'También puedes subir una imagen JPG, PNG, WebP, GIF o AVIF · máximo 5 MB.'}</p>
              </div>
              <div>
                <label htmlFor="edit-profile-bio" className="mb-1.5 block text-xs font-medium text-slate-300">Sobre mí</label>
                <textarea
                  id="edit-profile-bio"
                  maxLength={250}
                  rows={3}
                  value={editBio}
                  onChange={(event) => setEditBio(event.target.value)}
                  placeholder="Cuéntale algo a la comunidad..."
                  className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400"
                />
                <p className="mt-1 text-right text-[10px] text-slate-500">{editBio.length}/250</p>
              </div>
              <div>
                <label htmlFor="edit-profile-status" className="mb-1.5 block text-xs font-medium text-slate-300">Estado personalizado</label>
                <input
                  id="edit-profile-status"
                  maxLength={100}
                  value={editCustomStatus}
                  onChange={(event) => setEditCustomStatus(event.target.value)}
                  placeholder="¿Qué tienes en mente?"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400"
                />
              </div>
              <div>
                <label htmlFor="edit-profile-avatar" className="mb-1.5 block text-xs font-medium text-slate-300">Cambiar avatar <span className="text-slate-500">(opcional)</span></label>
                <input id="edit-profile-avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setEditAvatarFile(event.target.files?.[0] ?? null)} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200" />
                <p className="mt-1 text-[10px] text-slate-500">{editAvatarFile ? editAvatarFile.name : 'JPG, PNG, WebP, GIF o AVIF · máximo 5 MB'}</p>
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