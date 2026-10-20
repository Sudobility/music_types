import { describe, expect, it } from "vitest";
import {
  FLAG_REASONS,
  FLAG_STATUSES,
  flagReasonLabelKey,
  flagRequestSchema,
  flagStatusLabelKey,
  snapshotFlagSchema,
} from "./api";

describe("flagRequestSchema", () => {
  it("accepts each reason with non-empty details", () => {
    for (const reason of FLAG_REASONS) {
      const parsed = flagRequestSchema.parse({
        publicId: "pub_abc",
        reason,
        details: "This copies my song.",
      });
      expect(parsed.reason).toBe(reason);
    }
  });

  it("rejects blank details — they must contain some text", () => {
    expect(
      flagRequestSchema.safeParse({
        publicId: "pub_abc",
        reason: "copyright",
        details: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown reason", () => {
    expect(
      flagRequestSchema.safeParse({
        publicId: "pub_abc",
        reason: "spam",
        details: "x",
      }).success,
    ).toBe(false);
  });
});

describe("flag label keys", () => {
  it("maps each reason and status to a stable i18n key", () => {
    expect(flagReasonLabelKey("copyright")).toBe("flag.reason.copyright");
    expect(flagStatusLabelKey("confirmed")).toBe("flag.status.confirmed");
  });

  it("covers every member", () => {
    for (const r of FLAG_REASONS) expect(flagReasonLabelKey(r)).toContain(r);
    for (const s of FLAG_STATUSES) expect(flagStatusLabelKey(s)).toContain(s);
  });
});

describe("snapshotFlagSchema", () => {
  it("parses an admin-queue row", () => {
    const row = {
      id: "f1",
      publicId: "pub_abc",
      publicName: "My Song",
      publisherName: "Ada",
      reason: "offensive" as const,
      details: "bad words",
      status: "submitted" as const,
      createdAt: "2026-10-19T00:00:00.000Z",
    };
    expect(snapshotFlagSchema.parse(row)).toEqual(row);
  });
});
