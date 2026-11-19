import { describe, expect, it } from "vitest";
import { addRecentProject, recentProjectLabels } from "./workflow";

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

describe("recentProjectLabels", () => {
  it("shows folder names, with the parent only when two clash", () => {
    expect(
      recentProjectLabels([
        "/work/strim/tizen",
        "/work/rikstv/tizen",
        "/work/tv4",
        "C:\\apps\\kids.apk",
      ])
    ).toEqual(["strim/tizen", "rikstv/tizen", "tv4", "kids.apk"]);
  });
});
