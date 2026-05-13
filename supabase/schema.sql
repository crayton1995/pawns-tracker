-- ============================================================
-- PAWNS REPLAYS — Supabase Schema
-- Paste this entire file into the Supabase SQL Editor and run it
-- Project: pawns-replays
-- ============================================================

-- ─── PROFILES ───────────────────────────────────────────────
-- Extends Supabase Auth users with display info and roles
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role        TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  invited_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── REPLAYS ────────────────────────────────────────────────
CREATE TABLE public.replays (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Player 1 (the recorder — always a registered user)
  player1_id        UUID    REFERENCES public.profiles(id),
  player1_username  TEXT    NOT NULL,
  player1_leader    TEXT,
  player1_base      TEXT,
  player1_deck_name TEXT,
  -- Player 2 (may or may not be a registered user)
  player2_id        UUID    REFERENCES public.profiles(id),
  player2_username  TEXT    NOT NULL,
  player2_leader    TEXT,
  player2_base      TEXT,
  player2_deck_name TEXT,
  -- Result
  winner_username   TEXT,
  game_format       TEXT,   -- 'Premier Best-of-One', 'Premier Best-of-Three', etc.
  -- Game data
  actions           JSONB   NOT NULL DEFAULT '[]',  -- full action log array
  game_id           TEXT,   -- Karabast's internal game ID
  -- Sharing
  share_token       TEXT    UNIQUE DEFAULT encode(gen_random_bytes(12), 'base64url'),
  is_public         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Meta
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by player
CREATE INDEX idx_replays_player1 ON public.replays(player1_id);
CREATE INDEX idx_replays_player2 ON public.replays(player2_id);
CREATE INDEX idx_replays_share_token ON public.replays(share_token);
CREATE INDEX idx_replays_created_at ON public.replays(created_at DESC);

-- ─── COMMENTS ───────────────────────────────────────────────
CREATE TABLE public.comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  replay_id     UUID NOT NULL REFERENCES public.replays(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.profiles(id),
  parent_id     UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body          TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
  action_index  INT,  -- links comment to a specific moment in the replay timeline
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_replay ON public.comments(replay_id);
CREATE INDEX idx_comments_author ON public.comments(author_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── COLLECTIONS ────────────────────────────────────────────
CREATE TABLE public.collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES public.profiles(id),
  name        TEXT NOT NULL,
  description TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.collection_replays (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  replay_id     UUID NOT NULL REFERENCES public.replays(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, replay_id)
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_replays ENABLE ROW LEVEL SECURITY;

-- Helper: is current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: can current user view this replay?
CREATE OR REPLACE FUNCTION public.can_view_replay(replay_row public.replays)
RETURNS BOOLEAN AS $$
  SELECT
    replay_row.is_public = TRUE
    OR replay_row.player1_id = auth.uid()
    OR replay_row.player2_id = auth.uid()
    OR public.is_admin();
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT USING (TRUE);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (id = auth.uid());

-- REPLAYS policies
CREATE POLICY "Users can view their own or public replays"
  ON public.replays FOR SELECT
  USING (
    is_public = TRUE
    OR player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Users can insert their own replays"
  ON public.replays FOR INSERT
  WITH CHECK (player1_id = auth.uid());

CREATE POLICY "Users can update their own replays"
  ON public.replays FOR UPDATE
  USING (player1_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete their own replays"
  ON public.replays FOR DELETE
  USING (player1_id = auth.uid() OR public.is_admin());

-- COMMENTS policies
CREATE POLICY "Comments visible if replay is visible"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.replays r
      WHERE r.id = replay_id
        AND (r.is_public OR r.player1_id = auth.uid() OR r.player2_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Logged-in users can add comments to visible replays"
  ON public.comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.replays r
      WHERE r.id = replay_id
        AND (r.is_public OR r.player1_id = auth.uid() OR r.player2_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  USING (author_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  USING (author_id = auth.uid() OR public.is_admin());

-- COLLECTIONS policies
CREATE POLICY "Users can view their own or public collections"
  ON public.collections FOR SELECT
  USING (is_public = TRUE OR owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can manage their own collections"
  ON public.collections FOR ALL
  USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Collection replays follow collection visibility"
  ON public.collection_replays FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_id
        AND (c.is_public OR c.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Collection owners can manage their collection replays"
  ON public.collection_replays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_id AND (c.owner_id = auth.uid() OR public.is_admin())
    )
  );

-- ─── SHARE TOKEN LOOKUP (public, no auth required) ──────────
-- Allows /share/:token pages to load without login
CREATE OR REPLACE FUNCTION public.get_replay_by_token(token TEXT)
RETURNS SETOF public.replays AS $$
  SELECT * FROM public.replays WHERE share_token = token AND is_public = TRUE;
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── FIRST ADMIN ────────────────────────────────────────────
-- After running this schema, run this separately with your user's UUID
-- to make yourself admin (get your UUID from Supabase Auth > Users):
--
--   UPDATE public.profiles SET role = 'admin' WHERE id = '<your-uuid-here>';
