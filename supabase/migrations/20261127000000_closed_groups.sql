-- Un groupe clôturé n'accepte plus de nouvelles fiches.
-- Les fiches qui y sont déjà restent modifiables par leur auteur (sans changer de groupe).
-- Trigger plutôt que policy : l'appli enregistre par upsert, qui passe par un INSERT
-- même quand la fiche existe déjà ; le trigger peut vérifier si c'est le cas.

create or replace function public.check_group_open()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.group_id is null then return new; end if;
  if not exists (select 1 from public.groups where id = new.group_id and closed_at is not null) then return new; end if;
  -- Modification d'une fiche déjà dans ce groupe : autorisée
  if tg_op = 'UPDATE' and old.group_id is not distinct from new.group_id then return new; end if;
  if tg_op = 'INSERT' and exists (select 1 from public.tastings where id = new.id and group_id = new.group_id) then return new; end if;
  raise exception 'group_closed' using errcode = 'P0001', hint = 'Ce groupe est clôturé.';
end $$;

create trigger tastings_group_open
  before insert or update on public.tastings
  for each row execute function public.check_group_open();
