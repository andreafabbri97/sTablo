import { describe, it, expect } from "vitest";
import { buildCommentThreads, type CommentView } from "./social";

/** Minimal CommentView builder — only the fields the grouping cares about. */
function c(id: string, parentId: string | null, day: number): CommentView {
  return {
    id,
    body: `comment ${id}`,
    createdAt: new Date(2026, 0, day),
    userId: `u-${id}`,
    authorName: id.toUpperCase(),
    authorSlug: null,
    avatarColor: 0,
    avatarUrl: null,
    parentId,
  };
}

describe("buildCommentThreads", () => {
  it("returns an empty array for no comments", () => {
    expect(buildCommentThreads([])).toEqual([]);
  });

  it("keeps roots in order, each with an empty replies list", () => {
    const threads = buildCommentThreads([c("a", null, 1), c("b", null, 2)]);
    expect(threads.map((t) => t.id)).toEqual(["a", "b"]);
    expect(threads.every((t) => t.replies.length === 0)).toBe(true);
  });

  it("nests replies under their root, oldest-first, preserving root order", () => {
    // flat list is oldest-first as the query returns it
    const flat = [
      c("a", null, 1),
      c("a1", "a", 2),
      c("b", null, 3),
      c("a2", "a", 4),
      c("b1", "b", 5),
    ];
    const threads = buildCommentThreads(flat);
    expect(threads.map((t) => t.id)).toEqual(["a", "b"]);
    expect(threads[0].replies.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(threads[1].replies.map((r) => r.id)).toEqual(["b1"]);
  });

  it("promotes an orphan reply (missing parent) to a root so it is never hidden", () => {
    const threads = buildCommentThreads([c("a", null, 1), c("x", "ghost", 2)]);
    expect(threads.map((t) => t.id)).toEqual(["a", "x"]);
    const orphan = threads.find((t) => t.id === "x")!;
    expect(orphan.replies).toEqual([]);
  });

  it("does not treat a reply as a parent (one level deep only)", () => {
    // a1 replies to a; a1a points at a1 (a reply), which is not a root → orphan-promoted
    const flat = [c("a", null, 1), c("a1", "a", 2), c("a1a", "a1", 3)];
    const threads = buildCommentThreads(flat);
    expect(threads.map((t) => t.id)).toEqual(["a", "a1a"]);
    expect(threads[0].replies.map((r) => r.id)).toEqual(["a1"]);
  });
});
