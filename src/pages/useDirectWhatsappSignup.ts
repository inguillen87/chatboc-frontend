import { useCallback, useRef, useState } from "react";
import { DIRECT_SIGNUP_CONTRACT, tenantService, type DirectSignupReceipt } from "@/services/tenantService";
import { ApiError } from "@/utils/api";
import { safeSessionStorage } from "@/utils/safeLocalStorage";

const validState = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

type Phase = "ready" | "prepared" | "resume" | "connected";
type Completion = Parameters<typeof tenantService.finishDirectWhatsappSignup>[1];
const pageLabelKeys = [
  "prepare", "resume", "done", "restored", "prepared", "prepare_failed",
  "connected", "new_authorization", "register_phone", "pending", "unknown", "choose_phone",
  "cancelled", "provider_error", "not_authorized", "sending", "checking",
] as const;
type Label = typeof pageLabelKeys[number];
export type DirectSignupLabels = Record<Label, string>;
export const hasDirectSignupLabels = (labels: unknown): labels is DirectSignupLabels =>
  Boolean(labels && typeof labels === "object" && pageLabelKeys.every(key =>
    typeof (labels as Partial<DirectSignupLabels>)[key] === "string" && (labels as DirectSignupLabels)[key].trim()));

// The enclosing form remounts whenever its actor, tenant or Meta configuration changes.
export function useDirectWhatsappSignup(tenant: string | null, storageKey: string | null, mounted: React.RefObject<boolean>) {
  const [restored] = useState(() => storageKey && safeSessionStorage.getItem(storageKey));
  const state = useRef(validState(restored) ? restored : null);
  const expiresAt = useRef(0);
  const [phase, setPhase] = useState<Phase>(state.current ? "resume" : "ready");
  const [message, setMessage] = useState<Label | null>(state.current ? "restored" : null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const clear = useCallback(() => {
    if (storageKey) safeSessionStorage.removeItem(storageKey);
    state.current = null;
    expiresAt.current = 0;
  }, [storageKey]);

  const reset = useCallback((message: Label) => {
    clear();
    setPhase("ready");
    setMessage(message);
  }, [clear]);

  const prepare = async () => {
    if (!tenant || !storageKey || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const receipt = await tenantService.startDirectWhatsappSignup(tenant);
      if (!mounted.current) return;
      if (receipt?.contract_version !== DIRECT_SIGNUP_CONTRACT || receipt.ok !== true ||
          !validState(receipt.signup_state) || !Number.isSafeInteger(receipt.expires_in) || !(receipt.expires_in! > 0)) {
        throw new Error("invalid_receipt");
      }
      state.current = receipt.signup_state;
      expiresAt.current = Date.now() + receipt.expires_in! * 1000;
      setPhase("prepared");
      setMessage("prepared");
    } catch {
      if (mounted.current) reset("prepare_failed");
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const processReceipt = useCallback((receipt?: DirectSignupReceipt) => {
    if (receipt?.contract_version === DIRECT_SIGNUP_CONTRACT) {
      if (receipt.ok === true && receipt.status === "connected") {
        clear();
        setPhase("connected");
        setMessage("connected");
        return;
      }
      if (receipt.ok === false && (receipt.status === "rejected" || [
        "meta_signup_new_authorization_required", "meta_signup_credential_reauthorization_required",
        "meta_signup_session_expired", "meta_signup_session_invalid", "meta_signup_completion_required",
        "meta_signup_credential_expired", "meta_signup_binding_changed", "meta_signup_assets_invalid",
        "meta_signup_code_invalid", "meta_signup_asset_in_use", "meta_signup_asset_reserved",
      ].includes(receipt.reason_code ?? ""))) {
        reset("new_authorization");
        return;
      }
    }
    setPhase("resume");
    setMessage(receipt?.contract_version === DIRECT_SIGNUP_CONTRACT && receipt.ok === false &&
        ["pending", "exchanging"].includes(receipt.status ?? "")
      ? receipt.reason_code === "meta_phone_registration_pending"
        ? "register_phone"
        : "pending"
      : "unknown");
  }, [clear, reset]);

  const submit = useCallback(async (completion?: Omit<Completion, "signup_state">) => {
    if (!tenant || !storageKey || !state.current || locked.current) return;
    locked.current = true;
    setBusy(true);
    const signupState = state.current;
    // Persist only the opaque handle before the request; its result may be lost on reload.
    safeSessionStorage.setItem(storageKey, signupState);
    setPhase("resume");
    setMessage(completion ? "sending" : "checking");
    try {
      const receipt = completion
        ? await tenantService.finishDirectWhatsappSignup(tenant, { ...completion, signup_state: signupState })
        : await tenantService.resumeDirectWhatsappSignup(tenant, signupState);
      if (mounted.current) processReceipt(receipt);
    } catch (err) {
      if (mounted.current) processReceipt(err instanceof ApiError ? err.body : undefined);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [tenant, storageKey, mounted, processReceipt]);

  return { phase, message, busy, expiresAt, prepare, reset, submit };
}
