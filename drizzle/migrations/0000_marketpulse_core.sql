-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- watchlists
CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My Watchlist',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX watchlists_user_idx ON public.watchlists(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlists" ON public.watchlists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- watchlist stocks
CREATE TABLE public.watchlist_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, symbol)
);
CREATE INDEX watchlist_stocks_user_idx ON public.watchlist_stocks(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_stocks TO authenticated;
GRANT ALL ON public.watchlist_stocks TO service_role;
ALTER TABLE public.watchlist_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist stocks" ON public.watchlist_stocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- checkpoints (one row per user: last visit)
CREATE TABLE public.checkpoints (
  user_id uuid PRIMARY KEY,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  previous_checked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoints TO authenticated;
GRANT ALL ON public.checkpoints TO service_role;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkpoint" ON public.checkpoints FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- per-user market snapshots (state at last checkpoint)
CREATE TABLE public.market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  price numeric NOT NULL,
  volume bigint NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
CREATE INDEX market_snapshots_user_idx ON public.market_snapshots(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_snapshots TO authenticated;
GRANT ALL ON public.market_snapshots TO service_role;
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.market_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bootstrap profile + default watchlist with demo symbols
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wl_id uuid;
  sym text;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'investor'), '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.watchlists (user_id, name)
  VALUES (NEW.id, 'My Watchlist')
  RETURNING id INTO wl_id;

  FOREACH sym IN ARRAY ARRAY['RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','ITC']
  LOOP
    INSERT INTO public.watchlist_stocks (watchlist_id, user_id, symbol)
    VALUES (wl_id, NEW.id, sym)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
