import { existsSync, readFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
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
  device: "chrome",
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

/** Best-effort LAN IPv4 for physical phones on the same Wi‑Fi. */
export function detectLanIp() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== "IPv4" && addr.family !== 4) continue;
      if (addr.internal) continue;
      if (addr.address.startsWith("169.254.")) continue;
      candidates.push({ name, address: addr.address });
    }
  }
  const score = (name) => {
    if (/^en0$/i.test(name)) return 0;
    if (/^(en\d|wlan\d|eth\d|Wi-?Fi)/i.test(name)) return 1;
    return 2;
  };
  candidates.sort((a, b) => score(a.name) - score(b.name) || a.name.localeCompare(b.name));
  return candidates[0]?.address ?? "127.0.0.1";
}

function physicalDevices(devices, platform) {
  return devices.filter(
    (d) => d.targetPlatform === platform && d.emulator === false,
  );
}

function iosSimulator(devices) {
  return devices.find((d) => d.targetPlatform === "ios" && d.emulator === true);
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
 * - `device` / `phone` / `physical` → connected phone (iOS, then Android), else simulator
 * - `ios` / `simulator` → physical iOS if plugged in, else booted iOS Simulator
 * - `android` → physical Android if plugged in, else Android emulator if any
 * - `chrome` → Flutter web
 * - anything else → passed through to `flutter run -d`
 */
export function resolveFlutterDevice(mobileRoot) {
  const raw = (process.env.FASEA_DEVICE ?? DEV_DEFAULTS.device).trim();
  const devices = flutterDevices(mobileRoot);

  if (raw === "chrome" || raw === "web") {
    return { id: "chrome", label: "Chrome (web)", isWeb: true, isPhysical: false };
  }

  const pickPhysical = (platform) => {
    const list = physicalDevices(devices, platform);
    if (list.length === 0) return null;
    const d = list[0];
    return {
      id: d.id,
      label: d.name,
      isWeb: false,
      isPhysical: true,
      targetPlatform: platform,
    };
  };

  let mode = raw;
  if (mode === "device" || mode === "phone" || mode === "physical") {
    const ios = pickPhysical("ios");
    if (ios) return ios;
    const android = pickPhysical("android");
    if (android) return android;
    mode = "ios";
  }

  if (mode === "android") {
    const physical = pickPhysical("android");
    if (physical) return physical;
    const emu = devices.find(
      (d) => d.targetPlatform === "android" && d.emulator === true,
    );
    if (emu) {
      return {
        id: emu.id,
        label: emu.name,
        isWeb: false,
        isPhysical: false,
        targetPlatform: "android",
      };
    }
    throw new Error(
      "No Android device found. Plug in a phone (USB debugging on) or start an emulator.",
    );
  }

  if (mode === "simulator") {
    let sim = iosSimulator(devices);
    if (!sim) {
      bootIosSimulator(mobileRoot);
      sim = waitForIosSimulator(mobileRoot);
    }
    return {
      id: sim.id,
      label: sim.name,
      isWeb: false,
      isPhysical: false,
      targetPlatform: "ios",
    };
  }

  if (mode === "ios") {
    const physical = pickPhysical("ios");
    if (physical) return physical;

    let sim = iosSimulator(devices);
    if (!sim) {
      bootIosSimulator(mobileRoot);
      sim = waitForIosSimulator(mobileRoot);
    }
    return {
      id: sim.id,
      label: sim.name,
      isWeb: false,
      isPhysical: false,
      targetPlatform: "ios",
    };
  }

  const explicit = devices.find((d) => d.id === raw);
  if (explicit) {
    return {
      id: explicit.id,
      label: explicit.name,
      isWeb: false,
      isPhysical: explicit.emulator === false,
      targetPlatform: explicit.targetPlatform,
    };
  }

  return { id: raw, label: raw, isWeb: false, isPhysical: false };
}

export function flutterRunArgs({ device, apiPort, webPort, apiBaseUrl }) {
  const args = [
    "run",
    "-d",
    device.id,
    "--dart-define=FASEA_API_PORT=" + apiPort,
  ];
  if (apiBaseUrl) {
    args.push("--dart-define=API_BASE_URL=" + apiBaseUrl);
  }
  if (device.isWeb) {
    args.push("--web-port", webPort);
  }
  return args;
}

/** USB Android: optional `adb reverse` so localhost works without Wi‑Fi. */
export function setupAndroidUsbForward(apiPort) {
  try {
    execSync(`adb reverse tcp:${apiPort} tcp:${apiPort}`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
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

/** Kill any process listening on [port] (best-effort, macOS/Linux). */
export async function freePort(port) {
  const p = Number(port);
  if (!Number.isFinite(p) || p <= 0) return false;

  let pids = [];
  try {
    const out = execSync(`lsof -ti tcp:${p} -sTCP:LISTEN`, {
      encoding: "utf8",
    }).trim();
    if (out) pids = [...new Set(out.split("\n").filter(Boolean))];
  } catch {
    return false;
  }

  if (pids.length === 0) return false;

  for (const pid of pids) {
    console.log(`[dev] freeing port ${p} — killing PID ${pid}`);
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {
      // ignore
    }
  }

  await sleep(400);
  return true;
}

export async function freeDevPorts({ webPort, apiPort }) {
  await freePort(apiPort);
  await freePort(webPort);
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

  console.log(`[dev] starting API (next dev) on http://0.0.0.0:${apiPort}…`);
  const child = spawn(
    "npx",
    ["next", "dev", "-H", "0.0.0.0", "-p", String(apiPort)],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(apiPort),
        FASEA_API_PORT: String(apiPort),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

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
