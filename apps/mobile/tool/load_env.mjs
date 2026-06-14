import { existsSync, readFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load repo `.env.local` into `process.env` (does not override existing). */
export function loadEnvLocal() {
  const candidates = [
    path.join(__dirname, "..", "..", ".env.local"),
    path.join(__dirname, "..", ".env.local"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      const comment = value.indexOf(" #");
      if (comment >= 0) value = value.slice(0, comment).trim();
      value = value.replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
    return file;
  }
  return null;
}

/** Dev defaults — keep in sync with `.env.local`. */
export const DEV_DEFAULTS = {
  webPort: "7357",
  apiPort: "4819",
  device: "ios",
};

export function devPorts() {
  const webPort = process.env.FASEA_WEB_PORT ?? DEV_DEFAULTS.webPort;
  const apiPort =
    process.env.FASEA_API_PORT ?? process.env.PORT ?? DEV_DEFAULTS.apiPort;
  return { webPort, apiPort };
}

function flutterDevices(mobileRoot) {
  const out = execSync("flutter devices --machine", {
    cwd: mobileRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out);
}

function bootIosSimulator(mobileRoot) {
  console.log("[dev] launching iOS Simulator…");
  execSync("flutter emulators --launch apple_ios_simulator", {
    cwd: mobileRoot,
    stdio: "inherit",
  });
}

function waitForIosSimulator(mobileRoot, attempts = 24) {
  for (let i = 0; i < attempts; i += 1) {
    const sim = flutterDevices(mobileRoot).find(
      (d) => d.targetPlatform === "ios" && d.emulator === true,
    );
    if (sim) return sim;
    execSync("sleep 1");
  }
  throw new Error("iOS Simulator did not appear. Open Simulator manually and retry.");
}

/**
 * Resolve `FASEA_DEVICE`:
 * - `ios` / `simulator` → booted iOS Simulator (launches if needed)
 * - `chrome` → Flutter web
 * - anything else → passed through to `flutter run -d`
 */
export function resolveFlutterDevice(mobileRoot) {
  const requested = (process.env.FASEA_DEVICE ?? DEV_DEFAULTS.device).trim();
  if (requested === "chrome" || requested === "web") {
    return { id: "chrome", label: "Chrome (web)", isWeb: true };
  }
  if (requested === "ios" || requested === "simulator") {
    let sim = flutterDevices(mobileRoot).find(
      (d) => d.targetPlatform === "ios" && d.emulator === true,
    );
    if (!sim) {
      bootIosSimulator(mobileRoot);
      sim = waitForIosSimulator(mobileRoot);
    }
    return { id: sim.id, label: sim.name, isWeb: false };
  }
  return { id: requested, label: requested, isWeb: false };
}

export function flutterRunArgs({ device, apiPort, webPort }) {
  const args = [
    "run",
    "-d",
    device.id,
    "--dart-define=FASEA_API_PORT=" + apiPort,
  ];
  if (device.isWeb) {
    args.push("--web-port", webPort);
  }
  return args;
}

/** Returns true when Next.js is listening on [apiPort]. */
export function isApiListening(apiPort, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect(
      { host, port: Number(apiPort) },
      () => {
        socket.end();
        resolve(true);
      },
    );
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefixLines(stream, tag) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.length > 0) console.log(`${tag} ${line}`);
    }
  });
}

/**
 * Start `yarn dev` when nothing is listening on [apiPort].
 * Returns the child process only when this script started it.
 */
export async function ensureApiServer(repoRoot, apiPort, { timeoutMs = 120000 } = {}) {
  if (await isApiListening(apiPort)) {
    console.log(`[dev] API already running http://localhost:${apiPort}`);
    return { process: null, startedByUs: false };
  }

  console.log(`[dev] starting API (yarn dev) on http://localhost:${apiPort}…`);
  const child = spawn("yarn", ["dev"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(apiPort),
      FASEA_API_PORT: String(apiPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  prefixLines(child.stdout, "[api]");
  prefixLines(child.stderr, "[api]");

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error("[dev] API server exited before it became ready");
    }
    if (await isApiListening(apiPort)) {
      console.log(`[dev] API ready http://localhost:${apiPort}`);
      return { process: child, startedByUs: true };
    }
    await sleep(500);
  }

  child.kill("SIGTERM");
  throw new Error(
    `[dev] API did not listen on port ${apiPort} within ${timeoutMs / 1000}s`,
  );
}

export function repoRootFromMobile(mobileRoot) {
  return path.join(mobileRoot, "..", "..");
}
