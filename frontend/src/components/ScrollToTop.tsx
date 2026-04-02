import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scroll window to top on route change and after full page load (avoids browser scroll restoration on refresh). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
