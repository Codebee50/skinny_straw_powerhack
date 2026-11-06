// Runs the repo's .venv Python (Windows or macOS/Linux) with the given args.
// Usage: node scripts/py.mjs -m pytest backend
//        node scripts/py.mjs --create-venv   (creates .venv with the system python)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const venvPy =
  process.platform === "win32"
    ? join(root, ".venv", "Scripts", "python.exe")
    : join(root, ".venv", "bin", "python");

const args = process.argv.slice(2);

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd: root });
  if (r.error) return null;
  return r.status ?? 1;
}

if (args[0] === "--create-venv") {
  if (existsSync(venvPy)) process.exit(0);
  for (const sys of process.platform === "win32" ? ["py", "python"] : ["python3", "python"]) {
    const status = run(sys, ["-m", "venv", ".venv"]);
    if (status === 0) process.exit(0);
  }
  console.error("Could not create .venv — install Python 3.11+ and retry.");
  process.exit(1);
}

if (!existsSync(venvPy)) {
  console.error("No .venv found. Run `npm run setup` first.");
  process.exit(1);
}
process.exit(run(venvPy, args) ?? 1);
