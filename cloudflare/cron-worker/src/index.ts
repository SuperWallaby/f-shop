export interface Env {
  TARGET_BASE_URL: string; // e.g. https://yourdomain.com
  AUTO_CANCEL_JOB_SECRET?: string;
}

type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void };
type ScheduledEventLike = { cron: string };
type ExportedHandlerLike<E> = {
  scheduled?: (event: ScheduledEventLike, env: E, ctx: ExecutionContextLike) => Promise<void> | void;
  fetch?: (req: Request, env: E, ctx: ExecutionContextLike) => Promise<Response> | Response;
};

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function postJob(args: {
  url: string;
  secret?: string;
  cf: ExecutionContextLike;
}): Promise<void> {
  const res = await fetch(args.url, {
    method: "POST",
    headers: args.secret ? { "x-job-secret": args.secret } : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Job failed: ${args.url} (${res.status}) ${text}`);
  }
}

export default {
  async scheduled(event: ScheduledEventLike, env: Env, ctx: ExecutionContextLike) {
    const base = (env.TARGET_BASE_URL ?? "").trim();
    if (!base) {
      console.error("Missing TARGET_BASE_URL");
      return;
    }

    // Cloudflare cron strings are in UTC.
    // We map based on the cron string configured in wrangler.toml.
    try {
      if (event.cron === "*/10 * * * *") {
        const url = joinUrl(base, "/api/admin/jobs/auto-cancel?horizonHours=48");
        await postJob({ url, secret: env.AUTO_CANCEL_JOB_SECRET, cf: ctx });
        return;
      }

      if (event.cron === "0 1 * * *") {
        const url = joinUrl(base, "/api/admin/jobs/reminders");
        await postJob({ url, secret: env.AUTO_CANCEL_JOB_SECRET, cf: ctx });
        return;
      }

      console.log("No handler for cron:", event.cron);
    } catch (e) {
      console.error("Cron run failed:", e);
    }
  },

  // Optional manual trigger endpoint (for quick validation).
  // Protect this worker in Cloudflare Dashboard if you expose it publicly.
  async fetch(req: Request, env: Env, ctx: ExecutionContextLike) {
    const url = new URL(req.url);
    if (url.pathname !== "/run") return new Response("Not found", { status: 404 });

    const base = (env.TARGET_BASE_URL ?? "").trim();
    if (!base) return new Response("Missing TARGET_BASE_URL", { status: 500 });

    const job = url.searchParams.get("job") ?? "";
    try {
      if (job === "auto-cancel") {
        await postJob({
          url: joinUrl(base, "/api/admin/jobs/auto-cancel?horizonHours=48"),
          secret: env.AUTO_CANCEL_JOB_SECRET,
          cf: ctx,
        });
        return new Response("ok");
      }
      if (job === "reminders") {
        await postJob({
          url: joinUrl(base, "/api/admin/jobs/reminders"),
          secret: env.AUTO_CANCEL_JOB_SECRET,
          cf: ctx,
        });
        return new Response("ok");
      }
      return new Response("Unknown job", { status: 400 });
    } catch (e) {
      return new Response(`failed: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
    }
  },
} satisfies ExportedHandlerLike<Env>;

