/** True when the client is signed in but has no display name yet. */
export function clientNeedsName(me: {
  authed?: boolean;
  needsName?: boolean;
  client?: { name?: string | null } | null;
}): boolean {
  if (!me.authed) return false;
  if (me.needsName) return true;
  return !(me.client?.name ?? "").trim();
}
