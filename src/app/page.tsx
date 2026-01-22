import Link from "next/link";

const BRAND = "Hôte IA Réservations";
const TAGLINE = "Prospection automatique + démo qui convertit";
const DEMO_URL =
  process.env.NEXT_PUBLIC_DEMO_URL ??
  "https://h-te-iar-servations-ba2u.vercel.app/";
const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ??
  "https://h-te-iar-servations-ba2u.vercel.app/";
const BUY_URL =
  process.env.NEXT_PUBLIC_BUY_URL ?? "https://buy.stripe.com/";

const features = [
  {
    title: "Trouve des restaurants",
    desc: "Découvre des restos par ville (Places/Google) et les ajoute à ta base automatiquement.",
    icon: "🧭",
  },
  {
    title: "Contact + email personnalisé",
    desc: "Récupère un contact quand possible + génère un email court, propre, non-spammy.",
    icon: "✉️",
  },
  {
    title: "Relances + suivi",
    desc: "Relance J+3 / J+5, stop sur bounce/complaint, marque les réponses automatiquement.",
    icon: "📈",
  },
  {
    title: "Désinscription 1 clic",
    desc: "Opt-out simple (List-Unsubscribe) + page de désinscription propre.",
    icon: "✅",
  },
  {
    title: "Démo lisible",
    desc: "Bloc démo en fond blanc, super lisible (même si l’iframe est sombre).",
    icon: "🧼",
  },
  {
    title: "Full auto (cron)",
    desc: "Ça tourne tous les jours via un cron Vercel : pas besoin de lancer quoi que ce soit.",
    icon: "⚙️",
  },
];

const steps = [
  {
    n: "01",
    title: "Tu branches tes clés",
    desc: "Supabase + Resend + Google Places + OpenAI, puis tu déploies sur Vercel.",
  },
  {
    n: "02",
    title: "Le bot remplit la base",
    desc: "Il trouve des restaurants, complète les infos, filtre, prépare l’outreach.",
  },
  {
    n: "03",
    title: "Envoi + relances",
    desc: "Emails courts, relances auto, désinscription. Tu reçois les réponses.",
  },
];

const faqs = [
  {
    q: "Est-ce que je peux contrôler le volume d’emails ?",
    a: "Oui — tu règles MAX_EMAILS_PER_RUN (ex: 10/jour) et tu augmentes progressivement.",
  },
  {
    q: "Et si un resto répond ?",
    a: "Le webhook marque “replied”. Optionnel : auto-réponse IA (on peut l’ajouter).",
  },
  {
    q: "Pourquoi fond blanc pour l’agent ?",
    a: "Pour lire parfaitement le texte, même sur un fond sombre. C’est volontaire.",
  },
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 ring-1 ring-white/10">
      {children}
    </span>
  );
}

function Button({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold transition active:scale-[0.99]";
  const styles =
    variant === "primary"
      ? "bg-white text-zinc-950 hover:bg-zinc-100"
      : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/15";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </a>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute right-[-12rem] top-[6rem] h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute left-[-12rem] bottom-[-12rem] h-[34rem] w-[34rem] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.85))]" />
      </div>

      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
              <span className="text-sm font-black">IA</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-extrabold">{BRAND}</p>
              <p className="text-xs text-zinc-400">{TAGLINE}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
            <a className="hover:text-white" href="#demo">
              Démo
            </a>
            <a className="hover:text-white" href="#features">
              Features
            </a>
            <a className="hover:text-white" href="#how">
              Comment ça marche
            </a>
            <a className="hover:text-white" href="#pricing">
              Prix
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button href={DEMO_URL} variant="secondary" className="hidden md:inline-flex">
              Voir la démo ↗
            </Button>
            <Button href={BUY_URL}>Acheter</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 md:pb-20 md:pt-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                100% automatique (cron)
              </Pill>
              <Pill>Emails courts, pas spam</Pill>
              <Pill>Désinscription 1 clic</Pill>
            </div>

            <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
              Ton{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-emerald-300">
                agent prospecteur
              </span>{" "}
              qui vend ton agent de réservation.
            </h1>

            <p className="mt-4 max-w-xl text-zinc-300 md:text-lg">
              Il trouve des restaurants, récupère un contact, envoie des emails personnalisés,
              relance automatiquement, gère la désinscription et marque les réponses.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button href={DEMO_URL}>Voir ton agent ↗</Button>
              <Button href={LANDING_URL} variant="secondary">
                Landing / Produit ↗
              </Button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["⚡", "Setup rapide"],
                ["📬", "Auto outreach"],
                ["📊", "Suivi simple"],
              ].map(([i, t]) => (
                <div
                  key={t}
                  className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10"
                >
                  <div className="text-xl">{i}</div>
                  <div className="mt-1 text-sm font-extrabold">{t}</div>
                  <div className="text-xs text-zinc-400">Propre & scalable</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: “glass” card */}
          <div className="rounded-[2.2rem] bg-white/5 p-6 ring-1 ring-white/10 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">Ce que fait le bot</p>
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30">
                Live
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["🧠", "Génère des emails personnalisés"],
                ["🗺️", "Cible par villes + types de restos"],
                ["🧾", "Trace l’historique + statuts"],
                ["🔁", "Relances automatiques"],
                ["🧯", "Stop auto si bounce/complaint"],
              ].map(([ic, line]) => (
                <div
                  key={line}
                  className="rounded-3xl bg-zinc-950/40 p-4 ring-1 ring-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                      <span>{ic}</span>
                    </div>
                    <div>
                      <p className="text-sm font-extrabold">{line}</p>
                      <p className="text-xs text-zinc-400">Automatisé, mais clean</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl bg-gradient-to-r from-white/10 to-white/5 p-4 ring-1 ring-white/10">
              <p className="text-xs text-zinc-300">
                ⚠️ Astuce conversion : garde un email ultra court + un seul CTA vers la démo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black md:text-4xl">Démo (fond blanc)</h2>
            <p className="mt-2 text-zinc-300 max-w-2xl">
              Le container est en <span className="font-bold text-white">blanc</span> pour que
              l’agent soit lisible “même si” la démo est sombre.
            </p>
          </div>

          <div className="flex gap-2">
            <Button href={DEMO_URL} variant="secondary">
              Ouvrir ↗
            </Button>
            <Button href={BUY_URL}>Acheter</Button>
          </div>
        </div>

        {/* WHITE WRAPPER */}
        <div className="mt-6 rounded-[2.2rem] bg-white p-3 shadow-2xl shadow-black/50 ring-1 ring-black/10">
          <div className="rounded-[1.8rem] bg-white">
            <iframe
              title="Démo agent"
              src={DEMO_URL}
              className="h-[72vh] w-full rounded-[1.8rem]"
              style={{ background: "white" }}
            />
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-700">
              Si l’iframe est bloquée, ouvre la démo dans un nouvel onglet.
            </p>
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-zinc-800"
            >
              Ouvrir ↗
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <h2 className="text-2xl font-black md:text-4xl">Features</h2>
        <p className="mt-2 text-zinc-300 max-w-2xl">
          Tout ce qu’il faut pour prospecter proprement et convertir.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10 hover:bg-white/10 transition"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <span className="text-xl">{f.icon}</span>
                </div>
                <h3 className="text-lg font-extrabold">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm text-zinc-300">{f.desc}</p>

              <div className="mt-5 h-px bg-white/10" />
              <p className="mt-4 text-xs text-zinc-400">
                Optimisé pour être simple à maintenir.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="rounded-[2.2rem] bg-gradient-to-r from-white/10 to-white/5 p-6 ring-1 ring-white/10 md:p-10">
          <h2 className="text-2xl font-black md:text-4xl">Comment ça marche</h2>
          <p className="mt-2 text-zinc-300 max-w-2xl">
            Tu branches → tu déploies → ça tourne tous les jours.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-[2rem] bg-zinc-950/40 p-6 ring-1 ring-white/10"
              >
                <p className="text-xs font-black text-zinc-400">{s.n}</p>
                <h3 className="mt-2 text-lg font-extrabold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[2.2rem] bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="text-2xl font-black md:text-4xl">Pack Installation</h2>
            <p className="mt-2 text-zinc-300">
              Mise en place + configuration + tests + support.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-zinc-200">
              <li>• Bot de prospection auto (discovery + outreach + relances)</li>
              <li>• Webhooks (réponses, bounces, tracking)</li>
              <li>• Désinscription 1 clic</li>
              <li>• Landing stylée + bloc démo fond blanc</li>
            </ul>

            <div className="mt-6 flex gap-2">
              <Button href={BUY_URL}>Acheter</Button>
              <Button href={DEMO_URL} variant="secondary">
                Voir la démo ↗
              </Button>
            </div>
          </div>

          <div className="rounded-[2.2rem] bg-zinc-950/40 p-6 ring-1 ring-white/10">
            <p className="text-sm font-semibold text-zinc-300">Prix</p>
            <p className="mt-2 text-5xl font-black">2 000€</p>
            <p className="mt-2 text-sm text-zinc-400">
              (Tu changes le prix ici quand tu veux)
            </p>

            <div className="mt-6 rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-sm font-extrabold">Lien principal (dans les emails)</p>
              <p className="mt-2 break-all text-sm text-zinc-300">{LANDING_URL}</p>
              <p className="mt-3 text-xs text-zinc-400">
                Astuce : mets le même lien dans “Démo” et “Site” au début.
              </p>
            </div>

            <div className="mt-6">
              <Link
                href="#demo"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/15"
              >
                Revoir la démo <span>↓</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <h2 className="text-2xl font-black md:text-4xl">FAQ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {faqs.map((f) => (
            <div
              key={f.q}
              className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10 hover:bg-white/10 transition"
            >
              <p className="text-sm font-extrabold">{f.q}</p>
              <p className="mt-2 text-sm text-zinc-300">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-6xl px-4 text-sm text-zinc-400">
          © 2026 — {BRAND}
        </div>
      </footer>
    </div>
  );
}
