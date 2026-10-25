ALTER TABLE public.diary_cards
  ADD COLUMN notes text,
  ADD COLUMN done boolean NOT NULL DEFAULT false,
  ADD COLUMN assignee text,
  ADD COLUMN repeat text;