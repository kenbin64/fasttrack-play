// prepare-mobile.mjs
// Capacitor copies the whole of www into the app bundle, which is right for the
// game and wrong for everything beside it. The test suites, the crash probe and
// the Electron desktop source all live in www/fasttrack because that is where
// they belong for development, and none of them has any business inside a
// shipped Android or iOS app: they add weight, they ship source nobody needs,
// and a test file reachable from a store build is just untidy.
//
// So: sync as normal, then prune. Run this instead of `cap sync`.
//
//   node scripts/prepare-mobile.mjs
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const say = (s) => console.log(s);

say("syncing web assets into the native projects...");
execSync("npx --no-install cap sync", { cwd: ROOT, stdio: "inherit" });

// Everything Capacitor just laid down, per platform.
const targets = [
  path.join(ROOT, "android", "app", "src", "main", "assets", "public"),
  path.join(ROOT, "ios", "App", "App", "public"),
].filter((p) => fs.existsSync(p));

// What does not belong in a store build.
const dropDir = ["electron", "_archive", "engine"];
const dropFile = (name) => /^(test_|probe_)/.test(name) || /\.test\.(js|mjs)$/.test(name);

let removed = 0, bytes = 0;
for (const root of targets) {
  const ft = path.join(root, "fasttrack");
  if (!fs.existsSync(ft)) continue;

  // Tests do not only live beside the game. There are more under fasttrack/v2
  // and under js/manifold-core, and the first version of this pruned only the
  // one directory and left eleven of them in the bundle.
  prune(root);

  for (const d of dropDir) {
    const p = path.join(ft, d);
    if (!fs.existsSync(p)) continue;
    bytes += dirSize(p);
    fs.rmSync(p, { recursive: true, force: true });
    removed++;
    say(`  dropped ${path.relative(ROOT, p)}`);
  }
  for (const f of fs.readdirSync(ft)) {
    if (!dropFile(f)) continue;
    const p = path.join(ft, f);
    bytes += fs.statSync(p).size;
    fs.rmSync(p, { force: true });
    removed++;
  }
  say(`  pruned ${path.relative(ROOT, root)}`);
}

// Walk the whole bundle and take out anything that is a test, a probe, or a
// desktop or archive directory, wherever it happens to sit.
function prune(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (dropDir.includes(e.name)) {
        bytes += dirSize(p);
        fs.rmSync(p, { recursive: true, force: true });
        removed++;
        say(`  dropped ${path.relative(ROOT, p)}`);
      } else {
        prune(p);
      }
    } else if (dropFile(e.name)) {
      bytes += fs.statSync(p).size;
      fs.rmSync(p, { force: true });
      removed++;
    }
  }
}

function dirSize(p) {
  let n = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const q = path.join(p, e.name);
    n += e.isDirectory() ? dirSize(q) : fs.statSync(q).size;
  }
  return n;
}

say(`\nremoved ${removed} items, ${(bytes / 1e6).toFixed(1)} MB, from the shipped bundle`);
say("the web deploy is untouched: this only prunes what Capacitor copied.");
