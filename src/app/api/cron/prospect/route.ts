import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ----- Security: Vercel adds Authorization: Bearer <CRON_SECRET> automatically -----
function isVercelCron(request) {
  const auth = request.headers.get("authorization");
  return auth && auth === `Bearer ${process.env.CRON_SECRET}`;
}

// ----- Helpers -----
const EmailDraft = z.object({
  subject: z.string(),
  text: z.string()
});

function randToken() {
  return crypto.randomBytes(18).toString("hex");
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function extractEmailFromHtml(html) {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
  const found = (html.match(re) || []).map(s => s.toLowerCase());
  const uniq = [...new Set(found)];
  // filtrage basique
  return uniq.find(e => !e.includes("example.com")) || null;
}

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function tryFindEmail(website) {
  if (!website) return null;

  const base = website.replace(/\/$/, "");
  const candidates = [base, `${base}/contact`, `${base}/contactez-nous`, `${base}/mentions-legales`];

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) continue;
      const html = await res.text();
      const email = extractEmailFromHtml(html);
      if (email) return email;
    } catch {
      // ignore
    }
  }
  return null;
}

async function placesTextSearch(city) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const url = "https://places.googleapis.com/v1/places:searchText";

  // FieldMask required
  const fieldMask =
    "places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.internationalPhoneNumber";

  const body = {
    textQuery: `restaurant in ${city}, France`,
    languageCode: "fr",
    pageSize: Number(process.env.MAX_PLACES_PER_CITY || "20")
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Places API error ${res.status}: ${t}`);
  }

  const data = await res.json();
  return data.places || [];
}

async function generateEmail(openai, lead, stage) {
  const landing = process.env.NEXT_PUBLIC_LANDING_URL;
  const demo = process.env.NEXT_PUBLIC_DEMO_URL || landing;

  const stageLine =
    stage === 0
      ? "Premier email de prospection."
      : stage === 1
      ? "Relance 1 (court, poli)."
      : "Relance 2 (dernier message, très court).";

  const input = `
Tu écris un email B2B en français pour un RESTAURANT.
Produit: agent IA qui répond aux appels + prend les réservations + met dans Google Calendar.
Objectif: obtenir une démo (lien).
Contraintes:
- naturel, pas spammy, pas de '!!!'
- 80 à 140 mots (relances: 40 à 90 mots)
- 1 seule question à la fin
- inclure un lien de démo
- toujours rappeler qu'ils peuvent se désinscrire (1 phrase simple)

${stageLine}

Prospect:
Nom: ${lead.name}
Ville: ${lead.city || ""}
Site: ${lead.website || ""}

Liens:
Démo: ${demo}
Site: ${landing}
`;

  const resp = await openai.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: [
      { role: "system", content: "Tu es un SDR B2B expert. Réponds en JSON." },
      { role: "user", content: input }
    ],
    text: { format: zodTextFormat(EmailDraft, "email_draft") }
  });

  return resp.output_parsed;
}

function unsubscribeUrl(baseUrl, token) {
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

// ----- Main cron -----
export async function GET(request) {
  try {
    if (!isVercelCron(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // clients
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const dryRun = (process.env.DRY_RUN || "true") === "true";
    const maxEmails = Number(process.env.MAX_EMAILS_PER_RUN || "10");
    const baseUrl = process.env.BASE_URL;

    const cities = (process.env.TARGET_CITIES || "Paris,Lyon,Marseille")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // 1) DISCOVERY: add leads from Places
    for (const city of cities) {
      const places = await placesTextSearch(city);
      const rows = places.map(p => ({
        place_id: p.id,
        name: p.displayName?.text || "Restaurant",
        city,
        address: p.formattedAddress || null,
        rating: p.rating || null,
        website: p.websiteUri || null,
        phone: p.internationalPhoneNumber || null,
        status: "new"
      }));
      if (rows.length) {
        await supabase.from("leads").upsert(rows, { onConflict: "place_id" });
      }
    }

    // 2) OUTREACH + FOLLOWUPS: pick candidates
    // - new => stage 0
    // - emailed + >3 days => stage 1
    // - followup1 + >5 days => stage 2
    const { data: candidates } = await supabase
      .from("leads")
      .select("*")
      .eq("unsubscribed", false)
      .or(
        [
          "status.eq.new",
          `and(status.eq.emailed,last_contacted_at.lt.${daysAgo(3)})`,
          `and(status.eq.followup1,last_contacted_at.lt.${daysAgo(5)})`
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(maxEmails * 3);

    let sent = 0;
    const report = [];

    for (const lead of candidates || []) {
      if (sent >= maxEmails) break;

      // Ensure token for unsubscribe
      let token = lead.unsubscribe_token;
      if (!token) {
        token = randToken();
        await supabase.from("leads").update({ unsubscribe_token: token }).eq("id", lead.id);
      }
      const u = unsubscribeUrl(baseUrl, token);

      // Find email if missing
      let email = lead.email;
      if (!email && lead.website) {
        email = await tryFindEmail(lead.website);
        if (email) {
          await supabase.from("leads").update({ email }).eq("id", lead.id);
        } else {
          await supabase.from("leads").update({ status: "no_email" }).eq("id", lead.id);
          continue;
        }
      }
      if (!email) continue;

      const stage =
        lead.status === "new" ? 0 : lead.status === "emailed" ? 1 : 2;

      const draft = await generateEmail(openai, lead, stage);

      const headers = {
        "List-Unsubscribe": `<${u}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      };

      if (!dryRun) {
        const sendRes = await resend.emails.send({
          from: process.env.FROM_EMAIL, // ex: "Hôte IA <contact@tondomaine.fr>"
          to: [email],
          subject: draft.subject,
          text: `${draft.text}\n\nDésinscription: ${u}`,
          headers
        });

        await supabase.from("email_events").insert({
          lead_id: lead.id,
          type: "sent",
          payload: sendRes
        });
      }

      // update lead status
      const nextStatus = stage === 0 ? "emailed" : stage === 1 ? "followup1" : "followup2";
      await supabase.from("leads").update({
        status: nextStatus,
        last_contacted_at: new Date().toISOString(),
        followup_count: stage
      }).eq("id", lead.id);

      report.push({ lead: lead.name, email, stage, dryRun });
      sent++;
    }

    return Response.json({ ok: true, dryRun, sent, report });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
