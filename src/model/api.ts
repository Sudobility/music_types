/**
 * The project API payloads, the response envelope, and the error codes.
 *
 * `music_api` answers in these shapes and `music_client` parses them, so the
 * two cannot drift as long as both import from here.
 */
import { z } from "zod";
import type { GenerationRecord, ProjectStatus } from "./generation";
import type { Score, UUID } from "./score";
import { scoreSchema } from "./schemas";
import {
  IMPORT_FORMAT_IDS,
  type ImportFormatId,
} from "../domain/documents/formats";
// ---------------------------------------------------------------------------
// 7. Project API types (music_api payloads)
// ---------------------------------------------------------------------------

export type ProjectUiPrefs = {
  zoom: number;
  /**
   * Track ids to draw. **Absent means every track is visible** — a project
   * saved before this field existed, or one that never hid anything, needs no
   * migration and no backfill. An empty array is not a valid value: a blank
   * page is never what anyone meant.
   *
   * Ids naming tracks that no longer exist are ignored on load rather than
   * treated as an error, so hiding a track, deleting it, and undoing the
   * deletion all behave.
   */
  visibleTrackIds?: string[];
};

/**
 * Where a project came from — the one fact about a project's history that
 * the row itself cannot be asked for afterwards.
 *
 * A generated project names its job, so the request it was generated from
 * and what that job cost can be read back from the job row rather than
 * copied here. An imported one names the file's format (the importers'
 * own vocabulary, `IMPORT_FORMAT_IDS`) and, when it was known, the file. A
 * duplicate names its source, a transcription its recording, and `blank`
 * is a project that started from nothing — recorded, not inferred from an
 * absent value, because a row written before this existed is also absent
 * and means "unknown".
 *
 * Set once at creation, with one exception: a `blank` project whose first
 * whole-score generation succeeds becomes `generated`, since that is where
 * its music came from. An `imported` project that generates a track stays
 * `imported`; the file is still what the project is.
 */
export type ProjectOrigin =
  | { kind: "generated"; jobId: UUID }
  | { kind: "imported"; format: ImportFormatId; fileName?: string }
  | { kind: "transcribed"; fileName?: string }
  | { kind: "duplicated"; sourceProjectId: UUID }
  | { kind: "blank" };

/** The origins a client may declare on create; see `projectCreateOriginSchema`. */
export type ProjectCreateOrigin = Extract<
  ProjectOrigin,
  { kind: "imported" | "transcribed" | "blank" }
>;

/** Project list item — everything but the (potentially large) score payload. */
export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  /** Required, not optional: a project always has a status, and a missing one would read as editable. */
  status: ProjectStatus;
  /** Why the last generation failed, or null. Survives navigating away, which the job row does not. */
  lastGenerationError: string | null;
  /**
   * The last whole-score generation: its request and the choices it was built
   * from. Absent for a project that was never generated, and on rows written
   * before this existed.
   */
  lastGeneration?: GenerationRecord | null;
  /**
   * Where the project came from. Absent or null on rows written before this
   * existed, which is "unknown" rather than "blank".
   */
  origin?: ProjectOrigin | null;
};

export type ProjectRecord = ProjectSummary & {
  score: Score;
  uiPrefs?: ProjectUiPrefs;
  /** Which snapshot the live work descends from, so a new one attaches there. */
  parentSnapshotId?: UUID | null;
};

/**
 * What a *write* to a project returns: everything but the score.
 *
 * A create or an autosave sends the score and gets the identical bytes back,
 * which no caller has ever read — the writer already holds the score it just
 * sent. On a debounced autosave that echo doubled the cost of every edit, so
 * reads return the score and writes return metadata about it.
 */
export type ProjectSaveResult = Omit<ProjectRecord, "score">;

/**
 * What a status poll returns. Deliberately small: an open editor asks for this
 * every few seconds for the whole session.
 *
 * `parentSnapshotId` rides along because it is the one other field an editor
 * needs while a project is open, and fetching the whole project to read it was
 * the alternative.
 */
/**
 * Who the caller is, from `GET /me`.
 *
 * Exists for `siteAdmin`. The server grants administrators free generation —
 * no quota, no balance check, no charge — and the client has to know, because
 * it does its own courtesy gating on the balance. Without it an administrator
 * is refused by their own UI on a request the server would have accepted.
 */
export type CurrentUser = {
  userId: string;
  email: string | null;
  siteAdmin: boolean;
};

/**
 * What a user has said about themselves: the name they publish under and the
 * picture beside it. From `GET /me/profile`.
 *
 * Apart from `CurrentUser` on purpose. That one answers "who is calling and
 * what may they do", is read on every sign-in and must stay small; this one
 * is what the user *wrote*, and is read where it is shown or edited.
 *
 * **`avatarId` is not the user's id, and says nothing about them.** It is a
 * random name for one uploaded picture, replaced on every upload, and the
 * picture is served publicly by that name — so a page strangers read can
 * show it without the response carrying anything that identifies an account.
 * Replaced rather than reused so that a cached copy of the old picture can
 * never be served for the new one.
 */
export type UserProfile = {
  /** Null until the user chooses one. Never the account email. */
  nickname: string | null;
  /** Null when there is no picture. */
  avatarId: string | null;
};

/** The longest nickname, which is the longest publisher name: it becomes one. */
export const NICKNAME_MAX_LENGTH = 80;

/**
 * The most a profile picture may weigh, in bytes.
 *
 * Small on purpose. It is stored in the database and drawn a few dozen pixels
 * wide; the apps resize before they upload, and this is the server's refusal
 * of anything that was not.
 */
export const AVATAR_MAX_BYTES = 256 * 1024;

/** What a profile picture may be. An array, so a server can check against it. */
export const AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

/**
 * What an image actually is, read off its first bytes.
 *
 * The type a client *says* a file is costs nothing to lie about, and the
 * picture is served to strangers under whatever type was stored with it. Null
 * for anything that is not one of `AVATAR_MIME_TYPES`.
 */
export function avatarMimeTypeOf(bytes: Uint8Array): AvatarMimeType | null {
  const starts = (signature: readonly number[], at = 0): boolean =>
    signature.every((byte, index) => bytes[at + index] === byte);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // "RIFF", four bytes of length, then "WEBP".
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export type ProjectStatusResult = {
  status: ProjectStatus;
  /**
   * A freshness signal, not a timestamp to display. A client compares it with
   * the one its own last write returned; a difference means the server's copy
   * moved under it and must be re-read.
   */
  updatedAt: string;
  lastGenerationError: string | null;
  parentSnapshotId: UUID | null;
  /**
   * The queued or running generation job, when there is one — how an editor
   * opened while a job runs (or on another device) finds its live stream.
   * Optional so a client talking to an older server simply keeps polling.
   */
  jobId?: UUID | null;
};

/**
 * A project pinned at a moment, which never changes again.
 *
 * Holds its **own full copy** of the score rather than a delta: reconstructing
 * a version by replaying diffs is exactly the thing that quietly stops being
 * reproducible, and immutability is the whole point here.
 */
export type Snapshot = {
  id: UUID;
  projectId: UUID;
  /** The snapshot this one grew from. Null for the first in a project. */
  parentId: UUID | null;
  name: string;
  score: Score;
  uiPrefs?: ProjectUiPrefs;
  /**
   * Set when published; the public URL is /p/<publicId>. Absent when not.
   *
   * Publishing is metadata about *sharing*, not part of the music — which is
   * why it may change on a snapshot that otherwise never does.
   */
  publicId?: string;
  /** Shown on the Community list. Never the account email. */
  publisherName?: string;
  /**
   * The title a stranger sees, set when published.
   *
   * Kept apart from `name`, which is the version label this project's own
   * picker draws: "Version 1" is what the tree needs and not what a public
   * page should be called, and renaming for the public must not rewrite the
   * history's labels.
   */
  publicName?: string;
  createdAt: string;
  /**
   * True once a flag against this snapshot has been **confirmed** by a site
   * admin: it is hidden from the Community and the public page, but kept so the
   * owner can see what happened. Absent means visible.
   */
  removedFromCommunity?: boolean;
  /** The reason the admin confirmed, shown to the owner. Present with the above. */
  removalReason?: FlagReason;
};

/** What an anonymous visitor receives. Carries no owner identity, by construction. */
export type PublishedSnapshot = {
  publicId: string;
  name: string;
  /** The public title. Falls back to `name` for anything published before it existed. */
  publicName: string;
  publisherName: string;
  score: Score;
  createdAt: string;
};

/**
 * One row of the Community list. No score — the list would be enormous.
 *
 * `publisherAvatarId` is the picture the publisher has now, or null when they
 * have none; an app turns it into a URL with the client's `avatarUrl`. It is
 * `UserProfile.avatarId`, the random name of one upload, so the row still
 * carries nothing that identifies an account.
 */
export type CommunityItem = Omit<PublishedSnapshot, "score"> & {
  publisherAvatarId: string | null;
};

/** A snapshot without its score — what the picker lists, so it stays cheap. */
export type SnapshotSummary = Omit<Snapshot, "score" | "uiPrefs">;

// ---------------------------------------------------------------------------
// 7a. Flagging a shared snapshot
// ---------------------------------------------------------------------------

/**
 * Why a viewer is reporting a shared snapshot. A closed list so both apps draw
 * the same choices and the server can validate one; the value is a stable key
 * each app turns into words with `flagReasonLabelKey` + `t()`.
 */
export const FLAG_REASONS = ["copyright", "offensive", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

/**
 * A flag's lifecycle. `submitted` when a viewer sends it; a site admin reviewing
 * it either rejects it (`rejected`, leaves the queue) or confirms it
 * (`confirmed`, the snapshot is hidden from the Community).
 */
export const FLAG_STATUSES = ["submitted", "rejected", "confirmed"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

/** The i18n key an app resolves a reason to. The value is the key's stable half. */
export const flagReasonLabelKey = (reason: FlagReason): string =>
  `flag.reason.${reason}`;

/** The i18n key an app resolves a status to. */
export const flagStatusLabelKey = (status: FlagStatus): string =>
  `flag.status.${status}`;

/**
 * One row of the site-admin review queue. Carries no reporter identity — the
 * queue is about the snapshot, not who objected to it.
 */
export type SnapshotFlag = {
  id: UUID;
  /** The shared snapshot being flagged. */
  publicId: string;
  /** The public title and publisher, so the admin knows what they are judging. */
  publicName: string;
  publisherName: string;
  reason: FlagReason;
  details: string;
  status: FlagStatus;
  createdAt: string;
};

export type ProjectCreateRequest = {
  name: string;
  score: Score;
  uiPrefs?: ProjectUiPrefs;
  /**
   * Where this project came from, as only the creator can say. The server
   * records `blank` when nothing is sent. `generated` and `duplicated` are
   * written by the server on its own paths and are refused here — a client
   * cannot claim a job it did not run.
   */
  origin?: ProjectCreateOrigin;
};

export type ProjectUpdateRequest = {
  name?: string;
  score?: Score;
  uiPrefs?: ProjectUiPrefs;
};

/**
 * Duplicating is a server-side copy: the score is read and written inside the
 * database and never crosses the wire in either direction.
 */
export type ProjectDuplicateRequest = {
  /** Defaults to "<original name> (copy)". */
  name?: string;
};

export type ProjectListQuery = {
  search?: string;
  sort?: "updatedAt" | "name";
};

// ---------------------------------------------------------------------------
// 8. Zod schemas for the project API
// ---------------------------------------------------------------------------

export const projectUiPrefsSchema = z.object({
  zoom: z.number().positive(),
  visibleTrackIds: z.array(z.string().min(1)).nonempty().optional(),
});

const importedOriginSchema = z.object({
  kind: z.literal("imported"),
  format: z.enum(IMPORT_FORMAT_IDS),
  fileName: z.string().min(1).optional(),
});

const transcribedOriginSchema = z.object({
  kind: z.literal("transcribed"),
  fileName: z.string().min(1).optional(),
});

const blankOriginSchema = z.object({ kind: z.literal("blank") });

export const projectOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("generated"), jobId: z.string().min(1) }),
  importedOriginSchema,
  transcribedOriginSchema,
  z.object({
    kind: z.literal("duplicated"),
    sourceProjectId: z.string().min(1),
  }),
  blankOriginSchema,
]);

/**
 * The origins a client may declare on create. `generated` names a job and
 * `duplicated` a source row, and both are facts the server establishes on
 * its own paths — accepting them from a request would let a client claim
 * either without having done it.
 */
export const projectCreateOriginSchema = z.discriminatedUnion("kind", [
  importedOriginSchema,
  transcribedOriginSchema,
  blankOriginSchema,
]);

export const projectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().int().nonnegative(),
  origin: projectOriginSchema.nullable().optional(),
});

export const projectSaveResultSchema = projectSummarySchema.extend({
  uiPrefs: projectUiPrefsSchema.optional(),
  /** Which snapshot the live work descends from, so a new one attaches there. */
  parentSnapshotId: z.string().min(1).nullable().optional(),
});

export const projectRecordSchema = projectSaveResultSchema.extend({
  score: scoreSchema,
});

export const flagReasonSchema = z.enum(FLAG_REASONS);
export const flagStatusSchema = z.enum(FLAG_STATUSES);

/** What a viewer sends to flag a shared snapshot. Details must contain text. */
export const flagRequestSchema = z.object({
  publicId: z.string().min(1),
  reason: flagReasonSchema,
  details: z.string().trim().min(1).max(2000),
});
export type FlagRequest = z.infer<typeof flagRequestSchema>;

/** One row of the admin review queue. */
export const snapshotFlagSchema = z.object({
  id: z.string().min(1),
  publicId: z.string().min(1),
  publicName: z.string().min(1),
  publisherName: z.string().min(1),
  reason: flagReasonSchema,
  details: z.string().min(1),
  status: flagStatusSchema,
  createdAt: z.string().min(1),
});

export const snapshotSummarySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  name: z.string().min(1),
  createdAt: z.string().min(1),
  // On the summary, not only the full snapshot: publishing state is what the
  // picker badges from, and it is also all a publish response needs to return.
  publicId: z.string().min(1).optional(),
  publisherName: z.string().min(1).optional(),
  publicName: z.string().min(1).optional(),
  // Set when a flag against this snapshot was confirmed: the owner sees it was
  // removed, and why.
  removedFromCommunity: z.boolean().optional(),
  removalReason: flagReasonSchema.optional(),
});

export const snapshotSchema = snapshotSummarySchema.extend({
  score: scoreSchema,
  uiPrefs: projectUiPrefsSchema.optional(),
});

/** What an anonymous visitor receives. Carries no owner identity, by construction. */
export const publishedSnapshotSchema = z.object({
  publicId: z.string().min(1),
  name: z.string().min(1),
  publicName: z.string().min(1),
  publisherName: z.string().min(1),
  score: scoreSchema,
  createdAt: z.string().min(1),
});

/** One row of the Community list. No score — the list would be enormous. */
export const communityItemSchema = publishedSnapshotSchema.omit({
  score: true,
});

export const publishRequestSchema = z.object({
  publisherName: z.string().min(1).max(80),
  // Required: publishing without a public title would put "Version 1" on a
  // page strangers read. Re-publishing an already-public snapshot is how a
  // title is changed, so this arrives on every publish, not only the first.
  publicName: z.string().min(1).max(200),
});

/**
 * A change to the profile. The nickname is trimmed before it is measured, so
 * a name of spaces is no name; `null` takes the nickname away again.
 */
export const profileUpdateRequestSchema = z.object({
  nickname: z.string().trim().min(1).max(NICKNAME_MAX_LENGTH).nullable(),
});
export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>;

export const userProfileSchema = z.object({
  nickname: z.string().nullable(),
  avatarId: z.string().nullable(),
});

export const snapshotCreateRequestSchema = z.object({
  name: z.string().min(1).max(200),
});

export const projectCreateRequestSchema = z.object({
  name: z.string().min(1),
  score: scoreSchema,
  uiPrefs: projectUiPrefsSchema.optional(),
  origin: projectCreateOriginSchema.optional(),
});

export const projectUpdateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  score: scoreSchema.optional(),
  uiPrefs: projectUiPrefsSchema.optional(),
});

/**
 * Duplicating is a server-side copy. The score never leaves the database, so
 * the request carries only the new name (absent = "<name> (copy)").
 */
export const projectDuplicateRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const projectListQuerySchema = z.object({
  search: z.string().optional(),
  sort: z.enum(["updatedAt", "name"]).optional(),
});

// ---------------------------------------------------------------------------
// 9. Response envelope + error codes
// ---------------------------------------------------------------------------

export const API_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  AI_GENERATION_FAILED: "AI_GENERATION_FAILED",
  AI_OUTPUT_INVALID: "AI_OUTPUT_INVALID",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  /**
   * The project is owned by a running generation job and cannot be written.
   * Distinct from a generic failure so a client can tell "busy, try later"
   * from "something broke" — an autosave should quietly stand down, not
   * surface an error.
   */
  PROJECT_GENERATING: "PROJECT_GENERATING",
  /**
   * No transcription service is configured on this deployment.
   *
   * Distinct from a failure so the client can say "this server cannot
   * transcribe audio" and hide the option, rather than reporting a breakage.
   */
  TRANSCRIPTION_UNAVAILABLE: "TRANSCRIPTION_UNAVAILABLE",
  /**
   * The user has no credits left. Distinct from a quota refusal: a quota is a
   * rate limit that lifts on its own, and this does not — it lifts when the
   * user buys more, which is a different thing to tell them.
   */
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  /** The profile picture is over `AVATAR_MAX_BYTES`. */
  AVATAR_TOO_LARGE: "AVATAR_TOO_LARGE",
  /** The profile picture is not one of `AVATAR_MIME_TYPES`. */
  AVATAR_UNSUPPORTED: "AVATAR_UNSUPPORTED",
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: ApiErrorCode;
};

/** Wraps payload data in the standard success envelope. */
export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

/** Wraps an error message (and optional typed code) in the standard error envelope. */
export function errorResponse(
  message: string,
  code?: ApiErrorCode,
): ApiResponse<never> {
  return code
    ? { success: false, error: message, code }
    : { success: false, error: message };
}
