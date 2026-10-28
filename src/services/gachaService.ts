import { supabase } from '../config/supabase';
import type { Coupon } from './couponsService';
import type { CouponPrize } from './couponPrizesService';
import type { ContentAudienceFilter } from '../components/ui/ContentAudienceFilter';

export interface SpinGachaResult {
  coupon: Coupon;
  prize: CouponPrize;
  prizes: CouponPrize[];
  last_spin_at: string;
}

export const gachaService = {
  async getLastSpinAt(audienceFilter: ContentAudienceFilter): Promise<string | null> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión antes de consultar la ruleta.');

    const column = audienceFilter === 'relationship' ? 'last_relationship_spin_at' : 'last_group_spin_at';
    const { data, error } = await supabase
      .from('profiles')
      .select(column)
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data[column];
  },

  async spin(audienceFilter: ContentAudienceFilter = 'realm'): Promise<SpinGachaResult> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw authError;
    }
    if (!user) {
      throw new Error('Inicia sesión antes de girar la ruleta.');
    }

    const { data, error } = await supabase.rpc('spin_gacha_for_current_user', {
      p_audience_filter: audienceFilter,
    });

    if (error) {
      throw error;
    }

    const result = data as SpinGachaResult | null;
    if (!result?.coupon?.id || !result.prize?.id || !Array.isArray(result.prizes) || !result.last_spin_at) {
      throw new Error('La respuesta del servidor al girar la ruleta no es válida.');
    }

    return result;
  },
};
