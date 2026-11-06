// `npm run backend`: FastAPI on :8000, restarted automatically when backend/app/**/*.py changes.
//
// Why not `uvicorn --reload`? On Windows its reloader stops the worker by sending a console-wide
// Ctrl+C. Started through npm, that also hits the npm.cmd batch wrapper ("Terminate batch job
// (Y/N)?") and kills the whole backend, or the worker ignores it and keeps serving stale code.
// So this script runs a plain uvicorn and does the restarting itself, the same on every OS.
//
//   npm run backend                 auto-restart on code changes (default)
//   npm run backend -- --no-reload  plain server
import { spawn, spawnSync } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const venvPy = isWin ? join(root, ".venv", "Scripts", "python.exe") : join(root, ".venv", "bin", "python");
const appDir = join(root, "backend", "app");

if (!existsSync(venvPy)) {
  console.error("No .venv found. Run `npm run setup` first.");
  process.exit(1);
}

const reload = !process.argv.includes("--no-reload");
const args = ["-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", "8000"];
const log = (msg) => console.log(`[backend] ${msg}`);

let child = null;
let restarting = false;
let stopping = false;

function startServer() {
  const proc = spawn(venvPy, args, {
    cwd: root,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    stdio: "inherit",
    windowsHide: true,
  });
  child = proc;
  proc.on("exit", (code) => {
    if (child === proc) child = null;
    if (stopping) return;
    if (restarting) {
      restarting = false;
      startServer();
    } else if (reload) {
      log(`server exited (code ${code}). Fix the error and save a file to restart.`);
    } else {
      process.exit(code ?? 1);
    }
  });
}

function killServer() {
  if (!child) return;
  if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

function stop() {
  if (stopping) return;
  stopping = true;
  killServer();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGHUP", stop); // terminal window closed

startServer();

if (reload) {
  let timer = null;
  watch(appDir, { recursive: true }, (_event, file) => {
    if (!file || !file.endsWith(".py") || file.includes("__pycache__")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      log(`${file} changed, restarting…`);
      if (child) {
        restarting = true;
        killServer();
      } else {
        startServer();
      }
    }, 300);
  });
  log("watching backend/app for changes");
}
