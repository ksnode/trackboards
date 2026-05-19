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
  // Check if it's a valid UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrGuid);

  if (isUuid) {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('id', idOrGuid)
      .maybeSingle();
    if (data) return data;
  }

  // If not UUID or not found by id, try share_guid
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('share_guid', idOrGuid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Board not found');
  return data;
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

export const softDeleteBoard = async (id) => {
  return handleResponse(
    await supabase
      .from('boards')
      .update({ deleted_at: new Date().toISOString() })
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

export const togglePublic = async (id, makePublic) => {
  const share_guid = makePublic ? crypto.randomUUID() : null;
  return handleResponse(
    await supabase
      .from('boards')
      .update({ share_guid })
      .eq('id', id)
  );
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
