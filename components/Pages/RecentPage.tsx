import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  Clock,
  Download,
  FileWarning,
  FileX2,
  Folder,
  Pencil,
  Search,
  Share2,
  ExternalLink,
  Trash2,
  Undo2,
} from 'lucide-react';
import { TabHeader } from '../Layout/AppShell';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  Sheet,
  SkeletonRow,
  StatusLine,
  cx,
} from '../UI/Primitives';
import { formatBytes, formatTimestamp, formatTimestampLong, splitFilename } from '../UI/format';
import {
  knownSpaceSaved,
  recordAbilities,
  useHaptics,
  useRecentRecords,
  useWorkspacePlatform,
  type RecentRecord,
  type RecordAbilities,
  type RecordLimitation,
  type UndoReceipt,
} from '../../hooks/useWorkspaceRuntime';
import { tools } from '../Tools/toolCatalog';
import { useOpenedPdf } from '../../hooks/useOpenedPdf';

/** The older Android app's own opaque reference. Never a path, never readable. */
const LEGACY_REF = /^a1_[1-9][0-9]*$/;

/**
 * A row that is one logical group of files from the older Android app.
 *
 * It is not a document: it carries no document ref, no MIME type and no byte
 * size, so it is recognised by its own opaque collection ref and described in
 * items. Every browser record is without one, so nothing here changes for them.
 */
export const isCollectionRecord = (record: RecentRecord): boolean =>
  typeof record.collection?.ref === 'string' && LEGACY_REF.test(record.collection.ref);

/**
 * A row that came from the older Android app's history. It can be read, saved
 * and shared, but this app does not own it, so it cannot be deleted from here.
 * A group is one of these too, even though it has no document ref of its own.
 */
export const isLegacyRecord = (record: RecentRecord): boolean =>
  (typeof record.entry.documentRef === 'string' && LEGACY_REF.test(record.entry.documentRef))
  || isCollectionRecord(record);

/**
 * Only a single PDF can be handed back to the viewer; everything else is save
 * or share. A group of files is never one document, whatever it is named.
 */
export const isReopenable = (record: RecentRecord): boolean =>
  record.available &&
  !isCollectionRecord(record) &&
  (record.entry.mimeType === 'application/pdf' ||
    (typeof record.entry.name === 'string' && record.entry.name.toLowerCase().endsWith('.pdf')));

/** How many files a group holds. Zero means the older app did not record it. */
const itemCountOf = (record: RecentRecord): number => {
  const count = record.collection?.itemCount;
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

/**
 * A group is measured in items, because it has no single byte size to state.
 * Nothing here calls it a PDF, a file, or an archive of one.
 */
export const collectionItemLabel = (count: number): string =>
  count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Item count not recorded';

/**
 * Save and share hand the platform the group itself, so they say how many files
 * they act on. Neither produces a single document, and neither claims to.
 */
export const collectionActionLabel = (verb: 'Save' | 'Share', count: number): string =>
  count > 0 ? `${verb} ${count} ${count === 1 ? 'file' : 'files'}` : `${verb} files`;

/**
 * A record written by an older build may carry no tool path at all. That is a
 * fact about the record, not a reason to crash or to invent a tool name.
 */
const toolNameFor = (toolId: unknown): string => {
  if (typeof toolId !== 'string' || !toolId.trim()) return 'Tool not recorded';
  const tool = tools.find((item) => item.path === toolId);
  if (tool) return tool.name;
  const label = toolId.replace(/^\//, '').replace(/-/g, ' ').trim();
  return label ? label.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Tool not recorded';
};

/** Safe display name. Never blank, never "undefined". */
const displayName = (name: unknown): string =>
  typeof name === 'string' && name.trim() ? name.trim() : 'Untitled document';

/** Zero means the store did not record a time. Do not render the epoch as one. */
const hasTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Renaming should not cost the file its type. If the new name carries no
 * extension, the original one is carried over rather than silently dropped.
 */
const withOriginalExtension = (nextName: string, previousName: unknown): string => {
  const next = nextName.trim();
  if (!next) return displayName(previousName);
  if (splitFilename(next).extension) return next;
  const { extension } = splitFilename(displayName(previousName));
  return extension ? `${next}${extension}` : next;
};

type Feedback = { tone: 'success' | 'danger'; message: string } | null;

/* --------------------------------------------------- Delete and undo --- */

/**
 * The reason a control is unavailable on this row, in the person's language.
 *
 * The platform reports a limitation, never a sentence and never a native
 * detail, so the wording lives here beside the control it explains.
 */
const LIMITATION_REASON: Record<RecordLimitation, string> = {
  'legacy-read-only': 'Files from the older Android app are read-only here. Saving, sharing and opening still work.',
  'session-only': 'This result is kept in this browser, so it cannot be renamed and deleting it is permanent.',
  'file-missing': 'The file is no longer on this device, so there is nothing left to rename or restore.',
};

export const limitationReason = (limitation: RecordLimitation | null): string | null =>
  limitation ? LIMITATION_REASON[limitation] : null;

export const COLLECTION_REOPEN_REASON =
  'This is a group of files, not one PDF, so it cannot be opened here. Saving and sharing still work.';

export const COLLECTION_READ_ONLY_REASON =
  'This group of files came from the older Android app. It is read-only here, and a group cannot be renamed, deleted, or opened as one PDF.';

/**
 * The reason for one specific row.
 *
 * A limitation code alone cannot answer for a group: it is read-only for the
 * same reason as any legacy row, but it also cannot be opened at all, so it
 * says that rather than promising an open that will never come.
 */
export const recordReason = (record: RecentRecord, limitation: RecordLimitation | null): string | null =>
  isCollectionRecord(record) ? COLLECTION_READ_ONLY_REASON : limitationReason(limitation);

/** A deletion that can still be taken back. Receipts stay in memory only. */
export interface PendingUndo {
  receipts: readonly UndoReceipt[];
  /** The one file's name when exactly one can be restored; otherwise null. */
  name: string | null;
  expiresAt: number;
  /** The line held on screen for as long as this offer stands. */
  message: string;
  /** True when a restore already refused these receipts and can be tried again. */
  retry: boolean;
}

/**
 * While an undo stands, the line and its action are one panel wearing the same
 * status tokens the status line wears. It is that line grown to hold the answer
 * to it, not a second surface stacked under it.
 */
const undoPanelTone: Record<'success' | 'danger', string> = {
  success: 'border-[var(--status-success-text)] bg-[var(--status-success-quiet)] text-[var(--status-success-text)]',
  danger: 'border-[var(--status-danger-text)] bg-[var(--status-danger-quiet)] text-[var(--status-danger-text)]',
};

/** Pressing again after a restore that refused is a retry, and says so. */
export const undoActionLabel = (offer: PendingUndo): string =>
  offer.retry ? 'Try undo again' : 'Undo delete';

export const UNDO_EXPIRED = 'The time to undo has passed, so that deletion is now permanent.';
export const UNDO_UNAVAILABLE = 'Undo is not available on this device.';
export const UNDO_FAILED = 'That could not be restored. It is no longer on this device.';

/** The offer stands until the window closes, and not one moment after it. */
export const undoIsOffered = (
  offer: { receipts: readonly UndoReceipt[]; expiresAt: number } | null,
  now: number,
): boolean => Boolean(offer && offer.receipts.length > 0 && now < offer.expiresAt);

/** A receipt and the name it was taken for, so a lone offer can still be named. */
export interface TrashedRecord {
  receipt: UndoReceipt;
  name: string;
}

/**
 * Fold what a deletion actually reversed into whatever is still offered.
 *
 * A later deletion — permanent, failed, or partly successful — must not take
 * away an offer the person can still use, so the standing receipts are carried
 * forward and only exact successful trash calls join them. The window is the
 * earliest of the ones combined, because that is the first moment part of the
 * offer stops being true.
 */
export const mergeUndo = (
  current: PendingUndo | null,
  added: readonly TrashedRecord[],
  message: string,
  now: number,
): PendingUndo | null => {
  const live = undoIsOffered(current, now) ? current : null;
  if (added.length === 0) return live;
  const receipts = [...(live?.receipts ?? []), ...added.map((item) => item.receipt)];
  return {
    receipts,
    // One receipt can be named; a mixed offer is counted instead of guessing
    // which of its files to speak for.
    name: receipts.length === 1 ? (live ? live.name : added[0].name) : null,
    expiresAt: Math.min(live?.expiresAt ?? Number.POSITIVE_INFINITY, ...added.map((item) => item.receipt.expiresAt)),
    message,
    // A fresh deletion joined it, so this is an offer again rather than a retry.
    retry: false,
  };
};

/**
 * What is left to offer after a restore.
 *
 * A receipt that refused is not spent, so it stays on its original window and
 * the action stays on screen to be tried again. Nothing is extended: the window
 * is the one the deletion opened.
 */
export const remainingUndo = (
  offer: PendingUndo,
  unrestored: readonly UndoReceipt[],
  message: string,
  now: number,
): PendingUndo | null => {
  if (unrestored.length === 0 || now >= offer.expiresAt) return null;
  return {
    receipts: unrestored,
    name: unrestored.length === 1 && offer.receipts.length === 1 ? offer.name : null,
    expiresAt: offer.expiresAt,
    message,
    retry: true,
  };
};

/** Which rows can be taken back and which are gone for good, in one pass. */
export const partitionDeletion = (
  targets: readonly RecentRecord[],
  abilitiesOf: (record: RecentRecord) => RecordAbilities,
): { reversible: RecentRecord[]; permanent: RecentRecord[] } => {
  const reversible: RecentRecord[] = [];
  const permanent: RecentRecord[] = [];
  for (const target of targets) {
    (abilitiesOf(target).reversibleDelete ? reversible : permanent).push(target);
  }
  return { reversible, permanent };
};

export interface DeletionOutcome {
  deleted: number;
  failed: number;
  total: number;
  /** The name of the only record attempted, when there was only one. */
  name: string | null;
}

/**
 * What to say about a deletion.
 *
 * A count that came back short is never rounded up into "Deleted". The exact
 * numbers are stated so a partial result is never read as a complete one.
 */
export const deletionFeedback = ({ deleted, failed, total, name }: DeletionOutcome): Feedback => {
  if (total === 0) return null;
  if (failed === 0) {
    return {
      tone: 'success',
      message: total === 1 && name ? `Deleted ${name}.` : `Deleted ${total} results.`,
    };
  }
  if (deleted === 0) {
    return {
      tone: 'danger',
      message: total === 1 ? 'That result could not be deleted.' : 'None of the selected results could be deleted.',
    };
  }
  return { tone: 'danger', message: `Deleted ${deleted} of ${total}. ${failed} could not be deleted.` };
};

/** The same honesty in the other direction: a partial restore says so. */
export const undoFeedback = (restored: number, total: number, name: string | null): Feedback => {
  if (total === 0) return null;
  if (restored === total) {
    return {
      tone: 'success',
      message: total === 1 ? (name ? `Restored ${name}.` : 'Restored.') : `Restored ${total} results.`,
    };
  }
  if (restored === 0) return { tone: 'danger', message: UNDO_FAILED };
  return { tone: 'danger', message: `Restored ${restored} of ${total}. The rest could not be brought back.` };
};

type RecentSortOrder =
  | 'date-newest'
  | 'date-oldest'
  | 'size-largest'
  | 'size-smallest'
  | 'name-ascending'
  | 'name-descending';

const RECENT_SORT_OPTIONS: ReadonlyArray<{ value: RecentSortOrder; label: string }> = [
  { value: 'date-newest', label: 'Date: newest first' },
  { value: 'date-oldest', label: 'Date: oldest first' },
  { value: 'size-largest', label: 'Size: largest first' },
  { value: 'size-smallest', label: 'Size: smallest first' },
  { value: 'name-ascending', label: 'Name: A to Z' },
  { value: 'name-descending', label: 'Name: Z to A' },
];

const sortRecentRecords = (records: readonly RecentRecord[], order: RecentSortOrder): RecentRecord[] => {
  const sorted = [...records];
  const name = (record: RecentRecord) => displayName(record.entry.name);
  const compareName = (first: RecentRecord, second: RecentRecord) =>
    name(first).localeCompare(name(second), undefined, { sensitivity: 'base', numeric: true });
  const stable = (first: RecentRecord, second: RecentRecord) =>
    compareName(first, second) || String(first.entry.id).localeCompare(String(second.entry.id));

  return sorted.sort((first, second) => {
    switch (order) {
      case 'date-newest':
        return (Number(second.entry.createdAt) || 0) - (Number(first.entry.createdAt) || 0) || stable(first, second);
      case 'date-oldest':
        return (Number(first.entry.createdAt) || 0) - (Number(second.entry.createdAt) || 0) || stable(first, second);
      case 'size-largest':
        return (Number(second.entry.outputSizeBytes) || 0) - (Number(first.entry.outputSizeBytes) || 0) || stable(first, second);
      case 'size-smallest':
        return (Number(first.entry.outputSizeBytes) || 0) - (Number(second.entry.outputSizeBytes) || 0) || stable(first, second);
      case 'name-descending':
        return compareName(second, first) || (Number(second.entry.createdAt) || 0) - (Number(first.entry.createdAt) || 0);
      case 'name-ascending':
      default:
        return compareName(first, second) || (Number(second.entry.createdAt) || 0) - (Number(first.entry.createdAt) || 0);
    }
  });
};

/* ----------------------------------------------------------------- Row --- */

const RecentRow: React.FC<{
  record: RecentRecord;
  onOpenActions: (record: RecentRecord) => void;
  onReopen: (record: RecentRecord) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelected: (record: RecentRecord) => void;
}> = ({ record, onOpenActions, onReopen, selectionMode, selected, onToggleSelected }) => {
  const { entry, available } = record;
  const saved = entry.spaceSavedBytes;
  const collection = isCollectionRecord(record);
  const items = itemCountOf(record);
  const legacy = isLegacyRecord(record);
  // Nothing here can delete a legacy row, so it never joins a bulk selection.
  const selectable = selectionMode && !legacy;
  const toggleSelection = () => onToggleSelected(record);

  return (
    <div
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      aria-label={selectable ? `${selected ? 'Deselect' : 'Select'} ${displayName(entry.name)}` : undefined}
      onClick={selectable ? toggleSelection : undefined}
      onKeyDown={
        selectable
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              toggleSelection();
            }
          : undefined
      }
      className={cx(
        'flex items-start gap-3 px-3 py-2.5',
        selectable && 'chef-pressable chef-pressable-row cursor-pointer',
        selected && 'bg-[var(--accent-quiet)]',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-control)]',
          selected
            ? 'bg-[var(--accent-rest)] text-[var(--text-on-accent)]'
            : available
            ? 'bg-[var(--accent-quiet)] text-[var(--accent-on-quiet)]'
            : 'bg-[var(--surface-sunken)] text-[var(--text-tertiary)]',
        )}
      >
        {selected ? (
          <Check size={19} strokeWidth={2.3} />
        ) : collection ? (
          <Folder size={19} strokeWidth={1.9} />
        ) : available ? (
          <Clock size={19} strokeWidth={1.9} />
        ) : (
          <FileX2 size={19} strokeWidth={1.9} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="chef-filename font-semibold text-[var(--text-primary)]">{displayName(entry.name)}</p>

        <p className="type-footnote tabular mt-0.5 text-[var(--text-secondary)]">
          <span>{toolNameFor(entry.toolId)}</span>
          <span aria-hidden> · </span>
          {hasTime(entry.createdAt) ? (
            <time dateTime={new Date(entry.createdAt).toISOString()} title={formatTimestampLong(entry.createdAt)}>
              {formatTimestamp(entry.createdAt)}
            </time>
          ) : (
            <span>Time not recorded</span>
          )}
          {!collection && (
            <>
              <span aria-hidden> · </span>
              {entry.inputSizeBytes === null
                ? formatBytes(entry.outputSizeBytes)
                : `${formatBytes(entry.inputSizeBytes)} in, ${formatBytes(entry.outputSizeBytes)} out`}
              {saved !== null && (
                <>
                  <span aria-hidden> · </span>
                  {saved > 0 ? (
                    <span className="font-semibold text-[var(--status-success-text)]">{formatBytes(saved)} saved</span>
                  ) : (
                    <span>No size reduction</span>
                  )}
                </>
              )}
            </>
          )}
        </p>

        {/* A group has no byte size to report, so it states what it is and how
            many files it holds instead of borrowing a file's line. */}
        {collection ? (
          <p className="type-footnote tabular mt-0.5 text-[var(--text-tertiary)]">
            Group of files
            <span aria-hidden> · </span>
            <span>{collectionItemLabel(items)}</span>
          </p>
        ) : null}

        {legacy && (
          <p className="type-footnote mt-1.5 font-semibold text-[var(--text-tertiary)]">
            {collection ? 'Older Android files · read-only here' : 'Older Android file · read-only here'}
          </p>
        )}

        {!available && (
          <p className="type-footnote mt-1.5 inline-flex items-center gap-1.5 font-semibold text-[var(--status-caution-text)]">
            <FileWarning aria-hidden size={14} />
            {collection ? 'These files are no longer on this device' : 'File no longer on this device'}
          </p>
        )}

        {selectionMode ? (
          <p className="type-footnote mt-2 font-semibold text-[var(--accent-on-quiet)]">
            {legacy ? 'Cannot be deleted from here' : selected ? 'Selected' : 'Tap to select'}
          </p>
        ) : (
          <>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Button
                tone="quiet"
                icon={<ExternalLink aria-hidden size={16} />}
                disabled={!isReopenable(record)}
                onClick={() => onReopen(record)}
                className="px-2.5"
              >
                Reopen
              </Button>
              <Button
                tone="quiet"
                onClick={() => onOpenActions(record)}
                className="px-2.5"
                aria-label={`More actions for ${displayName(entry.name)}`}
              >
                More
              </Button>
            </div>
            {!isReopenable(record) && (collection || available) && (
              <p className="type-footnote mt-1.5 text-[var(--text-tertiary)]">
                {collection ? COLLECTION_REOPEN_REASON : 'Only PDF results can be reopened here. Save or share this result instead.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- Page --- */

export const RecentPage: React.FC = () => {
  const platform = useWorkspacePlatform();
  const { state, refresh } = useRecentRecords();
  const navigate = useNavigate();
  const haptic = useHaptics();
  const { setOpenedPdfFile } = useOpenedPdf();

  const [active, setActive] = useState<RecentRecord | null>(null);
  const [renaming, setRenaming] = useState<RecentRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<RecentRecord | null>(null);
  const [confirmClear, setConfirmClear] = useState<'records' | 'documents' | null>(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<RecentSortOrder>('date-newest');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const records = state.status === 'ready' ? state.value : [];
  const savings = useMemo(() => knownSpaceSaved(records), [records]);
  const hasLegacy = useMemo(() => records.some(isLegacyRecord), [records]);
  const visibleRecords = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const matching = query
      ? records.filter((record) => {
          const searchable = `${displayName(record.entry.name)} ${toolNameFor(record.entry.toolId)}`.toLocaleLowerCase();
          return searchable.includes(query);
        })
      : records;
    return sortRecentRecords(matching, sortOrder);
  }, [records, searchQuery, sortOrder]);
  const visibleIdKey = visibleRecords.map((record) => String(record.entry.id)).join('\u0000');
  /** Legacy rows cannot be deleted, so they are never part of a selection. */
  const selectableRecords = useMemo(
    () => visibleRecords.filter((record) => !isLegacyRecord(record)),
    [visibleRecords],
  );
  const allVisibleSelected =
    selectableRecords.length > 0
    && selectableRecords.every((record) => selectedIds.has(String(record.entry.id)));
  const selectedBytes = useMemo(
    () =>
      records.reduce(
        (total, record) =>
          selectedIds.has(String(record.entry.id)) ? total + (Number(record.entry.outputSizeBytes) || 0) : total,
        0,
      ),
    [records, selectedIds],
  );

  useEffect(() => {
    const visible = new Set(visibleRecords.map((record) => String(record.entry.id)));
    setSelectedIds((current) => {
      const retained = new Set([...current].filter((id) => visible.has(id)));
      return retained.size === current.size ? current : retained;
    });
  }, [visibleIdKey]);

  /**
   * `hold` keeps a message up for as long as its action can still be taken
   * back. A line that says what was deleted must not disappear while the Undo
   * beside it is still live.
   */
  const report = useCallback((tone: 'success' | 'danger', message: string, hold = false) => {
    setFeedback({ tone, message });
    if (hold) return;
    window.setTimeout(() => setFeedback((current) => (current?.message === message ? null : current)), 6000);
  }, []);

  const run = useCallback(
    async (action: () => Promise<void>, successMessage: string, failureMessage: string) => {
      setBusy(true);
      try {
        await action();
        haptic('commit');
        report('success', successMessage);
        return true;
      } catch (caught) {
        haptic('error');
        report('danger', caught instanceof Error && caught.message ? caught.message : failureMessage);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [haptic, report],
  );

  /**
   * One latch over every way of opening a row.
   *
   * The native reader keeps its promise pending for as long as its screen is up,
   * so it must not run inside `run`: that would hold Recent busy behind a screen
   * the person is no longer even looking at. The web path is short but still
   * reads the whole file, so both share this latch — two quick taps must not
   * start two full reads or two navigations. It is synchronous, because state
   * has not re-rendered by the time the second tap arrives.
   */
  const openRef = useRef(false);

  const handOff = useCallback(
    (record: RecentRecord, toolPath: string | null) =>
      run(
        async () => {
          const file = await platform.reopen(record);
          const opened = setOpenedPdfFile(file);
          if (toolPath === null) navigate('/view');
          else navigate(toolPath, { state: { useOpenedPdf: true, openedPdfId: opened.id } });
        },
        `Opened ${displayName(record.entry.name)}.`,
        'That file could not be reopened.',
      ),
    [navigate, platform, run, setOpenedPdfFile],
  );

  const reopen = useCallback(
    (record: RecentRecord) => {
      // A group of files is not a document. Its control is disabled and states
      // the reason, and the platform is never asked to open one as a file.
      if (isCollectionRecord(record)) return;
      if (openRef.current) return;
      openRef.current = true;

      const reader = platform.pdfReader;
      const document = record.document;
      // Only a durable file the native reader accepts. A result that exists
      // only as bytes in this session stays on the web reader.
      if (reader && document && record.available && reader.isEligible(document)) {
        haptic('selection');
        void (async () => {
          try {
            const result = await reader.open(document);
            // Closing the reader is the ordinary end of reading, so it is
            // silent: no toast, no error, nothing moved.
            if (result.action !== 'closed') await handOff(record, result.toolPath);
          } catch {
            // A refused launch falls back to the web reader exactly once.
            await handOff(record, null);
          } finally {
            openRef.current = false;
          }
        })();
        return;
      }

      void handOff(record, null).finally(() => {
        openRef.current = false;
      });
    },
    [handOff, haptic, platform],
  );

  const closeActions = useCallback(() => setActive(null), []);
  const toggleSelectionMode = useCallback(() => {
    if (selectionMode) setSelectedIds(new Set());
    setSelectionMode(!selectionMode);
  }, [selectionMode]);
  const toggleSelected = useCallback((record: RecentRecord) => {
    if (isLegacyRecord(record)) return;
    const id = String(record.entry.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(current);
      selectableRecords.forEach((record) => next.add(String(record.entry.id)));
      return next;
    });
  }, [allVisibleSelected, selectableRecords]);

  /* ------------------------------------------------- delete and undo --- */

  const abilitiesOf = useCallback(
    (record: RecentRecord) => recordAbilities(platform, record),
    [platform],
  );
  const activeAbilities = active ? abilitiesOf(active) : null;
  const activeReason = active ? recordReason(active, activeAbilities?.limitation ?? null) : null;
  const activeIsCollection = active ? isCollectionRecord(active) : false;
  const activeItems = active ? itemCountOf(active) : 0;
  const undoOffered = undoIsOffered(pendingUndo, Date.now());

  const selectedTargets = useMemo(
    () => records.filter((record) => selectedIds.has(String(record.entry.id))),
    [records, selectedIds],
  );
  const selectedSplit = useMemo(
    () => partitionDeletion(selectedTargets, abilitiesOf),
    [abilitiesOf, selectedTargets],
  );

  // The offer withdraws itself the moment the window closes, so nothing on
  // screen promises a restore the store will no longer perform. The line it was
  // holding goes with it, and only if nothing newer has replaced it.
  useEffect(() => {
    if (!pendingUndo) return undefined;
    const { expiresAt, message } = pendingUndo;
    const close = () => {
      setPendingUndo(null);
      setFeedback((current) => (current?.message === message ? null : current));
    };
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      close();
      return undefined;
    }
    const timer = window.setTimeout(close, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [pendingUndo]);

  /**
   * One deletion path for a row and for a selection.
   *
   * Each record is attempted on its own, so one refusal cannot cancel the rest
   * or turn the others into a failure they did not have. Only the rows that
   * actually came back with a receipt can be undone, and the report counts what
   * happened rather than what was asked for.
   */
  const deleteRecords = useCallback(
    async (reversible: readonly RecentRecord[], permanent: readonly RecentRecord[]) => {
      const total = reversible.length + permanent.length;
      if (total === 0) return { deleted: 0, failed: 0, total: 0 };
      const service = platform.recordRecovery;
      setBusy(true);
      // An offer already on screen is not this deletion's to withdraw. It is
      // folded in below, so a permanent or failed deletion leaves it standing.

      const trashed: TrashedRecord[] = [];
      let failed = 0;
      for (const target of reversible) {
        try {
          if (!service) throw new Error('This platform has no reversible deletion.');
          trashed.push({ receipt: await service.deleteReversibly(target), name: displayName(target.entry.name) });
        } catch {
          // The native reason is not this person's business and could name a
          // location. It is counted, never quoted, and never swallowed.
          failed += 1;
        }
      }
      let removed = 0;
      for (const target of permanent) {
        try {
          await platform.records.delete(target.entry.id);
          removed += 1;
        } catch {
          failed += 1;
        }
      }
      setBusy(false);

      const deleted = trashed.length + removed;
      const outcome = deletionFeedback({
        deleted,
        failed,
        total,
        name: total === 1 ? displayName((reversible[0] ?? permanent[0]).entry.name) : null,
      });
      if (outcome) {
        setPendingUndo((current) => mergeUndo(current, trashed, outcome.message, Date.now()));
      }
      haptic(failed === 0 ? 'commit' : 'error');
      if (outcome) report(outcome.tone, outcome.message, trashed.length > 0);
      await refresh();
      return { deleted, failed, total };
    },
    [haptic, platform, refresh, report],
  );

  const undoDelete = useCallback(async () => {
    const offer = pendingUndo;
    if (!offer) return;
    setPendingUndo(null);
    if (Date.now() >= offer.expiresAt) {
      haptic('warning');
      report('danger', UNDO_EXPIRED);
      return;
    }
    const service = platform.recordRecovery;
    if (!service) {
      haptic('error');
      report('danger', UNDO_UNAVAILABLE);
      return;
    }
    setBusy(true);
    const unrestored: UndoReceipt[] = [];
    for (const receipt of offer.receipts) {
      try {
        await service.restore(receipt);
      } catch {
        // Same rule as the deletion: counted exactly, described plainly. A
        // receipt that refused is not spent, so it goes back on the offer.
        unrestored.push(receipt);
      }
    }
    setBusy(false);
    const restored = offer.receipts.length - unrestored.length;
    const outcome = undoFeedback(restored, offer.receipts.length, offer.name);
    const retry = outcome ? remainingUndo(offer, unrestored, outcome.message, Date.now()) : null;
    setPendingUndo(retry);
    haptic(unrestored.length === 0 ? 'commit' : 'error');
    if (outcome) report(outcome.tone, outcome.message, retry !== null);
    // Recent is the record, so it is brought back into step here rather than
    // sending the person somewhere else to see what happened.
    await refresh();
  }, [haptic, pendingUndo, platform, refresh, report]);

  const deleteSelected = useCallback(async () => {
    const { deleted, failed } = await deleteRecords(selectedSplit.reversible, selectedSplit.permanent);
    if (deleted > 0 && failed === 0) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
  }, [deleteRecords, selectedSplit]);

  return (
    <>
      <TabHeader
        title="Recent"
        subtitle="Results PDF Chef made on this device."
        trailing={
          state.status === 'ready' && records.some((record) => !isLegacyRecord(record)) ? (
            <Button tone="quiet" onClick={toggleSelectionMode} disabled={busy} className="shrink-0 px-2.5">
              {selectionMode ? 'Done' : 'Select'}
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-4xl px-4 md:px-8">
        {/* One anchored place for what just happened and for the single action
            that takes it back. It does not move, follow the finger, or time
            itself out from under a reversible deletion.

            While the deletion can still be taken back the line and its action
            are one panel, not a strip with a small control loose beneath it:
            the sentence and the way to reverse it are one event, and on a phone
            a lone control floating in the page reads as debris. The panel takes
            the same radius, sides and rhythm as the result summary below it, so
            it lands as part of the page rather than on top of it. Once there is
            nothing to reverse the ordinary status line returns. */}
        <div role="status" aria-live="polite">
          {undoOffered && pendingUndo ? (
            <div
              key={pendingUndo.message}
              className={cx(
                'chef-enter mb-3 rounded-[var(--radius-panel)] border px-4 py-3.5',
                undoPanelTone[feedback?.tone ?? 'success'],
              )}
            >
              <p className="flex items-start gap-2 font-semibold">
                <span aria-hidden className="mt-0.5 shrink-0">
                  {feedback?.tone === 'danger' ? <AlertTriangle size={17} /> : <Check size={17} />}
                </span>
                <span className="chef-filename">{feedback?.message ?? pendingUndo.message}</span>
              </p>
              <Button
                block
                tone="secondary"
                className="mt-3"
                icon={<Undo2 aria-hidden size={17} />}
                disabled={busy}
                aria-label={`${undoActionLabel(pendingUndo)} for ${
                  pendingUndo.name ?? `${pendingUndo.receipts.length} results`
                }`}
                onClick={() => void undoDelete()}
              >
                {undoActionLabel(pendingUndo)}
              </Button>
            </div>
          ) : (
            feedback && (
              <div key={feedback.message} className="chef-enter mb-3">
                <StatusLine tone={feedback.tone}>{feedback.message}</StatusLine>
              </div>
            )
          )}
        </div>

        {state.status === 'ready' && records.length > 0 && (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search recent results</span>
              <Search
                aria-hidden
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search files or tools"
                className="chef-field pl-10"
                style={{ paddingLeft: '2.5rem' }}
              />
            </label>
            <label className="relative shrink-0 sm:w-56">
              <span className="sr-only">Sort recent results</span>
              <ArrowUpDown
                aria-hidden
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as RecentSortOrder)}
                className="chef-field pl-10"
                style={{ paddingLeft: '2.5rem' }}
              >
                {RECENT_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {selectionMode && state.status === 'ready' && records.length > 0 && (
          <div className="mb-3 rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-3">
            <p className="font-semibold text-[var(--text-primary)]">
              {selectedIds.size === 0
                ? 'Select results'
                : `${selectedIds.size} selected · about ${formatBytes(selectedBytes)}`}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button tone="secondary" onClick={toggleAllVisible} disabled={selectableRecords.length === 0 || busy}>
                {allVisibleSelected
                  ? 'Clear selection'
                  : searchQuery.trim()
                    ? `Select all ${selectableRecords.length} results`
                    : 'Select all'}
              </Button>
              <Button
                tone="destructive"
                icon={<Trash2 aria-hidden size={16} />}
                disabled={selectedIds.size === 0 || busy}
                onClick={() => {
                  if (selectedSplit.permanent.length === 0 && selectedSplit.reversible.length > 0) {
                    void deleteSelected();
                    return;
                  }
                  setConfirmDeleteSelected(true);
                }}
              >
                Delete selected
              </Button>
            </div>
          </div>
        )}

        {state.status === 'ready' && records.length > 0 && !selectionMode && (
          <div className="mb-3 rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] px-4 py-3">
            <p className="tabular font-semibold text-[var(--text-primary)]">
              {records.length} {records.length === 1 ? 'result' : 'results'}
              {savings.known > 0 && (
                <>
                  <span aria-hidden> · </span>
                  <span className="text-[var(--status-success-text)]">{formatBytes(savings.bytes)} saved</span>
                </>
              )}
            </p>
            <p className="type-footnote mt-0.5 text-[var(--text-secondary)]">
              {savings.unknown > 0
                ? `${savings.unknown} of these did not record an original size, so their saving is unknown.`
                : 'Savings count only files that actually became smaller.'}
            </p>
          </div>
        )}

        {!platform.capabilities.durableDocuments && state.status === 'ready' && records.length > 0 && (
          <div className="mb-3">
            <StatusLine tone="caution" icon={<AlertTriangle size={15} />}>
              This build keeps results in browser storage rather than as durable files. Save anything you need to keep.
            </StatusLine>
          </div>
        )}

        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-raised)]">
          {state.status === 'loading' ? (
            <div aria-busy="true" aria-label="Loading recent results">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : state.status === 'error' ? (
            <div className="p-5">
              <StatusLine tone="danger" icon={<AlertTriangle size={15} />}>
                {state.message}
              </StatusLine>
              <Button tone="secondary" className="mt-4" onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Clock size={30} />}
              title="Nothing here yet"
              body="Finish any tool and the result lands here."
              action={
                <Button tone="primary" onClick={() => navigate('/')}>
                  Browse tools
                </Button>
              }
            />
          ) : visibleRecords.length === 0 ? (
            <EmptyState
              icon={<Search size={30} />}
              title="No matching results"
              body="Try another file name or tool, or clear the search to see everything in Recent."
              action={
                <Button tone="secondary" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border-hairline)]">
              {visibleRecords.map((record) => (
                <li key={record.entry.id}>
                  <RecentRow
                    record={record}
                    onOpenActions={setActive}
                    onReopen={reopen}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(String(record.entry.id))}
                    onToggleSelected={toggleSelected}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {state.status === 'ready' && records.length > 0 && !selectionMode && (
          <div className="mt-4 flex flex-col gap-2 pb-4 sm:flex-row">
            <Button tone="destructive" icon={<Trash2 aria-hidden size={16} />} onClick={() => setConfirmClear('records')}>
              {hasLegacy ? 'Clear this app’s results' : 'Clear the list'}
            </Button>
            <Button
              tone="destructive"
              icon={<Trash2 aria-hidden size={16} />}
              disabled={!platform.capabilities.separateClearActions}
              title={
                platform.capabilities.separateClearActions
                  ? undefined
                  : 'This build stores the record and the file together, so clearing one clears both.'
              }
              onClick={() => setConfirmClear('documents')}
            >
              Delete kept files only
            </Button>
          </div>
        )}

        {state.status === 'ready' && records.length > 0 && !selectionMode && !platform.capabilities.separateClearActions && (
          <p className="type-footnote pb-6 text-[var(--text-tertiary)]">
            Clearing the list also removes the kept files, because this build stores them together. Files you already
            saved to your device are not affected.
          </p>
        )}
      </div>

      {/* Row actions. A sheet rather than a hidden swipe, so every action is
          reachable by touch, keyboard and VoiceOver in the same place. */}
      <Sheet
        open={Boolean(active)}
        onClose={closeActions}
        title={active ? displayName(active.entry.name) : ''}
        description={
          active
            ? `${toolNameFor(active.entry.toolId)} · ${
                hasTime(active.entry.createdAt) ? formatTimestampLong(active.entry.createdAt) : 'Time not recorded'
              } · ${
                // A group is described by how much it holds, never by a byte
                // size it does not have.
                activeIsCollection ? collectionItemLabel(activeItems) : formatBytes(active.entry.outputSizeBytes)
              }`
            : undefined
        }
      >
        {active && (
          <div className="space-y-2">
            {!active.available && (
              <StatusLine tone="caution" icon={<FileWarning size={15} />}>
                {activeIsCollection
                  ? 'The record is still here but these files are gone. Saving and sharing need them.'
                  : 'The record is still here but the file is gone. Saving, sharing and reopening need the file.'}
              </StatusLine>
            )}

            <Button
              block
              tone="primary"
              icon={<Download aria-hidden size={16} />}
              busy={busy}
              disabled={!active.available}
              onClick={() =>
                void run(
                  () => platform.save(active, displayName(active.entry.name)),
                  `Saved ${displayName(active.entry.name)}.`,
                  'That file could not be saved.',
                ).then(closeActions)
              }
            >
              {activeIsCollection ? collectionActionLabel('Save', activeItems) : 'Save a copy'}
            </Button>

            <Button
              block
              icon={<Share2 aria-hidden size={16} />}
              disabled={!platform.share || !active.available}
              onClick={() =>
                void run(
                  () => platform.share!(active, displayName(active.entry.name)),
                  'Handed to the share sheet.',
                  'Sharing did not complete.',
                ).then(closeActions)
              }
            >
              {activeIsCollection ? collectionActionLabel('Share', activeItems) : 'Share'}
            </Button>

            {!platform.share && (
              <p className="type-footnote text-[var(--text-tertiary)]">
                This device has no share sheet available to PDF Chef. Save a copy instead.
              </p>
            )}

            <Button
              block
              icon={<Pencil aria-hidden size={16} />}
              disabled={!activeAbilities?.rename}
              onClick={() => {
                setRenameValue(displayName(active.entry.name));
                setRenaming(active);
                closeActions();
              }}
            >
              Rename
            </Button>

            {/* A deletion this app can genuinely take back does not earn a
                second interruption: it happens, and the Undo waits in Recent.
                A permanent one keeps its confirmation, because that is the
                only chance to reconsider it. */}
            <Button
              block
              tone="destructive"
              icon={<Trash2 aria-hidden size={16} />}
              disabled={activeAbilities?.limitation === 'legacy-read-only'}
              onClick={() => {
                const target = active;
                closeActions();
                if (activeAbilities?.reversibleDelete) void deleteRecords([target], []);
                else setConfirmDelete(target);
              }}
            >
              Delete
            </Button>

            {/* The reason a control above is unavailable, in text, where a
                finger and a screen reader both reach it. */}
            {activeReason && <p className="type-footnote pt-1 text-[var(--text-tertiary)]">{activeReason}</p>}
          </div>
        )}
      </Sheet>

      {/* Rename */}
      <Sheet
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename result"
        description="This changes the name stored with the result. Copies you already saved keep their own name."
        footer={
          <>
            <Button tone="secondary" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              busy={busy}
              disabled={!renameValue.trim()}
              onClick={() => {
                const target = renaming;
                if (!target || !platform.rename) return;
                void run(
                  () => platform.rename!(target, withOriginalExtension(renameValue, target.entry.name)),
                  'Renamed.',
                  'That result could not be renamed.',
                )
                  .then(refresh)
                  .then(() => setRenaming(null));
              }}
            >
              Save name
            </Button>
          </>
        }
      >
        <label htmlFor="recent-rename" className="type-footnote block font-semibold text-[var(--text-secondary)]">
          File name
        </label>
        <input
          id="recent-rename"
          className="chef-field mt-1"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Sheet>

      <ConfirmSheet
        open={Boolean(confirmDelete)}
        title="Delete this result?"
        description={
          confirmDelete
            ? `"${displayName(confirmDelete.entry.name)}" is removed from this device. Copies you already saved elsewhere are not affected. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const target = confirmDelete;
          if (!target) return;
          await deleteRecords([], [target]);
          setConfirmDelete(null);
        }}
      />

      {/* Only the part of a selection that cannot be taken back is confirmed,
          and the description says exactly how much of it that is. */}
      <ConfirmSheet
        open={confirmDeleteSelected}
        title={`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'result' : 'results'}?`}
        description={
          selectedSplit.reversible.length === 0
            ? `This removes about ${formatBytes(selectedBytes)} from PDF Chef on this device. Copies you already saved elsewhere are not affected. This cannot be undone.`
            : `This removes about ${formatBytes(selectedBytes)} from PDF Chef on this device. ${
                selectedSplit.permanent.length === 1
                  ? 'One of them cannot be undone.'
                  : `${selectedSplit.permanent.length} of them cannot be undone.`
              } Copies you already saved elsewhere are not affected.`
        }
        confirmLabel="Delete selected"
        onCancel={() => setConfirmDeleteSelected(false)}
        onConfirm={async () => {
          await deleteSelected();
          setConfirmDeleteSelected(false);
        }}
      />

      <ConfirmSheet
        open={Boolean(confirmClear)}
        title={
          confirmClear === 'documents'
            ? 'Delete every kept file?'
            : hasLegacy
              ? 'Clear this app’s results?'
              : 'Clear every result?'
        }
        description={
          confirmClear === 'documents'
            ? `Every file this app keeps on this device is deleted. The list of what you made stays. Copies you already saved elsewhere are not affected.${
                hasLegacy ? ' Files from the older Android app are read-only here and stay where they are.' : ''
              } This cannot be undone.`
            : `Every result this app made on this device is removed. Copies you already saved elsewhere are not affected.${
                hasLegacy ? ' Files from the older Android app are read-only here and stay where they are.' : ''
              } This cannot be undone.`
        }
        confirmLabel={confirmClear === 'documents' ? 'Delete files' : 'Clear all'}
        onCancel={() => setConfirmClear(null)}
        onConfirm={async () => {
          const mode = confirmClear;
          if (!mode) return;
          // Clearing is deliberate and destructive by contract, so it neither
          // gains an undo nor keeps an earlier one alive over it.
          setPendingUndo(null);
          await run(
            () => (mode === 'documents' ? platform.records.clearDocuments() : platform.records.clearRecords()),
            mode === 'documents'
              ? hasLegacy
                ? 'Kept files deleted. Older Android files were left alone.'
                : 'Kept files deleted.'
              : hasLegacy
                ? 'This app’s results were cleared. Older Android files were left alone.'
                : 'Recent cleared.',
            'That could not be cleared.',
          );
          setConfirmClear(null);
          await refresh();
        }}
      />
    </>
  );
};
