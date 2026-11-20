import { createFileRoute, Link } from "@tanstack/react-router";
import logoAsset from "@/assets/lajan-rapid-logo.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const FAQ_ITEMS = [
  {
    q: "What is Tcho-Tcho?",
    a: "Tcho-Tcho is an international money transfer and remittance service designed to facilitate transfers to Haiti.",
  },
  {
    q: "Can I send money to Haiti from the United States?",
    a: "Tcho-Tcho provides a platform for international money transfers to Haiti. Availability of specific payment and payout methods depends on the user's location and the services currently supported.",
  },
  {
    q: "Can I send money to Haiti from Canada?",
    a: "Tcho-Tcho is designed to support international remittances to Haiti, subject to available services and applicable requirements.",
  },
  {
    q: "Can I send money from Mexico to Haiti?",
    a: "Tcho-Tcho is designed for international transfers from supported markets to Haiti.",
  },
  {
    q: "Can recipients receive money in Haiti?",
    a: "Available receiving methods depend on the services supported by Tcho-Tcho at the time of the transaction.",
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions | Tcho-Tcho" },
      {
        name: "description",
        content:
          "Answers to common questions about Tcho-Tcho: sending money to Haiti from the USA, Canada, Mexico and other countries.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Frequently Asked Questions | Tcho-Tcho" },
      {
        property: "og:description",
        content:
          "Answers to common questions about Tcho-Tcho: sending money to Haiti from the USA, Canada, Mexico and other countries.",
      },
    ],
    links: [{ rel: "canonical", href: "https://tchotcho.app/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-logo-surface p-1 shadow-soft">
            <img src={logoAsset} alt="Tcho-Tcho" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Tcho-Tcho</span>
        </Link>
        <LanguageSwitcher className="h-9 w-[132px] text-xs" />
      </header>

      <section className="mx-auto max-w-3xl space-y-8 px-5 pb-20 pt-4">
        <h1 className="font-display text-3xl font-bold">
          Frequently Asked Questions About Tcho-Tcho
        </h1>

        <div className="space-y-6">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q}>
              <h2 className="font-display text-lg font-semibold">{item.q}</h2>
              <p className="mt-1.5 text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>

        <p className="pt-4 text-sm text-muted-foreground">
          <Link to="/" className="underline hover:text-foreground">
            Tcho-Tcho
          </Link>
        </p>
      </section>
    </div>
  );
}
