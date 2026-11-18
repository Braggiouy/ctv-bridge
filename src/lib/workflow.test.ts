import { describe, expect, it } from "vitest";
import { addRecentProject } from "./workflow";

describe("addRecentProject", () => {
  it("moves the project to the front without duplicates", () => {
    expect(addRecentProject(["/a", "/b", "/c"], "/b")).toEqual([
      "/b",
      "/a",
      "/c",
    ]);
  });

  it("keeps the five most recent", () => {
    expect(addRecentProject(["/1", "/2", "/3", "/4", "/5"], "/6")).toEqual([
      "/6",
      "/1",
      "/2",
      "/3",
      "/4",
    ]);
  });
});
