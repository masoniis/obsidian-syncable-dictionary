import { MergeResult, MergeConflict } from "./types";

/**
 * Handles 3-way merging of dictionary (string) lists based on...
 * - A **local** list (current device dictionary)
 * - A **remote** list (external device dictionary)
 * - A **snapshot** list (the local list after last known sync)
 */
export class DictionaryMerger {
  /**
   * Performs a 3-way merge: Snapshot vs Local vs Remote.
   *
   * Returns a result containing the merged list and any unresolved conflicts.
   */
  static merge(
    snapshot: string[],
    local: string[],
    remote: string[],
  ): MergeResult {
    const finalSet = new Set(snapshot);
    const conflicts: MergeConflict[] = [];

    // calculate incoming changes from remote
    const remoteAdditions = remote.filter((w) => !snapshot.includes(w));
    const remoteDeletions = snapshot.filter((w) => !remote.includes(w));

    // calculate local changes (user)
    const localAdditions = local.filter((w) => !snapshot.includes(w));
    const localDeletions = snapshot.filter((w) => !local.includes(w));

    // handle remote additions
    remoteAdditions.forEach((w) => {
      if (localDeletions.includes(w)) {
        // CONFLICT: Remote added it, but Local deleted it
        conflicts.push({
          word: w,
          localState: "deleted",
          remoteState: "added",
        });
      } else {
        finalSet.add(w);
      }
    });

    // handle remote deletions
    remoteDeletions.forEach((w) => {
      if (localAdditions.includes(w)) {
        // CONFLICT: Remote deleted it, but Local added it
        conflicts.push({
          word: w,
          localState: "added",
          remoteState: "deleted",
        });
      } else {
        finalSet.delete(w);
      }
    });

    // handle local additions
    localAdditions.forEach((w) => {
      // if remote also deleted it, we already caught that
      // if remote didn't touch it, we just add it.
      if (!remoteDeletions.includes(w)) {
        finalSet.add(w);
      }
    });

    // handle local deletions
    localDeletions.forEach((w) => {
      // if remote also added it, conflict is already caught
      // if remote didn't touch it, just delete it.
      if (!remoteAdditions.includes(w)) {
        finalSet.delete(w);
      }
    });

    return {
      finalWords: Array.from(finalSet).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase()),
      ),
      conflicts,
    };
  }
}
