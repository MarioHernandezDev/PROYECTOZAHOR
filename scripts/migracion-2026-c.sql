-- Ejecutar UNA vez en Supabase > SQL Editor. Registro de servicios de sustitución (8-9 y 13:30-14:30)
alter table profesores add column if not exists participa_servicios boolean default false;
update profesores set participa_servicios = true
  where nombre in ('Guillermo','Yolanda','Tere','Bibiana','Fany','Belén','Alicia');

create table if not exists servicios_sustitucion (
  id bigint generated always as identity primary key,
  fecha date not null,
  franja text not null,                -- '8-9' | '13.30-14.30'
  profesor_id bigint not null references profesores(id) on delete cascade,
  nota text,
  created_at timestamptz default now()
);
alter table servicios_sustitucion enable row level security;
drop policy if exists "app_all" on servicios_sustitucion;
create policy "app_all" on servicios_sustitucion for all using (true) with check (true);

-- Añadido después: a quién se sustituye en cada servicio
alter table servicios_sustitucion add column if not exists sustituye_a_id bigint references profesores(id) on delete set null;
