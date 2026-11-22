import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "client" | "agent" | "super_agent" | "admin" | "super_admin";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  country: string;
  language: string;
  kyc_status: "none" | "pending" | "approved" | "rejected";
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useProfile() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    const [{ data: p }, { data: r }, { data: saRow }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("integration_credentials")
        .select("value")
        .eq("name", `SUPER_AGENT_ROLE_${uid}`)
        .maybeSingle(),
    ]);
    const fetchedRoles = ((r ?? []) as { role: AppRole }[]).map((x) => x.role);
    const userEmail = user?.email?.toLowerCase().trim();
    const userPhone = user?.phone?.replace(/\D/g, "");
    const isMetadataAdmin =
      (user?.user_metadata as any)?.is_admin === true ||
      (user?.user_metadata as any)?.role === "admin" ||
      (user?.user_metadata as any)?.role === "super_admin";

    const isExplicitAdmin =
      userEmail === "lajanrapid26@gmail.com" ||
      userEmail === "charlesagency4@gmail.com" ||
      userPhone === "529988100395" ||
      uid === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
      uid === "cca63804-b4c1-4221-bbd3-82258545f228" ||
      uid === "9b729a8e-b91c-430a-907c-969652b89f3b" ||
      isMetadataAdmin ||
      fetchedRoles.includes("admin") ||
      fetchedRoles.includes("super_admin");

    if (isExplicitAdmin && !fetchedRoles.includes("admin")) {
      fetchedRoles.push("admin");
    }

    const isMetaSuperAgent =
      (user?.user_metadata as any)?.is_super_agent === true ||
      (user?.user_metadata as any)?.role === "super_agent";

    if (
      (Boolean(saRow?.value) || isMetaSuperAgent) &&
      !fetchedRoles.includes("super_agent")
    ) {
      fetchedRoles.push("super_agent");
    }
    const isUserAdmin = fetchedRoles.includes("admin") || isExplicitAdmin;

    const effectiveProfile: Profile | null = p
      ? {
          ...(p as Profile),
          // Los administradores confirmados están exentos de verificaciones
          kyc_status: isUserAdmin ? "approved" : (p as Profile).kyc_status,
        }
      : uid
        ? {
            id: uid,
            full_name: "",
            phone: null,
            country: "HT",
            language: "es",
            kyc_status: isUserAdmin ? "approved" : "none",
          }
        : null;

    setProfile(effectiveProfile);
    setRoles(fetchedRoles);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    void load(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sessionLoading]);

  const email = user?.email?.toLowerCase().trim();
  const phone = user?.phone?.replace(/\D/g, "");
  const isMasterAdminEmail =
    email === "charlesagency4@gmail.com" ||
    email === "lajanrapid26@gmail.com" ||
    phone === "529988100395" ||
    user?.id === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
    user?.id === "cca63804-b4c1-4221-bbd3-82258545f228" ||
    user?.id === "9b729a8e-b91c-430a-907c-969652b89f3b";

  const isUserAdmin = roles.includes("admin") || roles.includes("super_admin") || isMasterAdminEmail;

  return {
    user,
    profile,
    roles,
    isAdmin: isUserAdmin,
    isSuperAdmin: isMasterAdminEmail,
    isSuperAgent: roles.includes("super_agent") || isMasterAdminEmail,
    isAgent: roles.includes("agent") || roles.includes("super_agent") || isMasterAdminEmail,
    loading: loading || sessionLoading,
    reload: () => (user ? load(user.id) : Promise.resolve()),
  };
}
