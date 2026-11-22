-- Ejecutar UNA vez en Supabase > SQL Editor. Registro de sustituciones en los recreos (patio arriba / patio abajo)
create table if not exists recreos_sustituciones (
  id bigint generated always as identity primary key,
  fecha date not null,
  patio text not null,                 -- 'arriba' | 'abajo'
  profesor_id bigint not null references profesores(id) on delete cascade,  -- quien sustituye
  sustituye_a text,                    -- nombre de quien falta (puede ser alguien que no está en la tabla de profesores)
  created_at timestamptz default now()
);
alter table recreos_sustituciones enable row level security;
drop policy if exists "app_all" on recreos_sustituciones;
create policy "app_all" on recreos_sustituciones for all using (true) with check (true);
