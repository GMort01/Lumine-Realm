import { useEffect, useState, type FormEvent } from 'react';
import { Check, Heart, LoaderCircle, Users, X } from 'lucide-react';
import { couponsService } from '../../services/couponsService';
import type { Coupon } from '../../services/couponsService';
import { realmMembersService } from '../../services/realmMembersService';
import type { RealmMember } from '../../services/realmMembersService';

interface CouponRedemptionDialogProps {
  coupon: Coupon;
  userId: string;
  onClose: () => void;
  onSuccess: (coupon: Coupon) => void;
}

export default function CouponRedemptionDialog({
  coupon,
  userId,
  onClose,
  onSuccess,
}: CouponRedemptionDialogProps) {
  const [members, setMembers] = useState<RealmMember[]>([]);
  const [partner, setPartner] = useState<RealmMember | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [forAll, setForAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadRecipients = coupon.audience_scope === 'relationship'
      ? Promise.all([realmMembersService.getMembers(), realmMembersService.getMyRelationships()])
        .then(([realmMembers, relationships]) => {
          const relationship = relationships.find((item) =>
            item.id === coupon.relationship_id
            && item.status === 'accepted'
            && (item.initiator_id === userId || item.partner_id === userId),
          );
          const partnerId = relationship
            ? relationship.initiator_id === userId ? relationship.partner_id : relationship.initiator_id
            : null;
          if (!partnerId) throw new Error('No se encontró el vínculo de pareja asociado a este cupón.');
          const matchedPartner = realmMembers.find((member) => member.user_id === partnerId);
          if (!matchedPartner) throw new Error('Tu pareja ya no forma parte del Realm.');
          return { realmMembers, matchedPartner };
        })
      : realmMembersService.getMembers().then((realmMembers) => ({ realmMembers, matchedPartner: null }));

    void loadRecipients
      .then(({ realmMembers, matchedPartner }) => {
        if (!active) return;
        setMembers(realmMembers);
        setPartner(matchedPartner);
        if (coupon.audience_scope === 'realm') {
          setTargetUserId((current) => current || realmMembers[0]?.user_id || '');
        }
      })
      .catch((error: unknown) => {
        console.error('Error al cargar los destinatarios del canje:', error);
        if (active) {
          setLoadFailed(true);
          setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los miembros del Realm.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [coupon.audience_scope, coupon.relationship_id, userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const isRelationshipCoupon = coupon.audience_scope === 'relationship';
    const selectedTarget = isRelationshipCoupon ? null : targetUserId || null;
    if (!isRelationshipCoupon && !forAll && !selectedTarget) {
      setErrorMessage('Selecciona un miembro o elige “Todos los miembros”.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updatedCoupon = await couponsService.requestRedemption(
        coupon.id,
        selectedTarget,
        !isRelationshipCoupon && forAll,
      );
      onSuccess(updatedCoupon);
      onClose();
    } catch (error) {
      console.error('Error al solicitar canje del cupón:', error);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo solicitar el canje.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-redemption-title"
        className="w-full max-w-md rounded-3xl border border-violet-300/20 bg-slate-950 p-6 shadow-2xl shadow-violet-950/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-violet-300">
              {coupon.audience_scope === 'relationship' ? <Heart className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              Canje de {coupon.audience_scope === 'relationship' ? 'pareja' : 'grupo'}
            </p>
            <h2 id="coupon-redemption-title" className="mt-1 text-xl font-bold text-white">{coupon.title}</h2>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando destinatarios...</p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {coupon.audience_scope === 'relationship' ? (
              partner ? (
                <p className="rounded-xl border border-pink-300/15 bg-pink-400/5 p-4 text-sm text-pink-100">
                  Este cupón solo se puede canjear con <strong>{partner.username}</strong>, tu pareja vinculada.
                </p>
              ) : null
            ) : (
              <fieldset disabled={loadFailed} className="space-y-3 disabled:opacity-50">
                <legend className="mb-2 text-xs font-semibold text-slate-300">¿A quién va dirigido?</legend>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200">
                  <input type="radio" name="coupon-target" checked={!forAll} onChange={() => { setForAll(false); if (!targetUserId) setTargetUserId(members[0]?.user_id ?? ''); }} />
                  <Users className="h-4 w-4 text-violet-300" />
                  <span>Un miembro del Realm</span>
                </label>
                {!forAll && (
                  <select
                    aria-label="Miembro destinatario"
                    required
                    value={targetUserId}
                    onChange={(event) => setTargetUserId(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                  >
                    <option value="" disabled>Selecciona un miembro</option>
                    {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.username}</option>)}
                  </select>
                )}
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200">
                  <input type="radio" name="coupon-target" checked={forAll} onChange={() => setForAll(true)} />
                  <Users className="h-4 w-4 text-pink-300" />
                  <span>Todos los miembros del Realm</span>
                </label>
              </fieldset>
            )}
            {errorMessage && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{errorMessage}</p>}
            <button type="submit" disabled={loadFailed || isSubmitting || (coupon.audience_scope === 'relationship' && !partner) || (coupon.audience_scope === 'realm' && !forAll && !targetUserId)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-50">
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isSubmitting ? 'Solicitando...' : 'Confirmar solicitud'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
