import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

export interface RealmStatus {
  id: string;
  is_player2_connected: boolean;
  updated_at: string;
}

export const realmStatusService = {
  async getStatus(): Promise<RealmStatus> {
    const { data, error } = await supabase
      .from('realm_status')
      .select('id, is_player2_connected, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('No existe una fila de estado del Realm.');
    return data as RealmStatus;
  },

  async setPlayer2Connected(isConnected: boolean): Promise<RealmStatus> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Solo el administrador puede cambiar el estado del Realm.');
    }

    const current = await this.getStatus();
    const { data, error } = await supabase
      .from('realm_status')
      .update({ is_player2_connected: isConnected, updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .select('id, is_player2_connected, updated_at')
      .single();

    if (error) throw error;
    return data as RealmStatus;
  },
};
