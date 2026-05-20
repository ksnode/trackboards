-- migration_002.sql
-- Fix: aktualizuj policy boards_insert_anonymous
-- żeby wymagała share_mode (nie tylko share_guid)
-- Uruchom ręcznie w Supabase SQL Editor

DROP POLICY IF EXISTS "boards_insert_anonymous" ON public.boards;
CREATE POLICY "boards_insert_anonymous"
  ON public.boards FOR INSERT
  TO anon
  WITH CHECK (
    owner_id IS NULL
    AND share_guid IS NOT NULL
    AND share_mode IS NOT NULL
  );
