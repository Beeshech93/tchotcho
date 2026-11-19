import React, { createContext, useContext } from "react";
import { type Tenant, DEFAULT_LAJAN_RAPID_TENANT } from "./whitelabel.types";
import logoAsset from "@/assets/tchotcho-logo.png";

interface BrandContextType {
  currentBrand: Tenant;
  allBrands: Tenant[];
  isLoading: boolean;
  isCustomBrand: boolean;
  logoSrc: string;
  switchBrand: (slug: string) => void;
  resetToDefault: () => void;
  applyTheme: (tenant: Tenant) => void;
}

const BrandContext = createContext<BrandContextType | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const currentBrand = DEFAULT_LAJAN_RAPID_TENANT;
  const allBrands = [DEFAULT_LAJAN_RAPID_TENANT];
  const isLoading = false;
  const isCustomBrand = false;
  const logoSrc = logoAsset;

  return (
    <BrandContext.Provider
      value={{
        currentBrand,
        allBrands,
        isLoading,
        isCustomBrand,
        logoSrc,
        switchBrand: () => {},
        resetToDefault: () => {},
        applyTheme: () => {},
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextType {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    return {
      currentBrand: DEFAULT_LAJAN_RAPID_TENANT,
      allBrands: [DEFAULT_LAJAN_RAPID_TENANT],
      isLoading: false,
      isCustomBrand: false,
      logoSrc: logoAsset,
      switchBrand: () => {},
      resetToDefault: () => {},
      applyTheme: () => {},
    };
  }
  return ctx;
}
