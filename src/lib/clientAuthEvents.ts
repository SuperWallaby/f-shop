/** Browser event so header / other shells can refresh after login or logout. */
export const CLIENT_AUTH_CHANGED_EVENT = "fasea:client-auth-changed";

export function notifyClientAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLIENT_AUTH_CHANGED_EVENT));
}
