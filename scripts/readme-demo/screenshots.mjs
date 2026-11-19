// Renders the README stills from the built UI and mock-api.cjs, with made-up data.
// Usage: bunx vite build && electron scripts/readme-demo/screenshots.mjs
import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const assets = path.join(root, ".github/assets");
app.setPath(
  "userData",
  fs.mkdtempSync(path.join(os.tmpdir(), "ctv-bridge-stills-"))
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCENES = [
  { file: "screenshot-setup.png", scene: "setup", steps: [] },
  {
    file: "screenshot-add-tv.png",
    scene: "ready",
    steps: [
      `document.querySelector('[aria-label="Add a TV"]').click()`,
      "await new Promise((r) => setTimeout(r, 1000))",
      `[...document.querySelectorAll('[aria-label="TVs on your network"] button[aria-pressed]')][0].click()`,
      "await new Promise((r) => setTimeout(r, 300))",
    ],
  },
  // GitHub's social preview (Settings → General), shown when the repo link is shared.
  {
    file: "social-preview.png",
    scene: "ready",
    width: 1280,
    height: 640,
    steps: [
      `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Debug").click()`,
      "await new Promise((r) => setTimeout(r, 5500))",
      `document.querySelector('[aria-label="Right"]').click()`,
      `document.querySelector('[aria-label="Down"]').click()`,
      `document.querySelector('[aria-label="OK"]').click()`,
    ],
  },
];

// Each scene closes its window; don't quit until all are done.
app.on("window-all-closed", () => {});

app.whenReady().then(async () => {
  for (const { file, scene, steps, width = 1200, height = 800 } of SCENES) {
    const win = new BrowserWindow({
      width,
      height,
      show: false,
      useContentSize: true,
      webPreferences: {
        offscreen: true,
        preload: path.join(here, "mock-api.cjs"),
        contextIsolation: false,
        sandbox: false,
        additionalArguments: [`--demo-scene=${scene}`],
      },
    });
    await win.loadFile(path.join(root, "dist/index.html"));
    await sleep(1500);
    for (const step of steps) {
      await win.webContents.executeJavaScript(
        `(async () => { ${step}; })().then(() => 0)`
      );
      await sleep(400);
    }
    await sleep(600);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(assets, file), image.toPNG());
    console.log(`${file} written`);
    win.destroy();
  }
  app.quit();
});
