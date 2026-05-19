import { describe, expect, it } from "vitest";
import { MeshGraph } from "@/domain/rtc/meshGraph";

describe("MeshGraph", () => {
  it("ignores self", () => {
    const g = new MeshGraph("me");
    expect(g.addPeer("me")).toBe(false);
    expect(g.getRemotes().size).toBe(0);
  });

  it("adds and removes remotes", () => {
    const g = new MeshGraph("me");
    expect(g.addPeer("a")).toBe(true);
    expect(g.addPeer("a")).toBe(false);
    expect(g.shouldConnectTo("a")).toBe(true);
    expect(g.removePeer("a")).toBe(true);
    expect(g.shouldConnectTo("a")).toBe(false);
  });
});
