-- migration_001.sql
-- Trackboards: share_mode + board_subscriptions
-- Uruchom ręcznie w Supabase SQL Editor

-- 1. Dodaj kolumnę share_mode do boards
ALTER TABLE public.boards
  ADD COLUMN share_mode text
  CHECK (share_mode IN ('read', 'write')) DEFAULT NULL;

-- 2. Migracja istniejących publicznych boardów
UPDATE public.boards SET share_mode = 'write' WHERE share_guid IS NOT NULL;

-- 3. Tabela subskrypcji
CREATE TABLE public.board_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, board_id)
);

ALTER TABLE public.board_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_own"
  ON public.board_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_admin"
  ON public.board_subscriptions FOR ALL
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.board_subscriptions TO authenticated;

-- 4. Nowe polityki boards
DROP POLICY IF EXISTS "boards_select" ON public.boards;
CREATE POLICY "boards_select"
  ON public.boards FOR SELECT
  USING (
    owner_id = auth.uid()
    OR share_mode IS NOT NULL
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "boards_update" ON public.boards;
CREATE POLICY "boards_update"
  ON public.boards FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR share_mode = 'write'
    OR public.is_admin()
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR share_mode = 'write'
    OR public.is_admin()
  );
