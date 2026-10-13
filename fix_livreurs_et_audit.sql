-- =====================================================================
-- Validation des livreurs + journal des actions administrateur
-- =====================================================================
-- A executer dans Supabase Studio > SQL Editor, en une seule fois.
-- Repond aux points 3 et 6 du retour de test du 27 septembre.
--
-- Ne contient aucune cle ni secret : ce fichier peut rester dans le depot.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Validation des livreurs par l'administrateur
-- ---------------------------------------------------------------------
-- Meme principe que shops.verification_status pour les boutiques.

alter table public.profiles
  add column if not exists driver_status text not null default 'pending',
  add column if not exists driver_status_reason text,
  add column if not exists driver_status_changed_at timestamptz,
  add column if not exists driver_status_changed_by uuid references auth.users(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_driver_status_check') then
    alter table public.profiles
      add constraint profiles_driver_status_check
      check (driver_status in ('pending','approved','rejected','suspended'));
  end if;
end $$;

-- Les livreurs deja en activite ne doivent pas etre coupes par la mise en place.
update public.profiles p
   set driver_status = 'approved',
       driver_status_changed_at = now()
 where p.driver_status = 'pending'
   and exists (
     select 1 from public.user_roles ur
     where ur.user_id = p.id and ur.role = 'livreur'::app_role
   );

create or replace function public.is_approved_driver(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = _user_id and p.driver_status = 'approved'
  );
$$;

revoke all on function public.is_approved_driver(uuid) from public;
grant execute on function public.is_approved_driver(uuid) to authenticated;

-- Un livreur non valide ne voit plus les courses disponibles et ne peut plus en
-- accepter. Il garde l'acces a ses courses en cours (driver_id = auth.uid()) :
-- une suspension ne doit pas laisser une livraison en plan.
drop policy if exists "Drivers can view requests in their zones" on public.delivery_requests;
create policy "Drivers can view requests in their zones"
on public.delivery_requests for select
using (
  (
    status = 'pending'
    and public.is_approved_driver(auth.uid())
    and (
      zone_id in (
        select dz.zone_id from public.driver_zones dz
        where dz.driver_id = auth.uid() and dz.is_active = true
      )
      or zone_id is null
    )
  )
  or driver_id = auth.uid()
  or has_role(auth.uid(), 'super_admin'::app_role)
  or has_role(auth.uid(), 'admin'::app_role)
);

drop policy if exists "Drivers can accept and update requests" on public.delivery_requests;
create policy "Drivers can accept and update requests"
on public.delivery_requests for update
using (
  (
    status = 'pending'
    and public.is_approved_driver(auth.uid())
    and (
      zone_id in (
        select dz.zone_id from public.driver_zones dz
        where dz.driver_id = auth.uid() and dz.is_active = true
      )
      or zone_id is null
    )
  )
  or driver_id = auth.uid()
  or has_role(auth.uid(), 'super_admin'::app_role)
  or has_role(auth.uid(), 'admin'::app_role)
);

-- Seul un administrateur change le statut d'un livreur, et il ne peut pas
-- le faire pour lui-meme.
create or replace function public.set_driver_status(
  p_driver_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'super_admin'::app_role)) then
    raise exception 'Reserve aux administrateurs';
  end if;

  if p_status not in ('pending','approved','rejected','suspended') then
    raise exception 'Statut invalide: %', p_status;
  end if;

  update public.profiles
     set driver_status = p_status,
         driver_status_reason = p_reason,
         driver_status_changed_at = now(),
         driver_status_changed_by = auth.uid()
   where id = p_driver_id;
end;
$$;

revoke all on function public.set_driver_status(uuid, text, text) from public;
grant execute on function public.set_driver_status(uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Journal des actions administrateur
-- ---------------------------------------------------------------------
-- « Qui a valide, modifie ou supprime quoi, et a quelle date. »

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created on public.audit_log (created_at desc);
create index if not exists idx_audit_log_entity on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

-- Journal en lecture seule : il n'existe aucune policy d'ecriture, seuls les
-- declencheurs (security definer) y inscrivent des lignes. Personne ne peut
-- effacer ni retoucher une entree, c'est ce qui en fait une preuve.
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log"
on public.audit_log for select to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
);

create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_changes jsonb;
begin
  if tg_op = 'DELETE' then
    v_entity_id := (to_jsonb(old) ->> 'id')::uuid;
    v_changes := to_jsonb(old);
  else
    v_entity_id := (to_jsonb(new) ->> 'id')::uuid;

    if tg_op = 'UPDATE' then
      -- On ne garde que les champs reellement modifies : un journal lisible
      -- vaut mieux qu'une copie complete de chaque ligne.
      select jsonb_object_agg(
               key,
               jsonb_build_object('avant', to_jsonb(old) -> key, 'apres', value)
             )
        into v_changes
        from jsonb_each(to_jsonb(new))
       where to_jsonb(old) -> key is distinct from value;

      if v_changes is null then
        return new;
      end if;
    else
      v_changes := to_jsonb(new);
    end if;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_changes);

  return coalesce(new, old);
end;
$$;

-- profiles : uniquement les colonnes sensibles. Un declencheur sur toute la
-- table enregistrerait chaque position GPS de chaque livreur, plusieurs fois
-- par minute.
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
after update of driver_status, is_blocked on public.profiles
for each row execute function public.record_audit();

drop trigger if exists trg_audit_shops on public.shops;
create trigger trg_audit_shops
after update of verification_status on public.shops
for each row execute function public.record_audit();

drop trigger if exists trg_audit_user_roles on public.user_roles;
create trigger trg_audit_user_roles
after insert or update or delete on public.user_roles
for each row execute function public.record_audit();

drop trigger if exists trg_audit_platform_settings on public.platform_settings;
create trigger trg_audit_platform_settings
after update on public.platform_settings
for each row execute function public.record_audit();

drop trigger if exists trg_audit_category_commissions on public.category_commissions;
create trigger trg_audit_category_commissions
after insert or update or delete on public.category_commissions
for each row execute function public.record_audit();


-- ---------------------------------------------------------------------
-- 3. Verifications
-- ---------------------------------------------------------------------
-- Statut des livreurs :
--   select p.nom_complet, p.driver_status
--   from profiles p join user_roles ur on ur.user_id = p.id
--   where ur.role = 'livreur' order by p.driver_status;
--
-- Le journal enregistre bien (modifier un taux de commission puis) :
--   select actor_id, action, entity_type, changes, created_at
--   from audit_log order by created_at desc limit 10;
