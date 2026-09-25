alter table public.process_element_metadata
  add column if not exists comment text;
