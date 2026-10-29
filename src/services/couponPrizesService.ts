import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';
import { InputValidationError, sanitizePlainText, validateAudience, validateUuid } from '../utils/validation';

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
    validateUuid(user.id, 'La cuenta');
    const audienceScope = prize.audience_scope ?? 'realm';
    const recipientUserId = prize.recipient_user_id ?? null;
    const relationshipId = prize.relationship_id ?? null;
    validateAudience(audienceScope, recipientUserId, relationshipId);
    const { data, error } = await supabase
      .from('coupon_prizes')
      .insert({
        title: sanitizePlainText(prize.title, 'El título', 80),
        description: sanitizePlainText(prize.description, 'La descripción', 2000),
        audience_scope: audienceScope,
        recipient_user_id: recipientUserId,
        relationship_id: relationshipId,
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
    validateUuid(prizeId, 'El premio');
    const values: {
      title?: string;
      description?: string;
      is_active?: boolean;
      audience_scope?: CouponPrizeAudience;
      recipient_user_id?: string | null;
      relationship_id?: string | null;
    } = {};
    if (updates.title !== undefined) values.title = sanitizePlainText(updates.title, 'El título', 80);
    if (updates.description !== undefined) values.description = sanitizePlainText(updates.description, 'La descripción', 2000);
    if (updates.is_active !== undefined) values.is_active = updates.is_active;
    if (updates.audience_scope !== undefined) {
      validateAudience(updates.audience_scope, updates.recipient_user_id, updates.relationship_id);
      values.audience_scope = updates.audience_scope;
      values.recipient_user_id = updates.recipient_user_id ?? null;
      values.relationship_id = updates.relationship_id ?? null;
    } else {
      if (updates.recipient_user_id !== undefined || updates.relationship_id !== undefined) {
        throw new InputValidationError('Selecciona una audiencia para cambiar el destinatario.');
      }
    }

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
    validateUuid(prizeId, 'El premio');
    const { error } = await supabase
      .from('coupon_prizes')
      .delete()
      .eq('id', prizeId);

    if (error) {
      throw error;
    }
  },
};
