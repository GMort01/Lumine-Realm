import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

export type CouponStatus = 'available' | 'requested' | 'redeemed';

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
}

export type NewCoupon = Pick<Coupon, 'title' | 'description'>;

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
  async getMyCoupons(): Promise<Coupon[]> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as Coupon[];
  },

  async requestRedemption(couponId: string): Promise<Coupon> {
    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from('coupons')
      .update({ status: 'requested' })
      .eq('id', couponId)
      .eq('user_id', userId)
      .eq('status', 'available')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('El cupón ya fue solicitado o no está disponible.');
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

    const { data, error } = await supabase
      .from('coupons')
      .update({
        status: 'redeemed',
        is_redeemed: true,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', couponId)
      .eq('status', 'requested')
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('La solicitud ya fue atendida o no está disponible.');
    }

    return data as Coupon;
  },

  async deleteMyCoupon(couponId: string): Promise<void> {
    const userId = await getAuthenticatedUserId();
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
