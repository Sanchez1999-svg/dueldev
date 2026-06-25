-- Temporary introspection helper, dropped in the next migration.
create or replace function public.__debug_introspect()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'policies', (
      select coalesce(json_agg(json_build_object(
        'table', tablename, 'policy', policyname, 'cmd', cmd,
        'roles', roles, 'qual', qual, 'with_check', with_check
      )), '[]'::json)
      from pg_policies where schemaname = 'public'
    ),
    'rls_enabled', (
      select coalesce(json_agg(json_build_object('table', relname, 'rls', relrowsecurity)), '[]'::json)
      from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
    ),
    'functions', (
      select coalesce(json_agg(json_build_object(
        'name', p.proname, 'args', pg_get_function_arguments(p.oid),
        'def', pg_get_functiondef(p.oid)
      )), '[]'::json)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ),
    'triggers', (
      select coalesce(json_agg(json_build_object(
        'table', c.relname, 'trigger', t.tgname, 'def', pg_get_triggerdef(t.oid)
      )), '[]'::json)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      where not t.tgisinternal and c.relnamespace = 'public'::regnamespace
    ),
    'columns', (
      select coalesce(json_agg(json_build_object(
        'table', table_name, 'column', column_name, 'type', data_type,
        'nullable', is_nullable, 'default', column_default
      )), '[]'::json)
      from information_schema.columns
      where table_schema = 'public'
    )
  );
$$;

grant execute on function public.__debug_introspect() to anon;
