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
    if (!base) throw new Error("Missing TARGET_BASE_URL");

    // Cloudflare cron strings are in UTC.
    // We map based on the cron string configured in wrangler.toml.
    try {
      if (event.cron === "*/10 * * * *") {
        const jobs = [
          joinUrl(base, "/api/admin/jobs/auto-cancel?horizonHours=48"),
          joinUrl(base, "/api/admin/jobs/pending-booking-reminders"),
        ];
        const results = await Promise.allSettled(
          jobs.map((url) =>
            postJob({ url, secret: env.AUTO_CANCEL_JOB_SECRET, cf: ctx }),
          ),
        );
        const failed = results.filter(
          (result) => result.status === "rejected",
        );
        if (failed.length > 0) {
          throw new Error(`${failed.length}/${jobs.length} scheduled jobs failed`);
        }
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
      // Rethrow so Cloudflare records the invocation as failed.
      throw e;
    }
  },

  // No public manual trigger: anyone reaching the worker URL could run jobs.
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandlerLike<Env>;

