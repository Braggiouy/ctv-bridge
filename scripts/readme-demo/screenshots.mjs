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

// Fills a React-controlled input the way typing would.
const fill = (selector, value) => `(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event("input", { bubbles: true }));
})()`;

const SCENES = [
  { file: "screenshot-setup.png", scene: "setup", steps: [] },
  {
    file: "screenshot-add-tv.png",
    scene: "ready",
    steps: [
      `document.querySelector('[aria-label="Add a TV"]').click()`,
      fill('input[placeholder="Living room TV"]', "Kitchen TV"),
      fill('input[placeholder="192.168.1.100"]', "192.0.2.12"),
      `document.querySelector('input[placeholder="192.168.1.100"]').focus()`,
    ],
  },
];

// Each scene closes its window; don't quit until all are done.
app.on("window-all-closed", () => {});

app.whenReady().then(async () => {
  for (const { file, scene, steps } of SCENES) {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
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
      await win.webContents.executeJavaScript(`${step}; 0`);
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
