import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { hreflangLinks } from "@/lib/seo-page-helpers";
import { useI18n } from "@/lib/i18n";
import { CONTENT as LOCALE_CONTENT } from "@/routes/$lang/natcash";

export const CONTENT = {
  title: "Send Money to NatCash | Tcho-Tcho",
  description:
    "Send money to Haiti and have it delivered directly to a NatCash mobile wallet with Tcho-Tcho.",
  heading: "Send money to NatCash",
  intro:
    "NatCash is one of the delivery methods available on Tcho-Tcho. Choose it as the receiving option when you send money to Haiti, and the funds go straight to the recipient's NatCash mobile wallet.",
  sections: [
    {
      title: "What you need",
      body: "The recipient's NatCash-registered mobile number in Haiti. That's it — no bank account required.",
    },
    {
      title: "Transaction Limits (Natcom / NatCash)",
      body: "Min 3,998 HTG · Max 75,000 HTG per transaction · whole numbers only.",
    },
    {
      title: "How it works with Tcho-Tcho",
      body: "When creating your transfer, select NatCash as the delivery method and enter the recipient's phone number. Once your payment is confirmed, the transfer is processed and the funds are sent to that NatCash wallet.",
    },
  ],
  cta: "Send to NatCash",
};

export const Route = createFileRoute("/natcash")({
  head: () => ({
    meta: [
      { title: CONTENT.title },
      { name: "description", content: CONTENT.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: CONTENT.title },
      { property: "og:description", content: CONTENT.description },
    ],
    links: [
      { rel: "canonical", href: "https://tchotcho.app/natcash" },
      ...hreflangLinks("natcash"),
    ],
  }),
  component: function NatCashPage() {
    const { lang } = useI18n();
    const c = (LOCALE_CONTENT as any)[lang] || CONTENT;
    return (
      <ContentPage
        heading={c.heading}
        intro={c.intro}
        sections={c.sections}
        cta={c.cta}
      />
    );
  },
});
