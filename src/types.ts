export interface SyncableDictionarySettings {
  globalWords: string[];
  /** The state of globalWords the last time we successfully synced */
  lastSnapshot: string[];
  /** The threshold set where a number of local deletions will trigger a merge/overwrite popup */
  warningThreshold: number;
  /** The rate dictionary sync is checked. A higher rate results in faster syncing, but more overhead. */
  syncPollingRate: number;
}

export const DEFAULT_SETTINGS: SyncableDictionarySettings = {
  globalWords: [],
  lastSnapshot: [],
  warningThreshold: 5,
  syncPollingRate: 15 * 1000,
};

export interface MergeConflict {
  word: string;
  localState: "added" | "deleted";
  remoteState: "added" | "deleted";
}

export interface MergeResult {
  finalWords: string[];
  conflicts: MergeConflict[];
}
