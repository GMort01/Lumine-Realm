import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';
import { validateUuid } from '../utils/validation';

export type CouponStatus = 'available' | 'requested' | 'redeemed' | 'declined';

export interface Coupon {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_redeemed: boolean;
  redeemed_at: string | null;
  status: CouponStatus;
  expires_at: string | null;
  created_at: string;
  audience_scope: 'realm' | 'relationship';
  relationship_id: string | null;
  redemption_target_user_id: string | null;
  redemption_for_all: boolean;
}

export type NewCoupon = Pick<Coupon, 'title' | 'description'>;
export type CouponAudienceFilter = 'realm' | 'relationship';

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  if (!data.user) {
    throw new Error('Inicia sesión para acceder a tus cupones.');
  }

  return data.user.id;
}

export const couponsService = {
  async getMyCoupons(audienceFilter?: CouponAudienceFilter): Promise<Coupon[]> {
    const userId = await getAuthenticatedUserId();
    validateUuid(userId, 'La cuenta');
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const coupons = data as Coupon[];
    return audienceFilter
      ? coupons.filter((coupon) => coupon.audience_scope === audienceFilter)
      : coupons;
  },

  async requestRedemption(
    couponId: string,
    targetUserId: string | null,
    forAll = false,
  ): Promise<Coupon> {
    await getAuthenticatedUserId();
    validateUuid(couponId, 'El cupón');
    if (targetUserId) validateUuid(targetUserId, 'El destinatario');
    if (typeof forAll !== 'boolean') throw new Error('El destinatario del canje no es válido.');
    const { data, error } = await supabase.rpc('request_coupon_redemption', {
      p_coupon_id: couponId,
      p_target_user_id: targetUserId,
      p_for_all: forAll,
    });

    if (error) {
      throw error;
    }
    if (!data || typeof data !== 'object' || !('id' in data)) {
      throw new Error('La respuesta del servidor al solicitar el canje no es válida.');
    }

    return data as Coupon;
  },

  async getMyIncomingRedemptionRequests(): Promise<Coupon[]> {
    await getAuthenticatedUserId();
    // Se invoca la función con el nombre corregido y compatible en Supabase
    const { data, error } = await supabase.rpc('get_incoming_coupon_requests');
    if (error) throw error;
    if (!Array.isArray(data)) {
      throw new Error('La respuesta del servidor al consultar solicitudes de canje no es válida.');
    }
    return data as Coupon[];
  },

  async respondToRedemption(couponId: string, accept: boolean): Promise<Coupon> {
    await getAuthenticatedUserId();
    validateUuid(couponId, 'El cupón');
    if (typeof accept !== 'boolean') throw new Error('La respuesta a la solicitud no es válida.');
    const { data, error } = await supabase.rpc('respond_to_coupon_redemption', {
      p_coupon_id: couponId,
      p_accept: accept,
    });
    if (error) throw error;
    if (!data || typeof data !== 'object' || !('id' in data)) {
      throw new Error('La respuesta del servidor al responder la solicitud no es válida.');
    }
    return data as Coupon;
  },

  async getRequestedCouponsForAdmin(): Promise<Coupon[]> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw authError;
    }
    if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Solo el administrador puede revisar las solicitudes.');
    }

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('status', 'requested')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data as Coupon[];
  },

  async approveRedemption(couponId: string): Promise<Coupon> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw authError;
    }
    if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Solo el administrador puede aprobar el canje.');
    }
    validateUuid(couponId, 'El cupón');

    const { data, error } = await supabase.rpc('admin_approve_coupon_redemption', {
      p_coupon_id: couponId,
    });

    if (error) {
      throw error;
    }
    if (!data || typeof data !== 'object' || !('id' in data)) {
      throw new Error('La respuesta del servidor al aprobar el canje no es válida.');
    }

    return data as Coupon;
  },

  async deleteMyCoupon(couponId: string): Promise<void> {
    const userId = await getAuthenticatedUserId();
    validateUuid(userId, 'La cuenta');
    validateUuid(couponId, 'El cupón');
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', couponId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  },
};