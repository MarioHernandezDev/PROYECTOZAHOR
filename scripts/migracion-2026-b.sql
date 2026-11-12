-- Ejecutar UNA vez en Supabase > SQL Editor. Permite marcar qué materias "pueden sustituir" (guardia, etc.)
alter table asignaturas add column if not exists sustituye boolean default false;
update asignaturas set sustituye = true where codigo in ('GUARDIA','RP','TDE','STEAM','55','CORD');
