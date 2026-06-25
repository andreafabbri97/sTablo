import { describe, it, expect } from "vitest";
import { canonicalPair } from "./chat-core";

describe("canonicalPair", () => {
  it("orders the two ids lexicographically", () => {
    expect(canonicalPair("aaa", "bbb")).toEqual({
      userAId: "aaa",
      userBId: "bbb",
    });
  });

  it("is symmetric — argument order does not matter", () => {
    const a = canonicalPair("zzz", "aaa");
    const b = canonicalPair("aaa", "zzz");
    expect(a).toEqual(b);
    expect(a).toEqual({ userAId: "aaa", userBId: "zzz" });
  });

  it("works with realistic uuids", () => {
    const u1 = "11111111-1111-1111-1111-111111111111";
    const u2 = "22222222-2222-2222-2222-222222222222";
    expect(canonicalPair(u2, u1)).toEqual({ userAId: u1, userBId: u2 });
  });
});
