import { createFileRoute } from "@tanstack/react-router";
import { CorridorLanding } from "@/components/CorridorLanding";

export const Route = createFileRoute("/usa-to-haiti")({
  head: () => ({
    meta: [
      { title: "Send Money from USA to Haiti | Tcho-Tcho" },
      {
        name: "description",
        content:
          "Send money from the United States to Haiti with Tcho-Tcho. Fast and secure international remittances to Haiti.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Send Money from USA to Haiti | Tcho-Tcho" },
      {
        property: "og:description",
        content:
          "Send money from the United States to Haiti with Tcho-Tcho. Fast and secure international remittances to Haiti.",
      },
    ],
    links: [{ rel: "canonical", href: "https://tchotcho.app/usa-to-haiti" }],
  }),
  component: () => (
    <CorridorLanding
      originCode="US"
      originCurrency="USD"
      originFlag="🇺🇸"
      heading="Send Money from the USA to Haiti"
      subheading="Fast, secure transfers from the United States to Haiti with transparent exchange rates and real-time tracking."
    />
  ),
});
