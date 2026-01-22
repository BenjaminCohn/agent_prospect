import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Types (row Supabase "leads")
 */
type LeadRow = {
  id: number;
  place_id: string | null;
  name: string;
  city: string | null;
  address: string | null;
  rating: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  status: "new" | "emailed" | "followup1" | "followup2" | "replied" | "no_email" | "skipped" | string;
  last_contacted_at: string | null;
  followup_count: number | null;
  unsubscribed: boolean | null;
  unsubscribe_token: string | null;
};

const EmailDraft = z.object({
  subject: z.string(),
  text: z.string(),
});

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isVercelCron(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Missing env: CRON_SECRET");
  return auth === `Bearer ${secret}`;
}

function randToken(): string {
  return crypto.randomBytes(18).toString("hex");
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

function extractEmailFromHtml(html: string): string | null {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
  const found = (html.match(re) || []).map((s) => s.toLowerCase());
  const uniq = [...new Set(found)];
  return uniq.find((e) => !e.includes("example.com")) || null;
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

async function tryFindEmail(website: string | null): Promise<string | null> {
  if (!website) return null;

  const base = website.replace(/\/$/, "");
  const candidates = [
    base,
    `${base}/contact`,
    `${base}/contactez-nous`,
    `${base}/mentions-legales`,
  ];

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

/**
 * Google Places (New) Text Search
 */
type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  websiteUri?: string;
  internationalPhoneNumber?: string;
};

async function placesTextSearch(city: string): Promise<Place[]> {
  const apiKey = requireEnv("GOOGLE_PLACES_API_KEY");
  const url = "https://places.googleapis.com/v1/places:searchText";

  // FieldMask required
  const fieldMask =
    "places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.internationalPhoneNumber";

  const body = {
    textQuery: `restaurant in ${city}, France`,
    languageCode: "fr",
    pageSize: Number(process.env.MAX_PLACES_PER_CITY || "20"),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Places API error ${res.status}: ${t}`);
  }

  const data = (await res.json()) as { places?: Place[] };
  return data.places || [];
}

/**
 * Generate email via OpenAI (Structured Output)
 */
async function generateEmail(openai: OpenAI, lead: LeadRow, stage: 0 | 1 | 2) {
  // ✅ server-side vars (évite NEXT_PUBLIC ici)
  const landing = process.env.LANDING_URL || process.env.NEXT_PUBLIC_LANDING_URL || "";
  const demo = process.env.DEMO_URL || process.env.NEXT_PUBLIC_DEMO_URL || landing;

  if (!landing) throw new Error("Missing env: LANDING_URL (or NEXT_PUBLIC_LANDING_URL)");
  if (!demo) throw new Error("Missing env: DEMO_URL (or NEXT_PUBLIC_DEMO_URL)");

  const stageLine =
    stage === 0
      ? "Premier email de prospection."
      : stage === 1
      ? "Relance 1 (court, poli)."
      : "Relance 2 (dernier message, très court).";

  const input = `
Tu écris un email B2B en français pour un RESTAURANT.
Produit: agent IA qui répond aux appels + prend les réservations + met dans Google Calendar.
Objectif: obtenir une démo.
Contraintes:
- naturel, pas spammy, pas de "!!!"
- 80 à 140 mots (relances: 40 à 90 mots)
- 1 seule question à la fin
- inclure le lien de démo
- inclure 1 phrase simple de désinscription

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
      { role: "user", content: input },
    ],
    text: { format: zodTextFormat(EmailDraft, "email_draft") },
  });

  return resp.output_parsed; // { subject, text }
}

/**
 * Main (cron)
 */
export async function GET(request: NextRequest) {
  try {
    if (!isVercelCron(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Env required
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = requireEnv("RESEND_API_KEY");
    const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
    const BASE_URL = requireEnv("BASE_URL");
    requireEnv("GOOGLE_PLACES_API_KEY"); // validate early

    const dryRun = (process.env.DRY_RUN || "true") === "true";
    const maxEmails = Number(process.env.MAX_EMAILS_PER_RUN || "10");

    const cities = (process.env.TARGET_CITIES || "Paris,Lyon,Marseille")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const resend = new Resend(RESEND_API_KEY);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // 1) DISCOVERY: add leads from Places
    for (const city of cities) {
      const places = await placesTextSearch(city);

      const rows = places.map((p) => ({
        place_id: p.id,
        name: p.displayName?.text || "Restaurant",
        city,
        address: p.formattedAddress || null,
        rating: p.rating || null,
        website: p.websiteUri || null,
        phone: p.internationalPhoneNumber || null,
        status: "new",
      }));

      if (rows.length) {
        await supabase.from("leads").upsert(rows, { onConflict: "place_id" });
      }
    }

    // 2) Pick candidates (3 queries = simple, stable)
    const cutoff3 = isoDaysAgo(3);
    const cutoff5 = isoDaysAgo(5);

    const take = maxEmails * 3;

    const qNew = await supabase
      .from("leads")
      .select("*")
      .eq("unsubscribed", false)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(take);

    const qF1 = await supabase
      .from("leads")
      .select("*")
      .eq("unsubscribed", false)
      .eq("status", "emailed")
      .lt("last_contacted_at", cutoff3)
      .order("last_contacted_at", { ascending: true })
      .limit(take);

    const qF2 = await supabase
      .from("leads")
      .select("*")
      .eq("unsubscribed", false)
      .eq("status", "followup1")
      .lt("last_contacted_at", cutoff5)
      .order("last_contacted_at", { ascending: true })
      .limit(take);

    const candidatesRaw = [
      ...(qNew.data || []),
      ...(qF1.data || []),
      ...(qF2.data || []),
    ] as LeadRow[];

    // Dedup by id
    const seen = new Set<number>();
    const candidates: LeadRow[] = [];
    for (const c of candidatesRaw) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        candidates.push(c);
      }
    }

    let sent = 0;
    const report: Array<{ lead: string; email: string; stage: number; dryRun: boolean }> = [];

    for (const lead of candidates) {
      if (sent >= maxEmails) break;
      if (lead.unsubscribed) continue;
      if (lead.status === "replied" || lead.status === "skipped") continue;

      // Ensure token (unsubscribe)
      let token = lead.unsubscribe_token;
      if (!token) {
        token = randToken();
        await supabase.from("leads").update({ unsubscribe_token: token }).eq("id", lead.id);
      }
      const u = unsubscribeUrl(BASE_URL, token);

      // Ensure email
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

      // stage
      const stage: 0 | 1 | 2 =
        lead.status === "new" ? 0 : lead.status === "emailed" ? 1 : 2;

      const draft = await generateEmail(openai, lead, stage);

      const headers = {
        "List-Unsubscribe": `<${u}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      if (!dryRun) {
        const sendRes = await resend.emails.send({
          from: requireEnv("FROM_EMAIL"),
          to: [email],
          subject: draft.subject,
          text: `${draft.text}\n\nDésinscription: ${u}`,
          headers,
        });

        await supabase.from("email_events").insert({
          lead_id: lead.id,
          type: "sent",
          payload: sendRes,
        });
      }

      // next status
      const nextStatus = stage === 0 ? "emailed" : stage === 1 ? "followup1" : "followup2";

      await supabase
        .from("leads")
        .update({
          status: nextStatus,
          last_contacted_at: new Date().toISOString(),
          followup_count: stage,
        })
        .eq("id", lead.id);

      report.push({ lead: lead.name, email, stage, dryRun });
      sent++;
    }

    return Response.json({ ok: true, dryRun, sent, report });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
