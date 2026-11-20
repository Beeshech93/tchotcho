import { Globe } from "lucide-react";
import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger
        className={cn("w-auto shrink-0 gap-1.5 px-2.5 sm:px-3.5", className)}
        aria-label={t("common.language")}
      >
        <Globe className="size-3.5 opacity-70 shrink-0" />
        <span className="text-[11px] sm:text-xs font-semibold flex items-center gap-1">
          <span>{current.flag}</span>
          <span className="hidden sm:inline">{current.label}</span>
          <span className="sm:hidden uppercase">{current.code}</span>
        </span>
      </SelectTrigger>
      <SelectContent className="bg-[#121714] border border-white/15 text-white">
        {LANGUAGES.map((l) => (
          <SelectItem
            key={l.code}
            value={l.code}
            className="text-xs font-semibold focus:bg-[#02531C] focus:text-white"
          >
            {l.flag} {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
