import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

export type CouponPrizeAudience = 'realm' | 'individual' | 'relationship';

export interface CouponPrize {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  audience_scope?: CouponPrizeAudience;
  recipient_user_id?: string | null;
  relationship_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type NewCouponPrize = Pick<CouponPrize, 'title' | 'description'> & {
  audience_scope?: CouponPrizeAudience;
  recipient_user_id?: string | null;
  relationship_id?: string | null;
};

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

  async getPrizesForManagement(): Promise<CouponPrize[]> {
    const { data, error } = await supabase
      .from('coupon_prizes')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para proponer un premio.');
    const { data, error } = await supabase
      .from('coupon_prizes')
      .insert({
        title: prize.title.trim(),
        description: prize.description.trim(),
        audience_scope: prize.audience_scope ?? 'realm',
        recipient_user_id: prize.recipient_user_id ?? null,
        relationship_id: prize.relationship_id ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as CouponPrize;
  },

  async updatePrize(prizeId: string, updates: Partial<NewCouponPrize> & { is_active?: boolean }): Promise<CouponPrize> {
    const values: {
      title?: string;
      description?: string;
      is_active?: boolean;
      audience_scope?: CouponPrizeAudience;
      recipient_user_id?: string | null;
      relationship_id?: string | null;
    } = {};
    if (updates.title !== undefined) values.title = updates.title.trim();
    if (updates.description !== undefined) values.description = updates.description.trim();
    if (updates.is_active !== undefined) values.is_active = updates.is_active;
    if (updates.audience_scope !== undefined) values.audience_scope = updates.audience_scope;
    if (updates.recipient_user_id !== undefined) values.recipient_user_id = updates.recipient_user_id;
    if (updates.relationship_id !== undefined) values.relationship_id = updates.relationship_id;

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
    const { error } = await supabase
      .from('coupon_prizes')
      .delete()
      .eq('id', prizeId);

    if (error) {
      throw error;
    }
  },
};
