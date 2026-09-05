export type DurableDocumentRef = string & { readonly __durableDocumentRef: unique symbol };

export type ByteCount = number | null;

export interface StoredDocument {
  ref: DurableDocumentRef;
  name: string | null;
  mimeType: string | null;
  sizeBytes: ByteCount;
  contentHash: string | null;
  retainedAt: number | null;
}

export type DurableCollectionRef = string & { readonly __durableCollectionRef: unique symbol };

/** A logical group only. Collections deliberately have no MIME type or byte representation. */
export interface StoredCollection {
  ref: DurableCollectionRef;
  name: string | null;
  sizeBytes: ByteCount;
  retainedAt: number | null;
  itemCount: number;
}

/** Closed wrapper that keeps stored files and logical collections distinct. */
export type StoredWorkspaceItem =
  | { readonly kind: 'file'; readonly document: StoredDocument }
  | { readonly kind: 'collection'; readonly collection: StoredCollection };

export interface RecentEntry {
  id: string;
  documentRef: DurableDocumentRef | null;
  name: string | null;
  mimeType: string | null;
  toolId: string | null;
  createdAt: number | null;
  inputSizeBytes: ByteCount;
  outputSizeBytes: ByteCount;
  spaceSavedBytes: ByteCount;
}

/**
 * A recent operation joined to the retained item it references.
 *
 * A collection is deliberately not placed in `document`: it is a logical
 * group with no MIME type or single byte representation. The optional field
 * keeps existing file-only adapters source-compatible while allowing a
 * platform that can enumerate legacy batch outputs to state that distinction.
 */
export interface RecentRecord {
  entry: RecentEntry;
  document: StoredDocument | null;
  collection?: StoredCollection | null;
  available: boolean;
}

export interface WorkspaceSettings {
  schemaVersion: number;
  values: Readonly<Record<string, unknown>>;
}

export interface WorkspaceState {
  schemaVersion: number;
  settings: WorkspaceSettings;
  storedDocuments: readonly StoredDocument[];
  recentEntries: readonly RecentEntry[];
  migrationJournal: readonly MigrationJournalEntry[];
}

export type MigrationStatus = 'pending' | 'complete' | 'failed';

export interface MigrationJournalEntry {
  legacyId: string;
  status: MigrationStatus;
  documentRef: DurableDocumentRef | null;
}

export interface ApplicationMetadata {
  name: string;
  version: string;
  build: string | null;
}
