import { app } from "electron";
import fs from "fs";
import path from "path";

interface SdkPaths {
  sdbPath?: string;
  tizenPath?: string;
  aresPath?: string;
  adbPath?: string;
}

interface StoreData {
  sdkPaths: SdkPaths;
  extras: Record<string, unknown>;
}

class Store {
  private storePath: string;
  private data: StoreData;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.storePath = path.join(userDataPath, "sdk-config.json");
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = JSON.parse(fs.readFileSync(this.storePath, "utf-8"));
        // Migrate from old flat format (SdkPaths at root) to new nested format
        if (raw && !raw.sdkPaths && !raw.extras) {
          return { sdkPaths: raw, extras: {} };
        }
        return { sdkPaths: raw.sdkPaths ?? {}, extras: raw.extras ?? {} };
      }
    } catch (error) {
      console.error("Error loading store:", error);
    }
    return { sdkPaths: {}, extras: {} };
  }

  private save() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Error saving store:", error);
    }
  }

  get(key: keyof SdkPaths): string | undefined {
    return this.data.sdkPaths[key];
  }

  set(key: keyof SdkPaths, value: string) {
    this.data.sdkPaths[key] = value;
    this.save();
  }

  setAll(paths: SdkPaths) {
    this.data.sdkPaths = { ...this.data.sdkPaths, ...paths };
    this.save();
  }

  getAll(): SdkPaths {
    return { ...this.data.sdkPaths };
  }

  /** Get a cached value from the extras bucket */
  getExtra<T>(key: string): T | undefined {
    return this.data.extras[key] as T | undefined;
  }

  /** Set a cached value in the extras bucket */
  setExtra(key: string, value: unknown) {
    this.data.extras[key] = value;
    this.save();
  }
}

export const store = new Store();
