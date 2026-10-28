import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { ADMIN_EMAIL } from '../config/roles';

export interface RealmMember {
  user_id: string;
  joined_at: string;
  username: string;
  country: string;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  custom_status: string | null;
  badge: string | null;
}

export interface RealmRelationship {
  id: string;
  initiator_id: string;
  partner_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  created_at: string;
  accepted_at: string | null;
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
      supabase.from('admin_registered_profiles').select('*'),
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
      .select('id, username, country, avatar_url, bio, banner_url, custom_status, badge')
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
        bio: profile?.bio ?? null,
        banner_url: profile?.banner_url ?? null,
        custom_status: profile?.custom_status ?? null,
        badge: profile?.badge ?? null,
      };
    });
  },

  async getHiddenMapMemberIds(): Promise<Set<string>> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) return new Set();

    const { data, error } = await supabase
      .from('realm_map_hidden_members')
      .select('member_id')
      .eq('viewer_id', user.id);
    if (error) throw error;
    return new Set(data.map((row) => row.member_id));
  },

  async setMapMemberVisibility(memberId: string, visible: boolean): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Inicia sesión para personalizar tu mapa.');
    if (memberId === user.id) throw new Error('Tu perfil siempre aparece en el mapa.');

    if (visible) {
      const { error } = await supabase
        .from('realm_map_hidden_members')
        .delete()
        .eq('viewer_id', user.id)
        .eq('member_id', memberId);
      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from('realm_map_hidden_members')
      .upsert({ viewer_id: user.id, member_id: memberId }, { onConflict: 'viewer_id,member_id', ignoreDuplicates: true });
    if (error) throw error;
  },

  async getMyRelationships(): Promise<RealmRelationship[]> {
    const { data, error } = await supabase
      .from('realm_relationships')
      .select('id, initiator_id, partner_id, status, created_at, accepted_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as RealmRelationship[];
  },

  async invitePartner(partnerId: string): Promise<void> {
    const { error } = await supabase.rpc('invite_realm_partner', {
      p_partner_id: partnerId,
    });
    if (error) throw error;
  },

  async respondToPartnerInvitation(relationshipId: string, response: 'accepted' | 'declined'): Promise<void> {
    const { error } = await supabase.rpc('respond_realm_relationship', {
      p_relationship_id: relationshipId,
      p_response: response,
    });
    if (error) throw error;
  },

  async endRelationship(relationshipId: string): Promise<void> {
    const { error } = await supabase.rpc('end_realm_relationship', {
      p_relationship_id: relationshipId,
    });
    if (error) throw error;
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

  async setMemberEnabled(userId: string, isEnabled: boolean): Promise<string | null> {
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
      if (existingMember) return null;

      const { error: insertError } = await supabase
        .from('realm_members')
        .insert([{ user_id: userId, invited_by: user.id }]);
      if (insertError?.code === '23505') return null;
      if (insertError) throw insertError;
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw profileError;
    const { data: removedContent, error } = await supabase.rpc('admin_remove_realm_member', { p_user_id: userId });
    if (error) throw error;

    const content = removedContent as { gift_paths?: unknown; timeline_paths?: unknown } | null;
    const giftPaths = Array.isArray(content?.gift_paths)
      ? content.gift_paths.filter((path): path is string => typeof path === 'string')
      : [];
    const timelinePaths = Array.isArray(content?.timeline_paths)
      ? content.timeline_paths.filter((path): path is string => typeof path === 'string')
      : [];
    const storageCleanupErrors: string[] = [];
    const storageDeletes: Array<{ bucket: string; paths: string[] }> = [];
    if (giftPaths.length) storageDeletes.push({ bucket: 'gift-attachments', paths: giftPaths });
    if (timelinePaths.length) storageDeletes.push({ bucket: 'realm-timeline-images', paths: timelinePaths });
    const avatarUrl = profile?.avatar_url;
    if (typeof avatarUrl === 'string') {
      const marker = '/profile-avatars/';
      const markerIndex = avatarUrl.indexOf(marker);
      if (markerIndex >= 0) {
        try {
          const path = decodeURIComponent(avatarUrl.slice(markerIndex + marker.length).split(/[?#]/, 1)[0]);
          storageDeletes.push({ bucket: 'profile-avatars', paths: [path] });
        } catch (pathError) {
          console.error('El miembro se quitó, pero no se pudo interpretar la ruta de su avatar:', pathError);
          storageCleanupErrors.push('profile-avatars');
        }
      }
    }

    for (const { bucket, paths } of storageDeletes) {
      const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
      if (storageError) {
        console.error(`El miembro se quitó, pero falló la limpieza del bucket ${bucket}:`, storageError);
        storageCleanupErrors.push(bucket);
      }
    }
    return storageCleanupErrors.length
      ? `El usuario se quitó del Realm, pero no se pudieron limpiar algunos archivos de Storage (${[...new Set(storageCleanupErrors)].join(', ')}).`
      : null;
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
