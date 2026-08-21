import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  return new Response(
    JSON.stringify({ error: "WhatsApp signup is temporarily unavailable" }),
    { status: 410, headers },
  );
});
