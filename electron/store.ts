import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { SdkPaths } from "../shared/ipc";
import { logger } from "./utils/logger";

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
        // Up to 1.4 the file held SdkPaths at its root.
        if (raw && !raw.sdkPaths && !raw.extras) {
          return { sdkPaths: raw, extras: {} };
        }
        return { sdkPaths: raw.sdkPaths ?? {}, extras: raw.extras ?? {} };
      }
    } catch (error) {
      logger.error("Failed to load settings", error);
    }
    return { sdkPaths: {}, extras: {} };
  }

  private save() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      logger.error("Failed to save settings", error);
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

  getExtra<T>(key: string): T | undefined {
    return this.data.extras[key] as T | undefined;
  }

  setExtra(key: string, value: unknown) {
    this.data.extras[key] = value;
    this.save();
  }
}

export const store = new Store();
