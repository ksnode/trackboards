-- migration_003.sql
-- Fix adopt_orphan_board RPC: only set owner_id, preserve share_mode and share_guid

CREATE OR REPLACE FUNCTION public.adopt_orphan_board(board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.boards
  SET owner_id = auth.uid()
  WHERE id = board_id
    AND owner_id IS NULL;
END;
$$;
