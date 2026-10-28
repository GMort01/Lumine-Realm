import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { realmMembersService } from '../../services/realmMembersService';
import type { RealmMember, RealmRelationship } from '../../services/realmMembersService';

export type AudienceScope = 'realm' | 'individual' | 'relationship';

export interface AudienceSelection {
  scope: AudienceScope;
  recipientUserId: string;
  relationshipId: string;
}

interface AudiencePickerProps {
  userId: string;
  value: AudienceSelection;
  onChange: (value: AudienceSelection) => void;
}

export default function AudiencePicker({ userId, value, onChange }: AudiencePickerProps) {
  const [members, setMembers] = useState<RealmMember[]>([]);
  const [relationships, setRelationships] = useState<RealmRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      realmMembersService.getMembers(),
      realmMembersService.getMyRelationships(),
    ]).then(([memberRows, relationshipRows]) => {
      if (!active) return;
      setMembers(memberRows);
      setRelationships(relationshipRows.filter((relationship) => relationship.status === 'accepted'));
    }).catch((error: unknown) => {
      console.error('Error al cargar las opciones de audiencia:', error);
      if (active) setErrorMessage('No se pudieron cargar miembros y vínculos para elegir la audiencia.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const recipients = members.filter((member) => member.user_id !== userId);

  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <legend className="px-1 text-xs font-medium text-slate-300">¿Quién puede verlo?</legend>
      <select
        aria-label="Audiencia del contenido"
        value={value.scope}
        onChange={(event) => onChange({
          scope: event.target.value as AudienceScope,
          recipientUserId: '',
          relationshipId: '',
        })}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400"
      >
        <option value="realm">Todo el Realm</option>
        <option value="individual">Una persona</option>
        <option value="relationship">Mi vínculo de pareja</option>
      </select>

      {value.scope === 'individual' && (
        <select
          aria-label="Persona destinataria"
          required
          value={value.recipientUserId}
          onChange={(event) => onChange({ ...value, recipientUserId: event.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400"
        >
          <option value="">Selecciona un miembro</option>
          {recipients.map((member) => <option key={member.user_id} value={member.user_id}>{member.username}</option>)}
        </select>
      )}

      {value.scope === 'relationship' && (
        <select
          aria-label="Vínculo de pareja"
          required
          value={value.relationshipId}
          onChange={(event) => onChange({ ...value, relationshipId: event.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400"
        >
          <option value="">Selecciona tu vínculo aceptado</option>
          {relationships.filter((relationship) => relationship.initiator_id === userId || relationship.partner_id === userId).map((relationship) => {
            const partnerId = relationship.initiator_id === userId ? relationship.partner_id : relationship.initiator_id;
            const partner = members.find((member) => member.user_id === partnerId);
            return <option key={relationship.id} value={relationship.id}>{partner?.username ?? 'Pareja'}</option>;
          })}
        </select>
      )}

      {isLoading && <p className="flex items-center gap-1 text-[10px] text-slate-500"><LoaderCircle className="h-3 w-3 animate-spin" />Cargando audiencia...</p>}
      {errorMessage && <p role="alert" className="text-[10px] text-red-300">{errorMessage}</p>}
      {!isLoading && value.scope === 'individual' && recipients.length === 0 && <p className="text-[10px] text-amber-200">No hay otros miembros disponibles.</p>}
      {!isLoading && value.scope === 'relationship' && relationships.length === 0 && <p className="text-[10px] text-amber-200">Primero necesitas aceptar un vínculo de pareja.</p>}
    </fieldset>
  );
}
