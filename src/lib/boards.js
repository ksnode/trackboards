import { supabase } from './supabase';

const handleResponse = ({ data, error }) => {
  if (error) {
    console.error('Supabase error:', error);
    throw error;
  }
  return data;
};

export const listMyBoards = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return handleResponse(
    await supabase
      .from('boards')
      .select('*')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
  );
};

export const listMyPurgatory = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return handleResponse(
    await supabase
      .from('boards')
      .select('*')
      .eq('owner_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
  );
};

export const getBoard = async (idOrGuid) => {
  // Check if it's a valid UUID format
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrGuid);

  if (isUuid) {
    // Try by id first — RLS ensures only owner/admin can see private boards
    const { data: byId } = await supabase
      .from('boards')
      .select('*')
      .eq('id', idOrGuid)
      .maybeSingle();
    if (byId) return byId;

    // Then try by share_guid
    const { data: byGuid, error } = await supabase
      .from('boards')
      .select('*')
      .eq('share_guid', idOrGuid)
      .maybeSingle();
    if (error) throw error;
    if (byGuid) return byGuid;
  } else {
    // Non-UUID string — can only be share_guid
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('share_guid', idOrGuid)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  throw new Error('Board not found');
};

export const createBoardAuthenticated = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  return handleResponse(
    await supabase
      .from('boards')
      .insert({
        owner_id: user.id,
        title: 'Nowy board',
      })
      .select()
      .single()
  );
};

export const createBoardAnonymous = async () => {
  const shareGuid = crypto.randomUUID();
  const { data, error } = await supabase
    .from('boards')
    .insert({
      owner_id: null,
      share_guid: shareGuid,
      share_mode: 'write',
      title: 'Nowy board',
      data: { modules: [] },
      progress: { states: {}, collapsed: {} },
    })
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) throw new Error('Failed to create anonymous board (RLS may block anon inserts)');
  return data;
};

export const updateBoardData = async (id, data, progress) => {
  return handleResponse(
    await supabase
      .from('boards')
      .update({ data, progress })
      .eq('id', id)
  );
};

export const updateBoardMeta = async (id, fields) => {
  return handleResponse(
    await supabase
      .from('boards')
      .update(fields)
      .eq('id', id)
  );
};

export const softDeleteBoard = async (id, ownerId) => {
  const updates = { deleted_at: new Date().toISOString() };
  if (ownerId !== null && ownerId !== undefined) {
    updates.share_mode = null;
    updates.share_guid = null;
  }
  return handleResponse(
    await supabase
      .from('boards')
      .update(updates)
      .eq('id', id)
  );
};

export const restoreBoard = async (id) => {
  return handleResponse(
    await supabase
      .from('boards')
      .update({ deleted_at: null })
      .eq('id', id)
  );
};

export const hardDeleteBoard = async (id) => {
  return handleResponse(
    await supabase
      .from('boards')
      .delete()
      .eq('id', id)
  );
};

export const toggleShareMode = async (id, mode, currentShareGuid) => {
  const share_guid = mode === null
    ? null
    : (currentShareGuid ?? crypto.randomUUID());
  return handleResponse(
    await supabase
      .from('boards')
      .update({ share_mode: mode, share_guid })
      .eq('id', id)
  );
};

export const listSubscribedBoards = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return handleResponse(
    await supabase
      .from('board_subscriptions')
      .select('*, boards(*)')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
  );
};

export const subscribeToBoard = async (boardId) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  return handleResponse(
    await supabase
      .from('board_subscriptions')
      .upsert({ user_id: user.id, board_id: boardId }, { onConflict: 'user_id,board_id' })
  );
};

export const unsubscribeFromBoard = async (boardId) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  return handleResponse(
    await supabase
      .from('board_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('board_id', boardId)
  );
};

export const parseBoardGuidFromUrl = (url) => {
  try {
    const match = url.match(
      /board\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i
    );
    return match ? match[1] : null;
  } catch { return null; }
};

export const adoptOrphanBoard = async (boardId) => {
  return handleResponse(
    await supabase.rpc('adopt_orphan_board', { board_id: boardId })
  );
};

// Admin endpoints
export const listAnonymousBoards = async () => {
  return handleResponse(
    await supabase
      .from('boards')
      .select('*')
      .is('owner_id', null)
      .order('created_at', { ascending: false })
  );
};

export const listUsers = async () => {
  return handleResponse(
    await supabase
      .from('profiles')
      .select('*, boards(count)')
      .order('created_at', { ascending: false })
  );
};

export const listUserBoards = async (userId) => {
  return handleResponse(
    await supabase
      .from('boards')
      .select('*')
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .order('position', { ascending: true })
  );
};

export const listUserPurgatory = async (userId) => {
  return handleResponse(
    await supabase
      .from('boards')
      .select('*')
      .eq('owner_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
  );
};

export const updateUserRole = async (userId, role) => {
  return handleResponse(
    await supabase
      .from('profiles')
      .update({ role })
      .eq('user_id', userId)
  );
};

export const toggleUserActive = async (userId, isActive) => {
  return handleResponse(
    await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('user_id', userId)
  );
};

export const assignOrphanToUser = async (boardId, userId) => {
  // Using generic update since there's no specific RPC provided, 
  // RLS will check if current user is admin
  return handleResponse(
    await supabase
      .from('boards')
      .update({ owner_id: userId, share_guid: null })
      .eq('id', boardId)
  );
};
