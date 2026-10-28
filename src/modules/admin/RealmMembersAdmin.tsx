import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Crown, LoaderCircle, MailPlus, Shield, UserRound, X } from 'lucide-react';
import { realmMembersService } from '../../services/realmMembersService';
import type { RealmInvitation, RealmRegisteredUser } from '../../services/realmMembersService';

export default function RealmMembersAdmin() {
  const [email, setEmail] = useState('');
  const [users, setUsers] = useState<RealmRegisteredUser[]>([]);
  const [invitations, setInvitations] = useState<RealmInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [nextUsers, nextInvitations] = await Promise.all([
        realmMembersService.getRegisteredUsers(),
        realmMembersService.getInvitationsForAdmin(),
      ]);
      setUsers(nextUsers);
      setInvitations(nextInvitations);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al cargar miembros e invitaciones del Realm:', error);
      setErrorMessage('No se pudo cargar la lista de cuentas. Comprueba que la migración de gestión de usuarios esté aplicada.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const channel = realmMembersService.subscribe(() => void loadData());
    return () => {
      void realmMembersService.unsubscribe(channel);
    };
  }, [loadData]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInviting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await realmMembersService.invite(email);
      setEmail('');
      await loadData();
      if (result.kind === 'member') {
        setSuccessMessage(result.alreadyMember
          ? `${result.email} ya estaba vinculado al Realm.`
          : `${result.email} ya tiene una cuenta y se vinculó al mapa.`);
      } else {
        setSuccessMessage(result.alreadyInvited
          ? `Ya existe una invitación pendiente para ${result.invitation.email}. Se vinculará al registrarse.`
          : `Invitación guardada para ${result.invitation.email}. Se vinculará automáticamente cuando cree su cuenta.`);
      }
    } catch (error) {
      console.error('Error al invitar a una persona al Realm:', error);
      setErrorMessage(error instanceof Error && error.message.includes('duplicate')
        ? 'Ya existe una invitación pendiente para ese correo.'
        : error instanceof Error ? error.message : 'No se pudo enviar la invitación.');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRevoke(invitation: RealmInvitation) {
    setBusyId(invitation.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await realmMembersService.revokeInvitation(invitation.id);
      await loadData();
      setSuccessMessage(`Se canceló la invitación para ${invitation.email}.`);
    } catch (error) {
      console.error('Error al cancelar invitación del Realm:', error);
      setErrorMessage('No se pudo cancelar la invitación.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleMember(user: RealmRegisteredUser) {
    if (user.role === 'admin') return;
    const enable = !user.is_member;
    setBusyId(user.user_id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await realmMembersService.setMemberEnabled(user.user_id, enable);
      setUsers((currentUsers) => currentUsers.map((currentUser) => (
        currentUser.user_id === user.user_id
          ? { ...currentUser, is_member: enable }
          : currentUser
      )));
      setSuccessMessage(enable
        ? `${user.username} ya está vinculado y aparecerá en el mapa.`
        : `${user.username} se quitó del mapa del Realm.`);
    } catch (error) {
      console.error('Error exacto de Supabase al cambiar la vinculación del usuario:', error);
      setErrorMessage(error instanceof Error
        ? `No se pudo actualizar su vinculación al Realm: ${error.message}`
        : 'No se pudo actualizar su vinculación al Realm.');
    } finally {
      setBusyId(null);
    }
  }

  const inputClassName = 'min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15';

  return (
    <section aria-labelledby="realm-members-title" className="rounded-3xl border border-violet-300/40 bg-slate-900/70 p-5 shadow-xl shadow-violet-900/5 sm:p-7">
      <header className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-5">
        <div className="rounded-xl border border-violet-300/20 bg-violet-400/10 p-2.5 text-violet-200">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h3 id="realm-members-title" className="text-lg font-bold text-slate-100">Personas y acceso</h3>
          <p className="mt-1 text-xs text-slate-400">Consulta las cuentas registradas y decide quién aparece en el mapa compartido.</p>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-200">Invitar a alguien</h4>
          <p className="mt-1 text-xs text-slate-500">Las cuentas existentes se vinculan al instante; las nuevas quedarán vinculadas al registrarse.</p>
        </div>
        <form onSubmit={(event) => void handleInvite(event)} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="realm-invite-email" className="sr-only">Correo de la persona a invitar</label>
        <input
          id="realm-invite-email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="correo@ejemplo.com"
          className={inputClassName}
        />
        <button
          type="submit"
          disabled={isInviting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        >
          {isInviting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
          Invitar
        </button>
        </form>
      </div>

      {isLoading ? (
        <p role="status" className="mt-5 flex items-center gap-2 text-xs text-slate-400">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Cargando cuentas registradas...
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Usuarios registrados <span className="ml-1 rounded-full bg-violet-400/10 px-2 py-0.5 text-violet-200">{users.length}</span></h4>
            {users.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">Todavía no hay perfiles registrados.</p>
            ) : (
              <ul className="space-y-2">
                {users.map((registeredUser) => (
                  <li key={registeredUser.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${registeredUser.role === 'admin' ? 'border-amber-300/25 bg-amber-400/10 text-amber-200' : 'border-violet-300/20 bg-violet-400/10 text-violet-200'}`}>
                        {registeredUser.avatar_url
                          ? <img src={registeredUser.avatar_url} alt="" className="h-full w-full object-cover" />
                          : registeredUser.role === 'admin' ? <Crown className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-100">{registeredUser.username}</p>
                          {registeredUser.role === 'admin' && <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200">Game Master 👑 · Tú</span>}
                          {registeredUser.role === 'player' && <span className="rounded-full border border-violet-300/15 bg-violet-400/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-violet-200">Player</span>}
                        </div>
                        <p className="truncate text-[11px] text-slate-400">{registeredUser.email}</p>
                        <p className="truncate text-[10px] text-slate-500">{registeredUser.country || 'Ubicación sin configurar'}</p>
                      </div>
                    </div>
                    {registeredUser.role === 'player' && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={registeredUser.is_member}
                        aria-label={`${registeredUser.is_member ? 'Quitar' : 'Mostrar'} ${registeredUser.username} ${registeredUser.is_member ? 'del' : 'en el'} mapa`}
                        disabled={busyId === registeredUser.user_id}
                        onClick={() => void handleToggleMember(registeredUser)}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${registeredUser.is_member ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200 hover:bg-red-400/10 hover:text-red-200' : 'border-violet-300/25 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20'}`}
                      >
                        {busyId === registeredUser.user_id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                        {registeredUser.is_member ? 'Quitar del mapa' : 'Mostrar en el mapa'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Estado de invitaciones</h4>
            {invitations.length === 0 ? (
              <p className="text-xs text-slate-500">No has enviado invitaciones todavía.</p>
            ) : (
              <ul className="space-y-2">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-200">{invitation.email}</p>
                      <p className={`mt-0.5 text-[10px] ${
                        invitation.status === 'accepted' ? 'text-emerald-300' : invitation.status === 'pending' ? 'text-amber-200' : 'text-slate-500'
                      }`}>
                        {invitation.status === 'accepted' ? 'Aceptada' : invitation.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                      </p>
                    </div>
                    {invitation.status === 'pending' && (
                      <button
                        type="button"
                        aria-label={`Cancelar invitación para ${invitation.email}`}
                        disabled={busyId === invitation.id}
                        onClick={() => void handleRevoke(invitation)}
                        className="rounded-lg border border-slate-700 p-2 text-slate-500 transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-50"
                      >
                        {busyId === invitation.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </button>
                    )}
                    {invitation.status === 'accepted' && <Check className="h-4 w-4 shrink-0 text-emerald-300" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {errorMessage && <p role="alert" className="mt-4 text-xs text-red-300">{errorMessage}</p>}
      {successMessage && <p role="status" className="mt-4 text-xs text-emerald-300">{successMessage}</p>}
    </section>
  );
}
