// One command for presenting: starts the API and the website together.
//
//   npm run demo                 production build of the site + API (fastest, most stable)
//   npm run demo:dev             dev server instead of a production build
//   npm run demo -- --web-port 3001
//
// Ctrl+C stops both. If the API stops mid-demo, the site keeps running and switches to the
// offline snapshot in frontend/public/fallback (nav shows "Offline data").
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const venvPy = isWin ? join(root, ".venv", "Scripts", "python.exe") : join(root, ".venv", "bin", "python");

const args = process.argv.slice(2);
const dev = args.includes("--dev");
const portArg = args.indexOf("--web-port");
const WEB_PORT = portArg >= 0 ? Number(args[portArg + 1]) : 3000;
const API_PORT = 8000;

const color = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const say = (msg) => console.log(color("1", `[demo] ${msg}`));

function fail(msg) {
  console.error(color("31", `[demo] ${msg}`));
  process.exit(1);
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

async function isUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- preflight ---------------------------------------------------------------

if (!existsSync(venvPy)) fail("Python environment not found. Run `npm run setup` first.");
if (!existsSync(join(root, "frontend", "node_modules"))) fail("Frontend packages not installed. Run `npm run setup` first.");
if (!existsSync(join(root, "frontend", "public", "fallback", "manifest.json")))
  say("No offline snapshot found. Run `npm run export-fallback` so the demo survives an API outage.");

if (await portInUse(API_PORT)) fail(`Port ${API_PORT} is already in use. Stop the other backend (or close its terminal) and retry.`);
if (await portInUse(WEB_PORT))
  fail(`Port ${WEB_PORT} is already in use. Stop the other website/dev server and retry, or use --web-port 3001.`);

if (!dev) {
  say("Building the website (production)…");
  const build = spawnSync("npm", ["--prefix", "frontend", "run", "build"], { cwd: root, stdio: "inherit", shell: isWin });
  if (build.status !== 0) fail("Website build failed. Fix the errors above, or try `npm run demo:dev`.");
}

// ---- start both ---------------------------------------------------------------

const children = new Map();

function pipe(stream, label, code) {
  let buf = "";
  stream.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) if (line.trim()) console.log(`${color(code, label)} ${line}`);
  });
}

function start(name, cmd, cmdArgs, opts, labelColor) {
  const child = spawn(cmd, cmdArgs, { cwd: root, env: process.env, detached: !isWin, ...opts });
  pipe(child.stdout, `[${name}]`, labelColor);
  pipe(child.stderr, `[${name}]`, labelColor);
  children.set(name, child);
  child.on("exit", (code) => {
    children.delete(name);
    if (shuttingDown) return;
    const how = code === null || code > 255 ? "was killed" : `exited with code ${code}`;
    if (name === "api") {
      say(color("33", `The API ${how}. The site keeps running on offline data. Restart it with: npm run backend`));
    } else {
      say(`The website ${how}. Shutting down.`);
      shutdown(1);
    }
  });
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.values()) {
    if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGHUP", () => shutdown(0)); // terminal window closed

say("Starting the API on port 8000…");
start(
  "api",
  venvPy,
  ["-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", String(API_PORT)],
  {},
  "36",
);

say(`Starting the website on port ${WEB_PORT}${dev ? " (dev mode)" : ""}…`);
start(
  "web",
  "npm",
  ["--prefix", "frontend", "run", dev ? "dev" : "start", "--", "-p", String(WEB_PORT)],
  { shell: isWin },
  "35",
);

// ---- wait until ready ---------------------------------------------------------

const deadline = Date.now() + 90_000;
let apiReady = false;
let webReady = false;
while (Date.now() < deadline && !(apiReady && webReady) && !shuttingDown) {
  apiReady ||= await isUp(`http://127.0.0.1:${API_PORT}/api/health`);
  webReady ||= await isUp(`http://127.0.0.1:${WEB_PORT}/minimum`);
  if (!(apiReady && webReady)) await new Promise((r) => setTimeout(r, 750));
}

const url = `http://localhost:${WEB_PORT}`;
const bar = "─".repeat(52);
if (webReady) {
  console.log(`\n${color("32", bar)}`);
  console.log(color("32", `  Demo ready:  ${url}`));
  console.log(
    apiReady
      ? color("32", "  Data: live API (http://localhost:8000)")
      : color("33", "  Data: API not responding, so the site uses offline data"),
  );
  console.log(color("32", "  Press Ctrl+C to stop both."));
  console.log(`${color("32", bar)}\n`);
} else if (!shuttingDown) {
  say(color("31", `The website didn't come up within 90s. Check the [web] lines above.`));
}
