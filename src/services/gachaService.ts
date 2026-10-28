import { supabase } from '../config/supabase';
import type { Coupon } from './couponsService';
import type { CouponPrize } from './couponPrizesService';

export interface SpinGachaResult {
  coupon: Coupon;
  prize: CouponPrize;
  prizes: CouponPrize[];
}

export const gachaService = {
  async spin(): Promise<SpinGachaResult> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw authError;
    }
    if (!user) {
      throw new Error('Inicia sesión antes de girar la ruleta.');
    }

    const { data, error } = await supabase.rpc('spin_gacha_for_user', {
      p_user_id: user.id,
    });

    if (error) {
      throw error;
    }

    const result = data as SpinGachaResult | null;
    if (!result?.coupon?.id || !result.prize?.id || !Array.isArray(result.prizes)) {
      throw new Error('La respuesta del servidor al girar la ruleta no es válida.');
    }

    return result;
  },
};
