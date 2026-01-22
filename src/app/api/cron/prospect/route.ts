import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { Resend } from "resend";

// ✅ Schéma + type TS déduit
const EmailDraft = z.object({
  subject: z.string(),
  text: z.string(),
});
type EmailDraftT = z.infer<typeof EmailDraft>;

type LeadRow = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  rating: number | null;
  website: string | null;
  email: string | null;
  status: "new" | "emailed" | "followup1" | "followup2" | "replied" | "no_email" | "skipped" | string;
  last_contacted_at: string | null;
  followup_count: number | null;
  unsubscribed: boolean | null;
  unsubscribe_token: string | null;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// ✅ ICI : on garantit que ça ne renvoie JAMAIS null
async function generateEmail(
  openai: OpenAI,
  lead: LeadRow,
  stage: 0 | 1 | 2
): Promise<EmailDraftT> {
  const landing = process.env.LANDING_URL || process.env.NEXT_PUBLIC_LANDING_URL || "";
  const demo = process.env.DEMO_URL || process.env.NEXT_PUBLIC_DEMO_URL || landing;
  if (!landing) throw new Error("Missing env: LANDING_URL (or NEXT_PUBLIC_LANDING_URL)");
  if (!demo) throw new Error("Missing env: DEMO_URL (or NEXT_PUBLIC_DEMO_URL)");

  const stageLine =
    stage === 0 ? "Premier email." : stage === 1 ? "Relance 1." : "Relance 2.";

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

Nom: ${lead.name}
Ville: ${lead.city || ""}
Adresse: ${lead.address || ""}
Note: ${lead.rating ?? ""}

Lien démo: ${demo}
Site: ${landing}
`.trim();

  const resp = await openai.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: [
      { role: "system", content: "Tu es un SDR B2B expert. Réponds en JSON." },
      { role: "user", content: input },
    ],
    text: { format: zodTextFormat(EmailDraft, "email_draft") },
  });

  const draft = resp.output_parsed;
  if (!draft) throw new Error("OpenAI output_parsed est null (pas de sortie structurée).");
  return draft;
}

// Exemple d’usage (dans ta boucle)
export async function GET(request: NextRequest) {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });

  const dryRun = (process.env.DRY_RUN || "true") === "true";

  // ... lead, email, u, headers, stage etc.
  const lead = {} as LeadRow;
  const email = "test@example.com";
  const u = "https://example.com/unsubscribe?token=xxx";
  const headers = {
    "List-Unsubscribe": `<${u}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const stage: 0 | 1 | 2 = 0;

  const draft = await generateEmail(openai, lead, stage); // ✅ draft n’est plus nullable

  if (!dryRun) {
    await resend.emails.send({
      from: requireEnv("FROM_EMAIL"),
      to: [email],
      subject: draft.subject,
      text: `${draft.text}\n\nDésinscription: ${u}`,
      headers,
    });
  }

  return Response.json({ ok: true });
}
