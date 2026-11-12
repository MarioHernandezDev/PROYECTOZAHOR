-- Ejecutar UNA vez en Supabase > SQL Editor > New query > Run
alter table profesores add column if not exists telefono text;
alter table profesores add column if not exists nombre_completo text;
alter table clases     add column if not exists nota text;

-- Por si RLS está activado: permitir leer y escribir con la clave pública (app privada)
-- (si ya funciona, estas líneas no estorban)
do $$
declare t text;
begin
  foreach t in array array['profesores','cursos','asignaturas','tramos_horarios','clases'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "app_all" on %I', t);
    execute format('create policy "app_all" on %I for all using (true) with check (true)', t);
  end loop;
end $$;
