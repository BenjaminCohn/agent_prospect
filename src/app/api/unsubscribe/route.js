import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("token missing", { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  await supabase
    .from("leads")
    .update({ unsubscribed: true, status: "skipped" })
    .eq("unsubscribe_token", token);

  return new Response("OK, vous êtes désinscrit(e).", {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
