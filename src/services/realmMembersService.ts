import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

export interface RealmMember {
  user_id: string;
  joined_at: string;
  username: string;
  country: string;
  avatar_url: string | null;
}

export interface RealmInvitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
}

export interface RealmRegisteredUser {
  user_id: string;
  username: string;
  email: string;
  country: string;
  avatar_url: string | null;
  role: 'admin' | 'player';
  is_member: boolean;
}

export type RealmInviteResult =
  | { kind: 'member'; email: string; alreadyMember: boolean }
  | { kind: 'invitation'; invitation: RealmInvitation; alreadyInvited: boolean };

async function assertAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Solo el administrador puede gestionar invitaciones y miembros.');
  }
}

export const realmMembersService = {
  async getRegisteredUsers(): Promise<RealmRegisteredUser[]> {
    await assertAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const [{ data: profiles, error: profilesError }, { data: members, error: membersError }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('realm_members').select('user_id'),
    ]);

    if (profilesError) throw profilesError;
    if (membersError) throw membersError;

    const memberIds = new Set(members.map((member) => member.user_id));
    const currentEmail = user?.email?.toLowerCase() ?? '';

    return profiles.map((profile) => {
      const email = typeof profile.email === 'string'
        ? profile.email
        : profile.id === user?.id ? currentEmail : '';
      const isAdmin = profile.id === user?.id || email.toLowerCase() === ADMIN_EMAIL;
      const role: RealmRegisteredUser['role'] = isAdmin ? 'admin' : 'player';

      return {
        user_id: profile.id,
        username: profile.username?.trim() || 'Jugador',
        email,
        country: profile.country?.trim() || '',
        avatar_url: profile.avatar_url ?? null,
        role,
        is_member: memberIds.has(profile.id),
      };
    }).sort((left, right) => {
      if (left.role === 'admin') return -1;
      if (right.role === 'admin') return 1;
      return left.username.localeCompare(right.username, 'es');
    });
  },

  async getMembers(): Promise<RealmMember[]> {
    const { data: members, error } = await supabase
      .from('realm_members')
      .select('user_id, joined_at')
      .order('joined_at', { ascending: true });

    if (error) throw error;
    if (!members.length) return [];

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, country, avatar_url')
      .in('id', members.map((member) => member.user_id));

    if (profilesError) throw profilesError;
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

    return members.map((member) => {
      const profile = profilesById.get(member.user_id);
      return {
        user_id: member.user_id,
        joined_at: member.joined_at,
        username: profile?.username?.trim() || 'Jugador',
        country: profile?.country?.trim() || '',
        avatar_url: profile?.avatar_url ?? null,
      };
    });
  },

  async getMyPendingInvitations(email: string): Promise<RealmInvitation[]> {
    const { data, error } = await supabase
      .from('realm_invitations')
      .select('id, email, status, created_at')
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as RealmInvitation[];
  },

  async getInvitationsForAdmin(): Promise<RealmInvitation[]> {
    await assertAdmin();
    const { data, error } = await supabase
      .from('realm_invitations')
      .select('id, email, status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as RealmInvitation[];
  },

  async invite(email: string): Promise<RealmInviteResult> {
    await assertAdmin();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Escribe un correo electrónico válido.');
    }

    const registeredUsers = await this.getRegisteredUsers();
    const registeredUser = registeredUsers.find((registered) => registered.email.toLowerCase() === normalizedEmail);
    if (registeredUser) {
      const alreadyMember = registeredUser.is_member;
      await this.setMemberEnabled(registeredUser.user_id, true);
      return {
        kind: 'member',
        email: normalizedEmail,
        alreadyMember,
      };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Debes iniciar sesión para enviar una invitación.');

    const { data: existingInvitation, error: existingInvitationError } = await supabase
      .from('realm_invitations')
      .select('id, email, status, created_at')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingInvitationError) throw existingInvitationError;
    if (existingInvitation) {
      return {
        kind: 'invitation',
        invitation: {
          id: existingInvitation.id,
          email: existingInvitation.email,
          status: existingInvitation.status,
          created_at: existingInvitation.created_at,
        },
        alreadyInvited: true,
      };
    }

    const { data: invitation, error: inviteError } = await supabase
      .from('realm_invitations')
      .insert({ email: normalizedEmail, invited_by: user.id })
      .select('id, email, status, created_at')
      .single();
    if (inviteError) throw inviteError;

    return {
      kind: 'invitation',
      invitation: invitation as RealmInvitation,
      alreadyInvited: false,
    };
  },

  async setMemberEnabled(userId: string, isEnabled: boolean): Promise<void> {
    await assertAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Debes iniciar sesión para gestionar miembros.');
    if (!isEnabled && user.id === userId) {
      throw new Error('No puedes quitar tu propia cuenta del Realm.');
    }

    if (isEnabled) {
      const { data: existingMember, error: lookupError } = await supabase
        .from('realm_members')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existingMember) return;

      const { error: insertError } = await supabase
        .from('realm_members')
        .insert([{ user_id: userId, invited_by: user.id }]);
      if (insertError?.code === '23505') return;
      if (insertError) throw insertError;
      return;
    }

    const { error } = await supabase
      .from('realm_members')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },

  async acceptInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase.rpc('accept_realm_invitation', {
      p_invitation_id: invitationId,
    });
    if (error) throw error;
  },

  async revokeInvitation(invitationId: string): Promise<void> {
    await assertAdmin();
    const { error } = await supabase
      .from('realm_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      .eq('status', 'pending');

    if (error) throw error;
  },

  async removeMember(userId: string): Promise<void> {
    await this.setMemberEnabled(userId, false);
  },

  subscribe(onChange: () => void) {
    return supabase
      .channel('realm_members_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'realm_members' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'realm_invitations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
      .subscribe();
  },

  unsubscribe(channel: RealtimeChannel) {
    return supabase.removeChannel(channel);
  },
};
