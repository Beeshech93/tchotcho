import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { I18nProvider } from "@/lib/i18n";
import { BrandProvider } from "@/lib/brand-context";
import { LogoIntro, LogoCelebration } from "@/components/LogoAnimation";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const errorMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no cargó
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal. Puedes reintentar o volver al inicio.
        </p>
        {errorMessage && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive/90 break-words">
            {errorMessage}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f4f7f5" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Tcho-Tcho" },

      { title: "Tcho-Tcho — AI Fintech & Digital Banking App" },
      {
        name: "description",
        content:
          "Plataforma inteligente de banca digital y remesas internacionales. Envía dinero a Haití, gestiona tarjetas virtuales y controla tus finanzas con IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Tcho-Tcho — AI Fintech & Digital Banking App" },
      { name: "twitter:title", content: "Tcho-Tcho — AI Fintech & Digital Banking App" },
      {
        property: "og:description",
        content:
          "Plataforma inteligente de banca digital y remesas internacionales. Envía dinero a Haití, gestiona tarjetas virtuales y controla tus finanzas con IA.",
      },
      {
        name: "twitter:description",
        content:
          "Plataforma inteligente de banca digital y remesas internacionales. Envía dinero a Haití, gestiona tarjetas virtuales y controla tus finanzas con IA.",
      },
      {
        property: "og:image",
        content: "/icon-512.png",
      },
      {
        name: "twitter:image",
        content: "/icon-512.png",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    scripts: [
      {
        children: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '3200111473513108');
fbq('track', 'PageView');`,
      },
      {
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=AW-18485986209",
      },
      {
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-18485986209');`,
      },
      {
        type: "text/javascript",
        children: `(function() {
  try {
    if (window.location && window.location.search && window.location.search.indexOf('capture-sitebehaviour-heatmap') !== -1) {
      sessionStorage.setItem('capture-sitebehaviour-heatmap', '_');
    }

    var sbSiteSecret = 'b8a11cd4-e2ee-450c-9443-e562c07948c6';
    window.sitebehaviourTrackingSecret = sbSiteSecret;
    var scriptElement = document.createElement('script');
    scriptElement.defer = true;
    scriptElement.id = 'site-behaviour-script-v2';
    scriptElement.src = 'https://sitebehaviour-cdn.fra1.cdn.digitaloceanspaces.com/index.min.js?sitebehaviour-secret=' + sbSiteSecret;
    document.head.appendChild(scriptElement); 
  } catch (e) {
    console.error(e);
  }
})();`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // El atributo lang del <html> se calcula desde la URL (funciona igual en
  // el servidor y en el cliente), para que Google/Bing vean el idioma real
  // de cada página desde el primer HTML — antes quedaba fijo en "es" y solo
  // se corregía después, del lado del cliente, lo cual los rastreadores no
  // ven a tiempo.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const htmlLang = pathname.startsWith("/es/")
    ? "es"
    : pathname.startsWith("/fr/")
      ? "fr"
      : pathname.startsWith("/ht/")
        ? "ht"
        : "en";

  return (
    <html lang={htmlLang}>
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=3200111473513108&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Rastrear PageView en Meta Pixel en cada navegación SPA
  useEffect(() => {
    if (typeof window !== "undefined" && typeof (window as any).fbq === "function") {
      (window as any).fbq("track", "PageView");
    }
  }, [pathname]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.update().catch(() => { });
      })
      .catch(() => { });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrandProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <LogoIntro />
          <LogoCelebration />
          <Outlet />
          <InstallAppPrompt />
          <Toaster position="top-center" richColors />
        </BrandProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
