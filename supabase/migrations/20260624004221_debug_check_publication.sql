create or replace function public.__debug_pub() returns json language sql security definer as $$
  select coalesce(json_agg(json_build_object('schema',schemaname,'table',tablename)), '[]'::json)
  from pg_publication_tables where pubname='supabase_realtime';
$$;
grant execute on function public.__debug_pub() to anon;
