import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 1. Revisar si hay sesión activa en localStorage/memoria primero
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user) {
      return { user: s.session.user };
    }
    // 2. Si no hay sesión local, intentar verificar con getUser()
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        return { user: u.user };
      }
    } catch {
      // ignore
    }
    throw redirect({ to: "/auth" });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
