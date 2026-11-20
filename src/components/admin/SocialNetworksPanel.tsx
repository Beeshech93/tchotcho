import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Share2,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getSocialNetworksConfig,
  updateSocialNetworksConfig,
  normalizeSocialUrl,
  type SocialNetworksConfig,
} from "@/lib/social-networks.functions";

interface SocialChannelMeta {
  key: keyof SocialNetworksConfig;
  name: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  colorClass: string;
  borderClass: string;
  placeholder: string;
  description: string;
  exampleUrl: string;
}

function WhatsAppIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
    </svg>
  );
}

function FacebookIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function TelegramIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.941z" />
    </svg>
  );
}

function YouTubeIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TwitterXIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const CHANNELS: SocialChannelMeta[] = [
  {
    key: "whatsapp",
    name: "WhatsApp",
    icon: WhatsAppIcon,
    colorClass: "text-emerald-500",
    borderClass: "border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5",
    placeholder: "+52 123 456 7890 o https://wa.me/...",
    description: "Línea directa o canal oficial de WhatsApp para atención y comunidad.",
    exampleUrl: "https://wa.me/18293417169",
  },
  {
    key: "facebook",
    name: "Facebook",
    icon: FacebookIcon,
    colorClass: "text-blue-500",
    borderClass: "border-blue-500/30 hover:border-blue-500/60 bg-blue-500/5",
    placeholder: "https://facebook.com/tupagina o nombre_pagina",
    description: "Página o perfil oficial en Facebook para la comunidad.",
    exampleUrl: "https://facebook.com/tchotchoapp",
  },
  {
    key: "instagram",
    name: "Instagram",
    icon: InstagramIcon,
    colorClass: "text-pink-500",
    borderClass: "border-pink-500/30 hover:border-pink-500/60 bg-pink-500/5",
    placeholder: "https://instagram.com/usuario o @usuario",
    description: "Cuenta oficial de Instagram para novedades y contenido visual.",
    exampleUrl: "https://instagram.com/tchotchoapp",
  },
  {
    key: "tiktok",
    name: "TikTok",
    icon: TikTokIcon,
    colorClass: "text-neutral-200",
    borderClass: "border-neutral-500/30 hover:border-neutral-500/60 bg-neutral-500/5",
    placeholder: "https://tiktok.com/@usuario o @usuario",
    description: "Canal oficial de videos cortos en TikTok.",
    exampleUrl: "https://tiktok.com/@tchotchoapp",
  },
  {
    key: "telegram",
    name: "Telegram",
    icon: TelegramIcon,
    colorClass: "text-sky-400",
    borderClass: "border-sky-500/30 hover:border-sky-500/60 bg-sky-500/5",
    placeholder: "https://t.me/canal o @canal",
    description: "Canal de avisos o grupo comunitario en Telegram.",
    exampleUrl: "https://t.me/tchotchoapp",
  },
  {
    key: "youtube",
    name: "YouTube",
    icon: YouTubeIcon,
    colorClass: "text-red-500",
    borderClass: "border-red-500/30 hover:border-red-500/60 bg-red-500/5",
    placeholder: "https://youtube.com/@canal o @canal",
    description: "Canal de tutoriales y guías oficiales en YouTube.",
    exampleUrl: "https://youtube.com/@tchotchoapp",
  },
  {
    key: "twitter",
    name: "X (Twitter)",
    icon: TwitterXIcon,
    colorClass: "text-white",
    borderClass: "border-white/20 hover:border-white/40 bg-white/5",
    placeholder: "https://x.com/usuario o @usuario",
    description: "Perfil en X (antes Twitter) para noticias y atención rápida.",
    exampleUrl: "https://x.com/tchotchoapp",
  },
];

export function SocialNetworksPanel() {
  const qc = useQueryClient();
  const fetchConfig = useServerFn(getSocialNetworksConfig);
  const saveConfig = useServerFn(updateSocialNetworksConfig);

  const { data: config, isLoading } = useQuery({
    queryKey: ["social_networks_config"],
    queryFn: () => fetchConfig(),
  });

  const [formData, setFormData] = useState<SocialNetworksConfig>({
    whatsapp: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    telegram: "",
    youtube: "",
    twitter: "",
  });

  useEffect(() => {
    if (config) {
      setFormData({
        whatsapp: config.whatsapp || "",
        facebook: config.facebook || "",
        instagram: config.instagram || "",
        tiktok: config.tiktok || "",
        telegram: config.telegram || "",
        youtube: config.youtube || "",
        twitter: config.twitter || "",
      });
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: () => saveConfig({ data: formData }),
    onSuccess: () => {
      toast.success("¡Cuentas de redes sociales guardadas y conectadas!");
      void qc.invalidateQueries({ queryKey: ["social_networks_config"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al guardar redes sociales");
    },
  });

  const handleChange = (field: keyof SocialNetworksConfig, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const connectedCount = Object.values(formData).filter((v) => Boolean(v && v.trim())).length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Conexión de Redes Sociales</h2>
            <Badge variant="outline" className="ml-2 border-primary/40 text-primary">
              {connectedCount} de {CHANNELS.length} conectadas
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Vincula los perfiles y canales oficiales de la plataforma. Se mostrarán
            automáticamente en el pie de página, soporte y contacto para tus clientes.
          </p>
        </div>

        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || isLoading}
          className="shrink-0 font-semibold gap-2"
        >
          {saveMut.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Guardar cambios
        </Button>
      </div>

      {/* Grid de canales */}
      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map((ch) => {
          const rawVal = formData[ch.key] || "";
          const isConnected = Boolean(rawVal.trim());
          const targetUrl = normalizeSocialUrl(ch.key, rawVal);
          const Icon = ch.icon;

          return (
            <Card
              key={ch.key}
              className={`transition-all duration-200 border ${
                isConnected ? ch.borderClass : "hover:border-border"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl bg-background/80 border border-border/60 ${ch.colorClass}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {ch.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {ch.description}
                      </CardDescription>
                    </div>
                  </div>

                  {isConnected ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px] gap-1">
                      <CheckCircle2 className="size-3" /> Conectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[11px]">
                      Sin conectar
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`social-${ch.key}`} className="text-xs font-medium">
                    Enlace, usuario o identificador
                  </Label>
                  <Input
                    id={`social-${ch.key}`}
                    value={rawVal}
                    onChange={(e) => handleChange(ch.key, e.target.value)}
                    placeholder={ch.placeholder}
                    className="font-mono text-xs h-10"
                  />
                </div>

                {isConnected && targetUrl && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <span className="truncate text-muted-foreground font-mono">
                      {targetUrl}
                    </span>
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline shrink-0"
                    >
                      <span>Probar enlace</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Botón flotante o inferior */}
      <div className="flex justify-end pt-2">
        <Button
          size="lg"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || isLoading}
          className="gap-2 font-semibold"
        >
          {saveMut.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Guardar todas las redes sociales
        </Button>
      </div>
    </div>
  );
}
