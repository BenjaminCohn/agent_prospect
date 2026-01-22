import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Resend recommends verifying webhook authenticity with signing secret
  // This uses resend.webhooks.verify() (signing secret + headers). :contentReference[oaicite:10]{index=10}
  const rawBody = await request.text();
  const signature = request.headers.get("resend-signature");

  let event;
  try {
    event = await resend.webhooks.verify({
      payload: rawBody,
      signature,
      secret: process.env.RESEND_WEBHOOK_SECRET
    });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const type = event.type; // ex: email.delivered, email.bounced, email.received...
  const data = event.data || {};

  // Helper: find lead by "to"/"from" (simple)
  const fromEmail = (data.from || "").toLowerCase();
  const toEmail = Array.isArray(data.to) ? (data.to[0] || "").toLowerCase() : "";

  // 1) If inbound reply received
  if (type === "email.received") {
    // try match by sender email (restaurant email)
    const { data: leads } = await supabase
      .from("leads")
      .select("id")
      .eq("email", fromEmail)
      .limit(1);

    if (leads?.[0]?.id) {
      const leadId = leads[0].id;
      await supabase.from("leads").update({ status: "replied" }).eq("id", leadId);
      await supabase.from("email_events").insert({ lead_id: leadId, type: "received", payload: event });
    }

    return new Response("OK", { status: 200 });
  }

  // 2) Bounce / complained => stop contacting
  if (type === "email.bounced" || type === "email.complained") {
    // match by recipient (the restaurant)
    const { data: leads } = await supabase
      .from("leads")
      .select("id")
      .eq("email", toEmail)
      .limit(1);

    if (leads?.[0]?.id) {
      const leadId = leads[0].id;
      await supabase.from("leads").update({ unsubscribed: true, status: "skipped" }).eq("id", leadId);
      await supabase.from("email_events").insert({ lead_id: leadId, type: type.includes("bounced") ? "bounced" : "complained", payload: event });
    }

    return new Response("OK", { status: 200 });
  }

  // Default: store event if we can match
  if (toEmail) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id")
      .eq("email", toEmail)
      .limit(1);

    if (leads?.[0]?.id) {
      await supabase.from("email_events").insert({
        lead_id: leads[0].id,
        type: type.replace("email.", ""),
        payload: event
      });
    }
  }

  // Resend wants 200 OK when you successfully received the webhook. :contentReference[oaicite:11]{index=11}
  return new Response("OK", { status: 200 });
}
