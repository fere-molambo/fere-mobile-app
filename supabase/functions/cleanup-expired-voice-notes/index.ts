import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const BUCKET = "chat-media";
const RETENTION_HOURS = 72;

// media_url est une URL signee :
// https://<ref>.supabase.co/storage/v1/object/sign/chat-media/<path>?token=...
function extractStoragePath(mediaUrl: string): string | null {
  const marker = `/${BUCKET}/`;
  const start = mediaUrl.indexOf(marker);
  if (start === -1) return null;
  const rest = mediaUrl.slice(start + marker.length);
  const path = rest.split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const cutoff = new Date(
      Date.now() - RETENTION_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { data: expired, error } = await supabase
      .from("messages")
      .select("id, media_url")
      .eq("media_type", "audio")
      .not("media_url", "is", null)
      .not("listened_at", "is", null)
      .lt("listened_at", cutoff)
      .limit(500);

    if (error) throw error;

    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ success: true, purged: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const paths = expired
      .map((m: { media_url: string }) => extractStoragePath(m.media_url))
      .filter((p: string | null): p is string => !!p);

    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove(paths);
      // Un fichier deja absent ne doit pas bloquer la mise a jour des messages.
      if (removeError) console.error("storage remove:", removeError.message);
    }

    // Le message reste dans la conversation, seul le media disparait.
    const { error: updateError } = await supabase
      .from("messages")
      .update({ media_url: null })
      .in("id", expired.map((m: { id: string }) => m.id));

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, purged: expired.length, files: paths.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("cleanup-expired-voice-notes:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
