import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";

/**
 * Gate a screen to a specific account type.
 * need: 'user' | 'host'
 * Returns true when the current account is NOT allowed (caller should render nothing).
 */
export function useRequireAccount(need) {
  const { loggedIn, accountType, authReady, toast } = useApp();
  const { t } = useT();
  const nav = useNavigate();
  const ok = loggedIn && accountType === need;

  useEffect(() => {
    if (!authReady || ok) return; // wait for auth to resolve before redirecting
    if (!loggedIn) {
      toast(t("guard.signInFirst"));
      nav("/login", { replace: true });
    } else if (accountType === "host") {
      toast(t("guard.hostArea"));
      nav("/host", { replace: true });
    } else {
      toast(t("guard.guestArea"));
      nav("/me", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, authReady]);

  // blocked while auth resolving or not allowed
  return !authReady || !ok;
}
