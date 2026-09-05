CREATE TABLE public.change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  watchlist_id uuid REFERENCES public.watchlists(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  level text NOT NULL,
  attention_score integer NOT NULL,
  price numeric NOT NULL,
  change_pct numeric NOT NULL,
  since_check_pct numeric,
  relative_to_nifty numeric NOT NULL,
  volume bigint NOT NULL DEFAULT 0,
  volume_ratio numeric NOT NULL DEFAULT 0,
  headline text NOT NULL,
  why text NOT NULL,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX change_history_user_idx ON public.change_history(user_id, captured_at DESC);
CREATE INDEX change_history_symbol_idx ON public.change_history(user_id, symbol, captured_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_history TO authenticated;
GRANT ALL ON public.change_history TO service_role;
ALTER TABLE public.change_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own change history" ON public.change_history
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
