-- Migration: add RPC to increment publication play counts reliably
CREATE OR REPLACE FUNCTION public.increment_publication_play_count(publication_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE publications
  SET plays_count = GREATEST(0, COALESCE(plays_count, 0) + 1)
  WHERE id = publication_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_publication_play_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_publication_play_count(UUID) TO anon;
