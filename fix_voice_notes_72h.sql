-- =====================================================================
-- Notes vocales : purge automatique 72h apres la premiere ecoute
-- =====================================================================
-- A executer dans Supabase Studio > SQL Editor.
--
-- PREREQUIS : deployer d'abord l'edge function
--   supabase functions deploy cleanup-expired-voice-notes
--
-- La colonne messages.listened_at et son index sont DEJA appliques.
-- Ce fichier ajoute : la RPC de marquage + le cron horaire de purge.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RPC : le destinataire horodate sa premiere ecoute
-- ---------------------------------------------------------------------
-- La policy UPDATE sur messages n'autorise que l'expediteur
-- (sender_id = auth.uid()), donc le destinataire ne peut pas ecrire
-- listened_at directement. On passe par une fonction SECURITY DEFINER
-- qui verifie qu'il est bien participant de la conversation.

create or replace function public.mark_voice_note_listened(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages m
     set listened_at = now()
   where m.id = p_message_id
     and m.media_type = 'audio'
     and m.listened_at is null
     and m.sender_id <> auth.uid()
     and public.is_conversation_participant(auth.uid(), m.conversation_id);
end;
$$;

revoke all on function public.mark_voice_note_listened(uuid) from public;
grant execute on function public.mark_voice_note_listened(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Cron horaire : appelle l'edge function de purge
-- ---------------------------------------------------------------------
-- IMPORTANT : remplacer les DEUX valeurs ci-dessous avant d'executer.
--   <PROJECT_REF>       -> jajfuajmkjulujnwfqen
--   <SERVICE_ROLE_KEY>  -> Settings > API > service_role (secret)
--
-- La service_role key donne un acces total a la base : ne la partager
-- avec personne et ne pas la committer dans git.

select cron.unschedule('purge-voice-notes')
where exists (select 1 from cron.job where jobname = 'purge-voice-notes');

select cron.schedule(
  'purge-voice-notes',
  '0 * * * *',  -- toutes les heures
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-expired-voice-notes',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);


-- ---------------------------------------------------------------------
-- 3. Verifications
-- ---------------------------------------------------------------------
-- Le cron est bien enregistre :
--   select jobname, schedule, active from cron.job where jobname = 'purge-voice-notes';
--
-- Les 10 dernieres executions :
--   select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'purge-voice-notes')
--   order by start_time desc limit 10;
--
-- Notes vocales en attente de purge :
--   select id, listened_at, listened_at + interval '72 hours' as purge_prevue
--   from messages
--   where media_type = 'audio' and listened_at is not null and media_url is not null
--   order by listened_at;
