import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

export interface CouponPrize {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export type NewCouponPrize = Pick<CouponPrize, 'title' | 'description'>;

async function requireAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Solo el administrador puede gestionar los premios.');
  }
}

export const couponPrizesService = {
  async getActivePrizes(): Promise<CouponPrize[]> {
    const { data, error } = await supabase
      .from('coupon_prizes')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data as CouponPrize[];
  },

  async getAllPrizesForAdmin(): Promise<CouponPrize[]> {
    await requireAdmin();
    const { data, error } = await supabase
      .from('coupon_prizes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data as CouponPrize[];
  },

  async createPrize(prize: NewCouponPrize): Promise<CouponPrize> {
    await requireAdmin();
    const { data, error } = await supabase
      .from('coupon_prizes')
      .insert({
        title: prize.title.trim(),
        description: prize.description.trim(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as CouponPrize;
  },

  async updatePrize(prizeId: string, updates: Partial<NewCouponPrize> & { is_active?: boolean }): Promise<CouponPrize> {
    await requireAdmin();
    const values: { title?: string; description?: string; is_active?: boolean } = {};
    if (updates.title !== undefined) values.title = updates.title.trim();
    if (updates.description !== undefined) values.description = updates.description.trim();
    if (updates.is_active !== undefined) values.is_active = updates.is_active;

    const { data, error } = await supabase
      .from('coupon_prizes')
      .update(values)
      .eq('id', prizeId)
      .select()
      .single();

    if (error) throw error;
    return data as CouponPrize;
  },

  async deletePrize(prizeId: string): Promise<void> {
    await requireAdmin();
    const { error } = await supabase
      .from('coupon_prizes')
      .delete()
      .eq('id', prizeId);

    if (error) {
      throw error;
    }
  },
};
