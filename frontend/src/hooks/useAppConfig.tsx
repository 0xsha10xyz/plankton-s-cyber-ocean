import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AppConfigShape } from "@/lib/commandCenter/types";

const AppConfigContext = createContext<AppConfigShape | null>(null);

const EMPTY: AppConfigShape = { bitqueryToken: "", shyftKey: "" };

export function AppConfigProvider({ children }: { children: ReactNode }): JSX.Element {
  const [config, setConfig] = useState<AppConfigShape | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (data && typeof data === "object") {
          const o = data as Record<string, unknown>;
          setConfig({
            bitqueryToken: typeof o.bitqueryToken === "string" ? o.bitqueryToken : "",
            shyftKey: typeof o.shyftKey === "string" ? o.shyftKey : "",
          });
        } else {
          setConfig(EMPTY);
        }
      })
      .catch(() => {
        if (!cancelled) setConfig(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppConfigContext.Provider value={config ?? EMPTY}>{children}</AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfigShape {
  return useContext(AppConfigContext) ?? EMPTY;
}
