-- =====================================================================
-- Coordonnees du vendeur pour le livreur de la course
-- =====================================================================
-- A executer dans Supabase Studio > SQL Editor.
-- Ne contient aucune cle ni secret.
--
-- Probleme : le livreur ne peut lire ni les commandes ni le profil du
-- vendeur (RLS). Resultat, sur son ecran :
--   - le numero du vendeur n'apparaissait jamais ;
--   - le bouton « Vendeur » (messagerie) ne faisait rien.
-- 9 boutiques sur 19 n'ont en plus aucun contact_phone renseigne.
--
-- Plutot que d'ouvrir tout le profil du vendeur au livreur (piece
-- d'identite, adresse...), cette fonction ne renvoie que le strict
-- necessaire, et uniquement au livreur de CETTE course.
-- =====================================================================

create or replace function public.get_delivery_vendor_contact(p_delivery_id uuid)
returns table (vendor_id uuid, shop_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.owner_id,
    s.name,
    -- Le telephone de la boutique s'il existe, sinon celui avec lequel le
    -- vendeur s'est inscrit : tout compte FERE en a un.
    coalesce(nullif(trim(s.contact_phone), ''), nullif(trim(p.contact), ''))
  from public.delivery_requests dr
  join public.orders o on o.id = dr.order_id
  join public.shops s on s.id = o.shop_id
  left join public.profiles p on p.id = s.owner_id
  where dr.id = p_delivery_id
    and (
      dr.driver_id = auth.uid()
      or has_role(auth.uid(), 'admin'::app_role)
      or has_role(auth.uid(), 'super_admin'::app_role)
    );
$$;

revoke all on function public.get_delivery_vendor_contact(uuid) from public;
grant execute on function public.get_delivery_vendor_contact(uuid) to authenticated;
