create or replace function public.__debug_constraints()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'constraints', (
      select coalesce(json_agg(json_build_object(
        'table', conrelid::regclass::text, 'name', conname, 'type', contype, 'def', pg_get_constraintdef(oid)
      )), '[]'::json)
      from pg_constraint
      where connamespace = 'public'::regnamespace
    ),
    'indexes', (
      select coalesce(json_agg(json_build_object(
        'table', tablename, 'name', indexname, 'def', indexdef
      )), '[]'::json)
      from pg_indexes where schemaname = 'public'
    )
  );
$$;
grant execute on function public.__debug_constraints() to anon;
