import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Activity, BadgeCheck, CalendarDays, Check, Crown, Eye, EyeOff, Heart, LoaderCircle, MapPin, UserPlus, X } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { ADMIN_EMAIL } from '../../config/roles';
import { realmMembersService } from '../../services/realmMembersService';
import type { RealmMember, RealmRelationship } from '../../services/realmMembersService';

interface RealmDirectoryProps {
  user: SupabaseUser | null;
}

function daysInRealm(joinedAt: string) {
  const joined = new Date(joinedAt);
  if (Number.isNaN(joined.getTime())) return 1;
  return Math.max(1, Math.floor((Date.now() - joined.getTime()) / 86_400_000) + 1);
}

function joinedDate(joinedAt: string) {
  const date = new Date(joinedAt);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date);
}

export default function RealmDirectory({ user }: RealmDirectoryProps) {
  const [members, setMembers] = useState<RealmMember[]>([]);
  const [relationships, setRelationships] = useState<RealmRelationship[]>([]);
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(() => new Set());
  const [selectedMember, setSelectedMember] = useState<RealmMember | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setMembers([]);
      setRelationships([]);
      setHiddenMemberIds(new Set());
      return;
    }

    setLoading(true);
    try {
      const [directory, links, hiddenIds] = await Promise.all([
        realmMembersService.getMembers(),
        realmMembersService.getMyRelationships(),
        realmMembersService.getHiddenMapMemberIds(),
      ]);
      setMembers(directory);
      setRelationships(links);
      setHiddenMemberIds(hiddenIds);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al cargar la comunidad del Realm:', error);
      setErrorMessage('No se pudo cargar el directorio. Verifica que seas miembro y que la migración de comunidad esté aplicada.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void Promise.resolve().then(loadDirectory);
  }, [loadDirectory]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`realm-relationships-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'realm_relationships' }, () => {
        void loadDirectory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void loadDirectory();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadDirectory, user]);

  useEffect(() => {
    if (!previewImage) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreviewImage(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  const activeRelationships = useMemo(
    () => relationships.filter((relationship) => relationship.status === 'accepted' || relationship.status === 'pending'),
    [relationships],
  );
  const ownRelationship = activeRelationships.find(
    (relationship) => relationship.initiator_id === user?.id || relationship.partner_id === user?.id,
  );
  const partnerId = ownRelationship?.status === 'accepted'
    ? ownRelationship.initiator_id === user?.id ? ownRelationship.partner_id : ownRelationship.initiator_id
    : null;
  const partner = members.find((member) => member.user_id === partnerId);
  const incomingInvitations = relationships.filter(
    (relationship) => relationship.status === 'pending' && relationship.partner_id === user?.id,
  );
  const selectedRelationship = selectedMember && user
    ? relationships.find((item) =>
      (item.initiator_id === user.id && item.partner_id === selectedMember.user_id)
      || (item.partner_id === user.id && item.initiator_id === selectedMember.user_id),
    )
    : undefined;

  async function performAction(
    memberId: string,
    action: () => Promise<void>,
    message: string,
  ) {
    if (savingId) return;
    setSavingId(memberId);
    setErrorMessage(null);
    setNotice(null);
    try {
      await action();
      await loadDirectory();
      setNotice(message);
    } catch (error) {
      console.error('Error al actualizar un vínculo del Realm:', error);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo actualizar el vínculo.');
    } finally {
      setSavingId(null);
    }
  }

  if (!user) {
    return (
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <Heart className="mx-auto mb-3 h-8 w-8 text-pink-300" />
        <h2 className="text-xl font-bold text-white">Comunidad del Realm</h2>
        <p className="mt-2 text-sm text-slate-400">Inicia sesión y únete al Realm para ver a sus miembros.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="realm-directory-title" className="mx-auto w-full max-w-5xl space-y-6">
      <header className="rounded-3xl border border-pink-400/15 bg-gradient-to-br from-slate-900 via-violet-950/50 to-pink-950/40 p-6 sm:p-8">
        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-pink-300">
          <Heart className="h-3.5 w-3.5" /> Un mismo Realm
        </p>
        <h1 id="realm-directory-title" className="text-2xl font-extrabold text-white sm:text-3xl">Comunidad</h1>
        <p className="mt-2 text-sm text-slate-400">Conoce a quienes comparten este espacio y crea un vínculo de pareja mutuo.</p>
      </header>

      {partner && (
        <div className="flex items-center gap-3 rounded-2xl border border-pink-300/25 bg-pink-500/10 p-4 text-sm text-pink-100">
          <Heart className="h-5 w-5 shrink-0 text-pink-300" />
          <p>Tu vínculo de pareja en el Realm es con <strong>{partner.username}</strong>. Los contenidos de pareja solo son visibles entre ustedes.</p>
        </div>
      )}

      {incomingInvitations.length > 0 && (
        <section aria-labelledby="relationship-invitations-title" className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-5">
          <h2 id="relationship-invitations-title" className="mb-3 text-sm font-bold text-violet-100">Invitaciones de pareja</h2>
          <div className="space-y-3">
            {incomingInvitations.map((relationship) => {
              const inviter = members.find((member) => member.user_id === relationship.initiator_id);
              return (
                <div key={relationship.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/50 p-3">
                  <p className="text-sm text-slate-200"><strong>{inviter?.username ?? 'Un miembro'}</strong> te invita a vincular sus perfiles.</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={savingId !== null} onClick={() => void performAction(relationship.id, () => realmMembersService.respondToPartnerInvitation(relationship.id, 'accepted'), 'Vínculo de pareja aceptado.')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">
                      {savingId === relationship.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Aceptar
                    </button>
                    <button type="button" disabled={savingId !== null} onClick={() => void performAction(relationship.id, () => realmMembersService.respondToPartnerInvitation(relationship.id, 'declined'), 'Invitación rechazada.')} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50">
                      <X className="h-3.5 w-3.5" />Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {errorMessage && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errorMessage}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}

      {loading ? (
        <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-violet-200"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando miembros...</p>
      ) : members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Aún no hay miembros vinculados al Realm.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const relationship = relationships.find((item) =>
              (item.initiator_id === user.id && item.partner_id === member.user_id)
              || (item.partner_id === user.id && item.initiator_id === member.user_id),
            );
            return (
              <article key={member.user_id} className={`overflow-hidden rounded-2xl border bg-slate-900/90 shadow-xl shadow-black/20 ${relationship?.status === 'accepted' ? 'border-pink-300/40' : 'border-slate-800'}`}>
                <div
                  className="h-24 bg-gradient-to-br from-violet-800 via-fuchsia-800 to-slate-900 bg-cover bg-center"
                  style={member.banner_url ? { backgroundImage: `linear-gradient(180deg,rgba(15,23,42,.06),rgba(15,23,42,.35)),url("${member.banner_url}")` } : undefined}
                />
                <div className="px-5 pb-5">
                  <div className="-mt-10 mb-3 flex items-end justify-between gap-3">
                    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-full border-[5px] border-slate-900 bg-slate-800 text-2xl font-bold text-violet-100 shadow-lg">
                      {member.avatar_url
                        ? <img src={member.avatar_url} alt={`Avatar de ${member.username}`} className="h-full w-full object-cover" />
                        : member.username.slice(0, 1).toUpperCase()}
                      <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-slate-900 bg-emerald-400" aria-label="Miembro del Realm" title="Miembro del Realm" />
                    </div>
                    <span className={`mb-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      relationship?.status === 'accepted' || member.badge?.toLowerCase().includes('pareja')
                        ? 'border-pink-300/30 bg-pink-400/10 text-pink-200'
                        : member.user_id === user.id && user.email?.toLowerCase() === ADMIN_EMAIL
                          ? 'border-amber-300/30 bg-amber-400/10 text-amber-200'
                          : 'border-violet-300/20 bg-violet-400/10 text-violet-200'
                    }`}>
                      <BadgeCheck className="h-3 w-3" />
                      {relationship?.status === 'accepted' || member.badge?.toLowerCase().includes('pareja')
                        ? 'Pareja'
                        : member.user_id === user.id && user.email?.toLowerCase() === ADMIN_EMAIL
                          ? 'Game Master'
                          : member.badge || 'Player'}
                    </span>
                  </div>
                  <h2 className="truncate text-lg font-extrabold text-white">{member.username}</h2>
                  {member.custom_status && <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-200"><Activity className="h-3 w-3 shrink-0" />{member.custom_status}</p>}
                  <p className="mt-3 line-clamp-2 min-h-9 text-xs leading-relaxed text-slate-300">{member.bio || 'Este aventurero aún no ha escrito una descripción.'}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="h-3 w-3" />{member.country || 'Ubicación no indicada'}</p>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-3 text-[10px] text-slate-500">
                    <span>Miembro desde {joinedDate(member.joined_at)}</span>
                    <span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 font-mono">{daysInRealm(member.joined_at)} días</span>
                  </div>
                <button type="button" onClick={() => setSelectedMember(member)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2.5 text-xs font-semibold text-violet-200 transition hover:border-violet-300/40 hover:bg-violet-500/20">
                  <UserPlus className="h-3.5 w-3.5" />Ver perfil
                </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-profile-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-violet-300/20 bg-slate-950 shadow-2xl shadow-violet-950/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-32 w-full overflow-hidden rounded-t-3xl bg-gradient-to-br from-violet-800 via-fuchsia-800 to-slate-900 sm:h-40">
              {selectedMember.banner_url ? (
                <button
                  type="button"
                  aria-label={`Ampliar banner de ${selectedMember.username}`}
                  onClick={() => {
                    if (selectedMember.banner_url) {
                      setPreviewImage({ url: selectedMember.banner_url, title: `Banner de ${selectedMember.username}` });
                    }
                  }}
                  className="absolute inset-0 h-full w-full cursor-zoom-in bg-cover bg-center transition-transform duration-300 hover:scale-[1.02]"
                  style={{ backgroundImage: `linear-gradient(180deg,rgba(15,23,42,.04),rgba(15,23,42,.5)),url("${selectedMember.banner_url}")` }}
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(244,114,182,.3),transparent_55%)]" />
              )}
              <button type="button" aria-label="Cerrar perfil" onClick={() => setSelectedMember(null)} className="absolute right-4 top-4 rounded-lg border border-white/15 bg-slate-950/60 p-2 text-white backdrop-blur hover:bg-slate-900"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 pb-6 sm:px-7">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
                <div className="relative z-10 grid h-24 w-24 place-items-center overflow-hidden rounded-full border-[6px] border-slate-950 bg-slate-800 text-3xl font-bold text-violet-100 shadow-xl">
                  {selectedMember.avatar_url ? (
                    <button
                      type="button"
                      aria-label={`Ampliar foto de perfil de ${selectedMember.username}`}
                      onClick={() => {
                        if (selectedMember.avatar_url) {
                          setPreviewImage({ url: selectedMember.avatar_url, title: `Foto de perfil de ${selectedMember.username}` });
                        }
                      }}
                      className="h-full w-full cursor-zoom-in transition-transform duration-200 hover:scale-105"
                    >
                      <img src={selectedMember.avatar_url} alt={`Avatar de ${selectedMember.username}`} className="h-full w-full object-cover" />
                    </button>
                  ) : selectedMember.username.slice(0, 1).toUpperCase()}
                </div>
                <span className={`mb-1 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-bold ${
                  selectedRelationship?.status === 'accepted' || selectedMember.badge?.toLowerCase().includes('pareja')
                    ? 'border-pink-300/30 bg-pink-400/10 text-pink-200'
                    : selectedMember.user_id === user.id && user.email?.toLowerCase() === ADMIN_EMAIL
                      ? 'border-amber-300/30 bg-amber-400/10 text-amber-200'
                      : 'border-violet-300/20 bg-violet-400/10 text-violet-200'
                }`}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {selectedRelationship?.status === 'accepted' || selectedMember.badge?.toLowerCase().includes('pareja')
                    ? 'Pareja'
                    : selectedMember.user_id === user.id && user.email?.toLowerCase() === ADMIN_EMAIL
                      ? 'Game Master'
                      : selectedMember.badge || 'Player'}
                </span>
              </div>
              <div className="mt-4 border-b border-slate-800 pb-5">
                <h2 id="community-profile-title" className="text-2xl font-extrabold text-white">{selectedMember.username}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5" />{selectedMember.country || 'Ubicación no indicada'}</p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <article className="rounded-xl border border-violet-300/10 bg-slate-900/80 p-4 sm:col-span-2">
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">Sobre mí</h3>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{selectedMember.bio || 'Este aventurero aún no ha escrito una descripción.'}</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300"><CalendarDays className="h-3.5 w-3.5" />Miembro desde</h3>
                  <p className="text-sm font-semibold text-slate-100">{joinedDate(selectedMember.joined_at)}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{daysInRealm(selectedMember.joined_at)} días en el Realm</p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300"><Activity className="h-3.5 w-3.5" />Estado</h3>
                  <p className="text-sm text-slate-200">{selectedMember.custom_status || 'Sin estado personalizado'}</p>
                </article>
              </div>

            {selectedMember.user_id !== user.id && (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  disabled={savingId !== null}
                  onClick={() => void performAction(
                    selectedMember.user_id,
                    () => realmMembersService.setMapMemberVisibility(selectedMember.user_id, hiddenMemberIds.has(selectedMember.user_id)),
                    hiddenMemberIds.has(selectedMember.user_id) ? `${selectedMember.username} volverá a aparecer en tu mapa.` : `${selectedMember.username} ya no aparecerá en tu mapa.`,
                  )}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
                >
                  {hiddenMemberIds.has(selectedMember.user_id) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {hiddenMemberIds.has(selectedMember.user_id) ? 'Mostrar en mi mapa' : 'Ocultar de mi mapa'}
                </button>

                {(() => {
                  const relationship = selectedRelationship;
                  if (relationship?.status === 'accepted') {
                    return <button type="button" disabled={savingId !== null} onClick={() => void performAction(relationship.id, () => realmMembersService.endRelationship(relationship.id), 'El vínculo de pareja terminó.')} className="w-full rounded-xl border border-pink-300/20 bg-pink-400/10 px-4 py-3 text-sm font-semibold text-pink-200 hover:bg-pink-400/20 disabled:opacity-50">{savingId === relationship.id ? 'Actualizando...' : 'Terminar vínculo de pareja'}</button>;
                  }
                  if (relationship?.status === 'pending') {
                    return <p className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center text-xs text-violet-200">{relationship.initiator_id === user.id ? 'Invitación de pareja enviada' : 'Tiene una invitación de pareja pendiente'}</p>;
                  }
                  if (ownRelationship) {
                    return <p className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center text-xs text-slate-400">Solo puedes tener un vínculo activo a la vez.</p>;
                  }
                  return <button type="button" disabled={savingId !== null} onClick={() => void performAction(selectedMember.user_id, () => realmMembersService.invitePartner(selectedMember.user_id), 'Invitación de pareja enviada.')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pink-300/20 bg-pink-400/10 px-4 py-3 text-sm font-semibold text-pink-100 transition hover:bg-pink-400/20 disabled:opacity-50">{savingId === selectedMember.user_id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}Vincular de a dos</button>;
                })()}
              </div>
            )}
            {selectedMember.user_id === user.id && <p className="rounded-xl border border-amber-300/15 bg-amber-400/5 p-3 text-center text-sm text-amber-100"><Crown className="mr-2 inline h-4 w-4" />Este es tu perfil.</p>}
            </div>
          </section>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={previewImage.title}
            className="relative flex max-h-[92vh] max-w-[94vw] flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Cerrar vista previa"
              onClick={() => setPreviewImage(null)}
              className="absolute -right-2 -top-12 rounded-full border border-white/20 bg-slate-900/90 p-2 text-white shadow-lg transition hover:bg-slate-800 sm:right-0"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl shadow-black/50"
            />
            <p className="text-center text-xs font-medium text-white/80">{previewImage.title}</p>
          </section>
        </div>
      )}
    </section>
  );
}
