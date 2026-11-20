import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSocialNetworksConfig,
  normalizeSocialUrl,
  type SocialNetworksConfig,
} from "@/lib/social-networks.functions";

export function useSocialNetworks() {
  const fetchConfig = useServerFn(getSocialNetworksConfig);

  const query = useQuery<SocialNetworksConfig>({
    queryKey: ["social_networks_config"],
    queryFn: () => fetchConfig(),
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });

  const config = query.data ?? {
    whatsapp: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    telegram: "",
    youtube: "",
    twitter: "",
  };

  const links = {
    whatsapp: normalizeSocialUrl("whatsapp", config.whatsapp),
    facebook: normalizeSocialUrl("facebook", config.facebook),
    instagram: normalizeSocialUrl("instagram", config.instagram),
    tiktok: normalizeSocialUrl("tiktok", config.tiktok),
    telegram: normalizeSocialUrl("telegram", config.telegram),
    youtube: normalizeSocialUrl("youtube", config.youtube),
    twitter: normalizeSocialUrl("twitter", config.twitter),
  };

  const hasAnySocial = Object.values(links).some((url) => Boolean(url));

  return {
    ...query,
    config,
    links,
    hasAnySocial,
  };
}
