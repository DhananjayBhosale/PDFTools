import type {
  DurableDocumentRef,
  MigrationJournalEntry,
  RecentEntry,
  StoredDocument,
  WorkspaceSettings,
  WorkspaceState,
} from './workspaceModels.ts';
import { calculateSpaceSaved, normalizeByteCount, toDurableDocumentRef } from './workspacePolicy.ts';

export const WORKSPACE_SCHEMA_VERSION = 1;

export interface LegacyOutputRecord {
  id: string;
  filename?: unknown;
  mimeType?: unknown;
  size?: unknown;
  inputSize?: unknown;
  toolPath?: unknown;
  createdAt?: unknown;
}

export interface LegacyWorkspaceInput {
  settings?: Readonly<Record<string, unknown>> | null;
  outputs?: readonly LegacyOutputRecord[] | null;
}

export type ResolvedLegacyDocuments = Readonly<Record<string, string | null | undefined>>;

const textOrNull = (value: unknown): string | null => typeof value === 'string' ? value : null;
const timestampOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

export const migrateWorkspace = (
  legacy: LegacyWorkspaceInput,
  current?: WorkspaceState,
  resolvedDocuments: ResolvedLegacyDocuments = {},
): WorkspaceState => {
  const settings: WorkspaceSettings = current?.settings ?? {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    values: { ...(legacy.settings ?? {}) },
  };
  const storedDocuments = [...(current?.storedDocuments ?? [])];
  const recentEntries = [...(current?.recentEntries ?? [])];
  const journal = [...(current?.migrationJournal ?? [])];
  const journalById = new Map(journal.map((entry) => [entry.legacyId, entry]));

  for (const output of legacy.outputs ?? []) {
    const prior = journalById.get(output.id);
    const ref = prior?.documentRef ?? toDurableDocumentRef(resolvedDocuments[output.id] ?? '');
    const nextJournal: MigrationJournalEntry = {
      legacyId: output.id,
      status: ref ? 'complete' : 'pending',
      documentRef: ref,
    };
    const existingJournalIndex = journal.findIndex((entry) => entry.legacyId === output.id);
    if (existingJournalIndex >= 0) journal[existingJournalIndex] = nextJournal;
    else journal.push(nextJournal);
    journalById.set(output.id, nextJournal);

    if (!ref) continue;
    const outputSize = normalizeByteCount(output.size);
    const inputSize = normalizeByteCount(output.inputSize);
    const name = textOrNull(output.filename);
    const mimeType = textOrNull(output.mimeType);
    const createdAt = timestampOrNull(output.createdAt);
    const document: StoredDocument = {
      ref,
      name,
      mimeType,
      sizeBytes: outputSize,
      contentHash: null,
      retainedAt: createdAt,
    };
    const recent: RecentEntry = {
      id: output.id,
      documentRef: ref,
      name,
      mimeType,
      toolId: textOrNull(output.toolPath),
      createdAt,
      inputSizeBytes: inputSize,
      outputSizeBytes: outputSize,
      spaceSavedBytes: calculateSpaceSaved(inputSize, outputSize),
    };
    storedDocuments.push(document);
    recentEntries.push(recent);
  }

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    settings: { ...settings, schemaVersion: WORKSPACE_SCHEMA_VERSION },
    storedDocuments: uniqueBy(storedDocuments, (item) => item.ref),
    recentEntries: uniqueBy(recentEntries, (item) => item.id),
    migrationJournal: uniqueBy(journal, (item) => item.legacyId),
  };
};

export const completedDocumentRef = (
  journal: readonly MigrationJournalEntry[],
  legacyId: string,
): DurableDocumentRef | null => journal.find((entry) => entry.legacyId === legacyId)?.documentRef ?? null;
