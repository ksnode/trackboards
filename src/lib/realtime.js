import { supabase } from './supabase';

let boardChannel = null;
let listChannel = null;

/**
 * Subscribe to realtime changes on a specific board.
 * Works for both authenticated and anonymous users (uses anon key).
 * Returns an unsubscribe function.
 */
export const subscribeToBoardChanges = (boardId, onUpdate) => {
  // Clean up previous channel fully before creating new one
  if (boardChannel) {
    boardChannel.unsubscribe();
    supabase.removeChannel(boardChannel);
    boardChannel = null;
  }

  boardChannel = supabase
    .channel(`board-${boardId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'boards',
        filter: `id=eq.${boardId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();

  return () => {
    if (boardChannel) {
      boardChannel.unsubscribe();
      supabase.removeChannel(boardChannel);
      boardChannel = null;
    }
  };
};

/**
 * Subscribe to realtime changes on the boards table (any row).
 * Useful for refreshing board lists.
 * Returns an unsubscribe function.
 */
export const subscribeToBoardList = (onUpdate) => {
  // Clean up previous list channel
  if (listChannel) {
    listChannel.unsubscribe();
    supabase.removeChannel(listChannel);
    listChannel = null;
  }

  listChannel = supabase
    .channel(`boards-list-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'boards',
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    if (listChannel) {
      listChannel.unsubscribe();
      supabase.removeChannel(listChannel);
      listChannel = null;
    }
  };
};
