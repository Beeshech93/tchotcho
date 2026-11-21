import { createFileRoute, Link } from "@tanstack/react-router";
import logoAsset from "@/assets/lajan-rapid-logo.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

const FAQ_DATA: Record<
  "es" | "fr" | "ht" | "en",
  {
    title: string;
    items: { q: string; a: string }[];
  }
> = {
  es: {
    title: "Preguntas Frecuentes sobre Tcho-Tcho",
    items: [
      {
        q: "¿Qué es Tcho-Tcho?",
        a: "Tcho-Tcho es una plataforma de transferencias y remesas de dinero internacionales diseñada para facilitar envíos rápidos y seguros a Haití.",
      },
      {
        q: "¿Puedo enviar dinero a Haití desde Estados Unidos?",
        a: "Tcho-Tcho ofrece una plataforma para transferencias internacionales a Haití. La disponibilidad de métodos específicos de pago y cobro depende de tu ubicación y de los servicios habilitados.",
      },
      {
        q: "¿Puedo enviar dinero a Haití desde Canadá?",
        a: "Tcho-Tcho está diseñada para permitir remesas internacionales hacia Haití, sujeto a los servicios disponibles y normativas vigentes.",
      },
      {
        q: "¿Puedo enviar dinero desde República Dominicana, Chile o México a Haití?",
        a: "Tcho-Tcho opera con soporte para transferencias internacionales desde múltiples corredores habilitados hacia cuentas MonCash, NatCash y retiro en efectivo.",
      },
      {
        q: "¿Cómo reciben el dinero los destinatarios en Haití?",
        a: "Los fondos se acreditan de manera inmediata en billeteras móviles MonCash o NatCash, o mediante puntos de retiro en efectivo autorizados en Haití.",
      },
    ],
  },
  fr: {
    title: "Foire Aux Questions sur Tcho-Tcho",
    items: [
      {
        q: "Qu'est-ce que Tcho-Tcho ?",
        a: "Tcho-Tcho est une plateforme de transfert d'argent international conçue pour faciliter les envois rapides et sécurisés vers Haïti.",
      },
      {
        q: "Puis-je envoyer de l'argent en Haïti depuis les États-Unis ?",
        a: "Tcho-Tcho permet les transferts d'argent internationaux vers Haïti. La disponibilité des méthodes de paiement et de réception dépend de votre localisation et des services activés.",
      },
      {
        q: "Puis-je envoyer de l'argent en Haïti depuis le Canada ?",
        a: "Tcho-Tcho est conçu pour prendre en charge les transferts internationaux vers Haïti, selon les options disponibles.",
      },
      {
        q: "Puis-je envoyer de l'argent depuis la République Dominicaine, le Chili ou le Mexique ?",
        a: "Oui, Tcho-Tcho prend en charge les transferts depuis plusieurs pays partenaires vers les portefeuilles MonCash, NatCash ou points de retrait.",
      },
      {
        q: "Comment les destinataires reçoivent-ils l'argent en Haïti ?",
        a: "Les fonds sont crédités directement sur les portefeuilles mobiles MonCash ou NatCash en moins de 2 minutes, ou en espèces aux points partenaires.",
      },
    ],
  },
  ht: {
    title: "Kesyon Yo Poze Souvan sou Tcho-Tcho",
    items: [
      {
        q: "Kisa Tcho-Tcho ye?",
        a: "Tcho-Tcho se yon platfòm transfè lajan entènasyonal ki fèt pou fasilite voye lajan an Ayiti rapidman epi an sekirite.",
      },
      {
        q: "Èske mwen ka voye lajan an Ayiti depi Etazini?",
        a: "Tcho-Tcho bay yon platfòm pou transfè entènasyonal vè Ayiti. Disponibilite metòd peman ak resepsyon depann de kote w ye a ak sèvis ki louvri yo.",
      },
      {
        q: "Èske mwen ka voye lajan an Ayiti depi Kanada?",
        a: "Tcho-Tcho fèt pou sipòte transfè entènasyonal pou Ayiti, selon sèvis ki disponib yo.",
      },
      {
        q: "Èske mwen ka voye lajan depi Repiblik Dominiken, Chili oswa Meksik?",
        a: "Wi, Tcho-Tcho sipòte voye lajan depi plizyè peyi vè bous MonCash, NatCash oswa pwen retrè an kach an Ayiti.",
      },
      {
        q: "Kijan moun k ap resevwa a jwenn lajan an Ayiti?",
        a: "Lajan an antre dirèkteman sou bous MonCash oswa NatCash yo nan mwens pase 2 minit, oswa nan pwen retrè patnè yo.",
      },
    ],
  },
  en: {
    title: "Frequently Asked Questions About Tcho-Tcho",
    items: [
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
        q: "Can I send money from Dominican Republic, Chile or Mexico to Haiti?",
        a: "Tcho-Tcho supports transfers from multiple corridors directly to MonCash, NatCash or cash pickup in Haiti.",
      },
      {
        q: "Can recipients receive money in Haiti?",
        a: "Funds are credited directly into recipient's MonCash or NatCash mobile wallets in less than 2 minutes, or paid out via partner cash locations.",
      },
    ],
  },
};

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
  }),
  component: FaqPage,
});

function FaqPage() {
  const { lang } = useI18n();
  const currentFaq = FAQ_DATA[lang as "es" | "fr" | "ht" | "en"] || FAQ_DATA.es;

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
          {currentFaq.title}
        </h1>

        <div className="space-y-6">
          {currentFaq.items.map((item) => (
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
