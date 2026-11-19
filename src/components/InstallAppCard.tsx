import { useState } from "react";
import { Download, Share, Menu as MenuIcon, PlusSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

function detectPlatform(): "android" | "ios" {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  return "android";
}

export function InstallAppCard() {
  const { t } = useI18n();
  const [platform, setPlatform] = useState<"android" | "ios">(detectPlatform);

  return (
    <Card className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#131B15] to-[#0A0E0C] text-white shadow-2xl backdrop-blur-xl">
      <CardContent className="p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#02531C] border border-[#F2AC00]/40 text-[#F2AC00] shadow-md">
            <Download className="size-5" />
          </span>
          <h2 className="font-display text-xl font-black text-white">{t("install.title")}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed">{t("install.subtitle")}</p>

        <div className="mt-5 inline-flex rounded-full bg-black/60 border border-white/10 p-1 text-sm">
          <button
            type="button"
            onClick={() => setPlatform("android")}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
              platform === "android"
                ? "bg-[#F2AC00] text-black shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Android
          </button>
          <button
            type="button"
            onClick={() => setPlatform("ios")}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
              platform === "ios"
                ? "bg-[#F2AC00] text-black shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            iPhone
          </button>
        </div>

        {platform === "android" ? (
          <ol className="mt-5 space-y-2.5 text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <MenuIcon className="mt-0.5 size-4 text-[#F2AC00] shrink-0" />
              <span>{t("install.android_step1")}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <PlusSquare className="mt-0.5 size-4 text-[#10B981] shrink-0" />
              <span>{t("install.android_step2")}</span>
            </li>
          </ol>
        ) : (
          <ol className="mt-5 space-y-2.5 text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <Share className="mt-0.5 size-4 text-[#F2AC00] shrink-0" />
              <span>{t("install.ios_step1")}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <PlusSquare className="mt-0.5 size-4 text-[#10B981] shrink-0" />
              <span>{t("install.ios_step2")}</span>
            </li>
          </ol>
        )}

        <p className="mt-5 text-xs text-slate-400 border-t border-white/10 pt-4">{t("install.note")}</p>
      </CardContent>
    </Card>
  );
}

export function InstallButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className}
      onClick={() => {
        document.getElementById("install-app")?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      <Download className="size-4" /> {t("install.cta")}
    </Button>
  );
}
