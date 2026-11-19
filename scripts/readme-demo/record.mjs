// Records .github/assets/ctv-bridge-demo.gif from the built UI and mock-api.cjs.
// Usage: bunx vite build && electron scripts/readme-demo/record.mjs
import { app, BrowserWindow } from "electron";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const output = path.join(root, ".github/assets/ctv-bridge-demo");
const frames = fs.mkdtempSync(path.join(os.tmpdir(), "ctv-bridge-demo-"));
// A throwaway profile, so the recording never reads real settings.
app.setPath("userData", path.join(frames, "profile"));

const WIDTH = 1200;
const HEIGHT = 720;

// Runs in the page: a fake cursor that glides to an element and clicks it.
const CURSOR = `
window.__cursor = (() => {
  const el = document.createElement("div");
  el.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  Object.assign(el.style, { position: "fixed", left: "0", top: "0", zIndex: 99999, pointerEvents: "none",
    transform: "translate(600px, 360px)", transition: "transform 650ms cubic-bezier(.4,0,.2,1)" });
  document.body.appendChild(el);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (target) => typeof target === "string"
    ? document.querySelector(target)
    : [...document.querySelectorAll(target.tag)].find((n) => n.textContent.trim() === target.text);
  return async (target) => {
    const node = find(target);
    if (!node) throw new Error("Not found: " + JSON.stringify(target));
    const box = node.getBoundingClientRect();
    el.style.transform = "translate(" + (box.left + box.width / 2 - 4) + "px," + (box.top + box.height / 2 - 2) + "px)";
    await sleep(750);
    el.firstChild.style.transform = "scale(0.8)";
    node.click();
    await sleep(140);
    el.firstChild.style.transform = "";
  };
})();
0;
`;

const SCRIPT = [
  ["wait", 1500],
  ["click", { tag: "button", text: "Debug" }],
  ["wait", 6500],
  ["click", '[aria-label="Right"]'],
  ["wait", 500],
  ["click", '[aria-label="Right"]'],
  ["wait", 500],
  ["click", '[aria-label="Down"]'],
  ["wait", 500],
  ["click", '[aria-label="OK"]'],
  ["wait", 1300],
  ["click", '[aria-label="Back"]'],
  ["wait", 900],
  ["click", '[aria-label="Take a screenshot of the app"]'],
  ["wait", 2400],
  ["click", { tag: "button", text: "Errors" }],
  ["wait", 1800],
  ["click", { tag: "button", text: "All" }],
  ["wait", 800],
  ["click", { tag: "button", text: "App logs" }],
  ["wait", 1800],
  ["click", { tag: "button", text: "App logs" }],
  ["wait", 2000],
];

const fail = (error) => {
  console.error(error);
  app.exit(1);
};
process.on("unhandledRejection", fail);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    useContentSize: true,
    webPreferences: {
      offscreen: true,
      preload: path.join(here, "mock-api.cjs"),
      contextIsolation: false,
      sandbox: false,
    },
  });

  const shots = [];
  let recording = false;
  win.webContents.setFrameRate(30);
  win.webContents.on("paint", (_event, _dirty, image) => {
    if (!recording) return;
    const file = path.join(
      frames,
      `${String(shots.length).padStart(5, "0")}.png`
    );
    fs.writeFileSync(file, image.toPNG());
    shots.push({ file, at: Date.now() });
  });

  await win.loadFile(path.join(root, "dist/index.html"));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await win.webContents.executeJavaScript(CURSOR);
  recording = true;
  win.webContents.invalidate();
  for (const [step, arg] of SCRIPT) {
    if (step === "wait")
      await new Promise((resolve) => setTimeout(resolve, arg));
    else
      await win.webContents.executeJavaScript(
        `window.__cursor(${JSON.stringify(arg)})`
      );
  }
  recording = false;

  // Paint events only fire on changes, so each frame lasts until the next one.
  const list = shots
    .map((shot, i) => {
      const next = shots[i + 1]?.at ?? shot.at + 1500;
      return `file '${shot.file}'\nduration ${((next - shot.at) / 1000).toFixed(3)}`;
    })
    .join("\n");
  const listFile = path.join(frames, "frames.txt");
  fs.writeFileSync(listFile, `${list}\nfile '${shots.at(-1).file}'\n`);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  const input = [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
  ];
  execFileSync("ffmpeg", [
    ...input,
    "-vf",
    "fps=15,scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    "-loop",
    "0",
    `${output}.gif`,
  ]);
  // An MP4 for posting as a native video (not committed).
  execFileSync("ffmpeg", [
    ...input,
    "-vf",
    "fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    path.join(frames, "ctv-bridge-demo.mp4"),
  ]);
  console.log(`${shots.length} frames → ${output}.gif`);
  console.log(`MP4: ${path.join(frames, "ctv-bridge-demo.mp4")}`);
  app.quit();
}, fail);
