#!/usr/bin/env node
/**
 * Flutter dev on iOS Simulator with auto hot-reload (5s throttle).
 *
 *   yarn app
 *
 * Reads repo `.env.local` for FASEA_DEVICE / FASEA_API_PORT.
 * Set FASEA_DEVICE=chrome to use Flutter web instead.
 */
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  devPorts,
  ensureApiServer,
  flutterRunArgs,
  loadEnvLocal,
  repoRootFromMobile,
  resolveFlutterDevice,
} from "./load_env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = path.join(__dirname, "..");
const REPO_ROOT = repoRootFromMobile(MOBILE_ROOT);

loadEnvLocal();
const { webPort, apiPort } = devPorts();
const device = resolveFlutterDevice(MOBILE_ROOT);
const THROTTLE_MS = Number(process.env.FASEA_RELOAD_THROTTLE_MS ?? 5000);

const { process: apiProcess, startedByUs: apiStartedByUs } = await ensureApiServer(
  REPO_ROOT,
  apiPort,
);

let lastReloadAt = 0;
let throttleTimer = null;
let flutterReady = false;
let pendingKind = "r";

const flutter = spawn("flutter", flutterRunArgs({ device, apiPort, webPort }), {
  cwd: MOBILE_ROOT,
  stdio: ["pipe", "pipe", "inherit"],
});

flutter.stdout.on("data", (buf) => {
  process.stdout.write(buf);
  if (flutterReady) return;
  const text = buf.toString();
  if (
    text.includes("To hot restart") ||
    text.includes("Debug service listening") ||
    text.includes("is available at") ||
    text.includes("A Dart VM Service") ||
    text.includes("Syncing files to device")
  ) {
    flutterReady = true;
    console.log(
      `\n[dev] watching lib/ + assets/ — auto reload (throttle ${THROTTLE_MS}ms)\n`,
    );
  }
});

flutter.on("exit", (code) => {
  console.log(`[dev] flutter exited (${code ?? "signal"})`);
  shutdown(code ?? 0);
});

function shutdown(exitCode = 0) {
  if (throttleTimer) clearTimeout(throttleTimer);
  if (apiStartedByUs && apiProcess && !apiProcess.killed) {
    console.log("[dev] stopping API…");
    apiProcess.kill("SIGTERM");
  }
  process.exit(exitCode);
}

function flushReload() {
  throttleTimer = null;
  if (!flutterReady || flutter.killed) return;
  lastReloadAt = Date.now();
  const kind = pendingKind;
  pendingKind = "r";
  try {
    flutter.stdin.write(kind);
    console.log(`[dev] ${kind === "R" ? "hot restart" : "hot reload"}`);
  } catch (err) {
    console.warn("[dev] reload failed:", err.message);
  }
}

function scheduleReload(kind = "r") {
  if (!flutterReady) return;
  if (kind === "R") pendingKind = "R";

  const elapsed = Date.now() - lastReloadAt;
  const wait = Math.max(0, THROTTLE_MS - elapsed);

  if (wait === 0 && !throttleTimer) {
    flushReload();
    return;
  }

  if (throttleTimer) return;
  throttleTimer = setTimeout(flushReload, wait);
}

function shouldReload(file) {
  if (!file) return false;
  if (file.endsWith(".dart")) return true;
  if (file === "pubspec.yaml" || file.endsWith("/pubspec.yaml")) return true;
  if (file.startsWith("assets/")) return true;
  return false;
}

function needsRestart(file) {
  return (
    file === "pubspec.yaml" ||
    file.endsWith("/pubspec.yaml") ||
    file.startsWith("assets/")
  );
}

function watchDir(relDir) {
  const abs = path.join(MOBILE_ROOT, relDir);
  watch(abs, { recursive: true }, (_event, file) => {
    if (!shouldReload(file)) return;
    scheduleReload(needsRestart(file) ? "R" : "r");
  });
  console.log(`[dev] watch ${relDir}/`);
}

watchDir("lib");
watchDir("assets");

watch(MOBILE_ROOT, (_event, file) => {
  if (file !== "pubspec.yaml") return;
  scheduleReload("R");
});

process.on("SIGINT", () => {
  flutter.kill("SIGINT");
});

process.on("SIGTERM", () => {
  flutter.kill("SIGTERM");
});

if (device.isWeb) {
  console.log(
    `[dev] ${device.label} http://localhost:${webPort} → API http://localhost:${apiPort}`,
  );
} else {
  console.log(`[dev] ${device.label} → API http://localhost:${apiPort}`);
}
