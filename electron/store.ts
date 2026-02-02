import { app } from "electron";
import fs from "fs";
import path from "path";

interface SdkPaths {
  sdbPath?: string;
  tizenPath?: string;
  aresPath?: string;
  adbPath?: string;
}

class Store {
  private storePath: string;
  private data: SdkPaths;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.storePath = path.join(userDataPath, "sdk-config.json");
    this.data = this.load();
  }

  private load(): SdkPaths {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading store:", error);
    }
    return {};
  }

  private save() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Error saving store:", error);
    }
  }

  get(key: keyof SdkPaths): string | undefined {
    return this.data[key];
  }

  set(key: keyof SdkPaths, value: string) {
    this.data[key] = value;
    this.save();
  }

  setAll(paths: SdkPaths) {
    this.data = { ...this.data, ...paths };
    this.save();
  }

  getAll(): SdkPaths {
    return { ...this.data };
  }
}

export const store = new Store();
