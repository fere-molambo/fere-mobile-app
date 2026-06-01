/*
  # Supprimer la politique INSERT client sur pending_payments

  ## Contexte
  La sauvegarde des pending_payments est desormais effectuee directement
  par la Edge Function orange-money-payment via le SUPABASE_SERVICE_ROLE_KEY,
  lors de l'action "initialize". Cela elimine la dependance a la session JWT
  du client pour cette etape, et resout l'erreur "invalid authentication" que
  les utilisateurs rencontrent lorsque leur session expire ou n'est pas encore
  restauree (ex: apres un retour d'arriere-plan sur Android).

  ## Changements
  1. Suppression de la politique INSERT "Users can insert own pending payments"
     - Les clients ne peuvent plus inserer directement dans cette table
     - Seule la Edge Function (service role) peut inserer des pending_payments

  ## Securite
  - La politique DELETE reste active : les utilisateurs peuvent toujours
    supprimer leurs propres entrees via auth.uid() = user_id
  - La politique SELECT reste ouverte par reference (migration precedente)
  - La table reste protegee par RLS
*/

DROP POLICY IF EXISTS "Users can insert own pending payments" ON pending_payments;
