-- migration: create feed_events for reliable realtime delivery of new publications

CREATE TABLE IF NOT EXISTS public.feed_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only keep a short history; consumer can ignore or purge older rows if desired
CREATE INDEX IF NOT EXISTS idx_feed_events_created_at ON public.feed_events(created_at DESC);

-- Trigger function to insert feed_event after a public publication is inserted
CREATE OR REPLACE FUNCTION public.notify_feed_on_publication() RETURNS trigger AS $$
BEGIN
  -- Only emit events for public, non-deleted publications
  IF NEW.is_deleted = FALSE AND NEW.visibility = 'public' THEN
    INSERT INTO public.feed_events (publication_id, created_at) VALUES (NEW.id, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_feed_on_publication ON public.publications;
CREATE TRIGGER trg_notify_feed_on_publication
  AFTER INSERT ON public.publications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_feed_on_publication();

-- Enable RLS on feed_events and allow authenticated users to select events
ALTER TABLE IF EXISTS public.feed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feed_events" ON public.feed_events;
CREATE POLICY "Anyone can read feed_events"
ON public.feed_events FOR SELECT
USING (true);

-- Allow authenticated users (and therefore triggers fired by authenticated inserts)
-- to insert feed events. This prevents the publication INSERT transaction from
-- failing when the trigger tries to write to feed_events due to RLS.
DROP POLICY IF EXISTS "Authenticated can insert feed_events" ON public.feed_events;
CREATE POLICY "Authenticated can insert feed_events"
ON public.feed_events FOR INSERT
TO authenticated
WITH CHECK (true);
