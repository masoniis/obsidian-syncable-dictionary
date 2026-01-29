import { Editor, MarkdownView, Notice, Plugin } from "obsidian";

import { privateDictAPI } from "./electronDictAPI";
import { SyncableDictionarySettingsTab } from "./ui/settingsTab";
import { DictionaryMergeModal } from "./ui/mergeModal";
import { DictionaryConflictModal } from "./ui/conflictModal";
import { SyncableDictionarySettings, DEFAULT_SETTINGS } from "./types";
import { DictionaryMerger } from "./dictionaryMerger";

export default class SyncableDictionaryPlugin extends Plugin {
  settings: SyncableDictionarySettings;
  settingsTab: SyncableDictionarySettingsTab;
  syncIntervalId: NodeJS.Timeout;

  async onload() {
    await this.loadSettings();

    // initial sync: force a merge on startup to catch up with any changes while closed
    await this.syncDictionaries(true);

    // set up a periodic syncing interval
    this.syncIntervalId = setInterval(() => {
      void (async () => {
        await this.syncDictionaries(false);
      })();
    }, this.settings.syncPollingRate);

    console.debug(
      `SyncableDictionary: Set up automatic sync every ${
        this.settings.syncPollingRate / 1000
      } seconds.`,
    );

    this.settingsTab = new SyncableDictionarySettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.addCommand({
      id: "add-selection-to-synced-dictionary",
      name: "Add selection to Global Dictionary",
      editorCallback: (editor: Editor, _: MarkdownView) => {
        const selection = editor.getSelection();
        if (selection) {
          const word = selection.trim();
          if (word) {
            void this.addWordImmediate(word);
          } else {
            new Notice("No word selected.");
          }
        } else {
          new Notice("No word selected.");
        }
      },
    });
  }

  onunload() {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);

    // final sync of dictionary before unloading
    this.syncDictionaries(false).catch((e) =>
      console.error("Error during final dictionary sync:", e),
    );
  }

  /**
   * Adds a word to both Electron and Settings immediately to prevent race conditions.
   */
  async addWordImmediate(word: string) {
    // visual feedback (fast)
    privateDictAPI.addWord(word);

    // state update (safe)
    if (!this.settings.globalWords.includes(word)) {
      this.settings.globalWords.push(word);
      // save immediately so the "Local" state is updated for the next sync
      await this.saveSettings(false);
      new Notice(`Added "${word}" to dictionary`);
    }
  }

  /**
   * The Core Sync Loop.
   * Uses 3-way merge to reconcile Disk (Remote) vs Memory (Local) vs History (Snapshot).
   */
  async syncDictionaries(showNotice: boolean = false) {
    try {
      // load remote state (from disk)
      const diskData = await this.loadData();
      const remoteWords = (diskData?.globalWords as string[]) || [];

      // load local state (from memory)
      const localWords = this.settings.globalWords;
      const snapshot = this.settings.lastSnapshot;

      // merge and handle conflicts
      const result = DictionaryMerger.merge(snapshot, localWords, remoteWords);
      if (result.conflicts.length > 0) {
        // pause sync and ask user to resolve
        new DictionaryConflictModal(
          this.app,
          result.conflicts,
          async (resolvedWords) => {
            // merge resolved words back into the final set
            const combinedSet = new Set([
              ...result.finalWords,
              ...resolvedWords,
            ]);
            const finalWords = Array.from(combinedSet).sort((a, b) =>
              a.toLowerCase().localeCompare(b.toLowerCase()),
            );

            await this.finishSyncProcess(finalWords, showNotice);
          },
        ).open();
        return;
      }

      await this.finishSyncProcess(result.finalWords, showNotice);
    } catch (e) {
      console.error("Failed to sync dictionaries:", e);
    }
  }

  /**
   * Completes the sync process: calculates diffs, checks thresholds, and saves.
   */
  async finishSyncProcess(newGlobalWords: string[], showNotice: boolean) {
    // calculate effect on electron
    const electronWords = (await privateDictAPI.listWords()) || [];
    const wordsToAdd = newGlobalWords.filter((w) => !electronWords.includes(w));
    const wordsToRemove = electronWords.filter(
      (w) => !newGlobalWords.includes(w),
    );

    // check thresholds (safety warning)
    if (wordsToRemove.length >= this.settings.warningThreshold) {
      const modal = new DictionaryMergeModal(
        this.app,
        this,
        wordsToRemove,
        // confirm Removal
        async () => {
          await this.finalizeSync(newGlobalWords, wordsToAdd, wordsToRemove);
          if (showNotice) new Notice("Sync Complete: Deletions applied.");
        },
        // cancel/merge (keep local words instead of deleting)
        async () => {
          // if user refuses deletion, words are treated as "New Local Additions"
          // by adding them back to the new global list.
          const forcedKeepWords = [...newGlobalWords, ...wordsToRemove].sort();
          await this.finalizeSync(forcedKeepWords, wordsToAdd, []); // no removals
          if (showNotice)
            new Notice("Sync Complete: Deletions cancelled, words kept.");
        },
      );
      modal.open();
      return;
    } else {
      // execute sync normally
      await this.finalizeSync(newGlobalWords, wordsToAdd, wordsToRemove);

      if (showNotice && (wordsToAdd.length > 0 || wordsToRemove.length > 0)) {
        new Notice(
          `Dictionary synced: +${wordsToAdd.length} / -${wordsToRemove.length}`,
        );
      }
    }
  }

  /**
   * Applies the calculated state to all data stores: Settings, Snapshot, Disk, and Electron.
   */
  async finalizeSync(
    newGlobalWords: string[],
    toAdd: string[],
    toRemove: string[],
  ) {
    // update obsidian's electron "native" dict
    for (const w of toAdd) privateDictAPI.addWord(w);
    for (const w of toRemove) privateDictAPI.removeWord(w);

    // update settings values (stored in memory)
    this.settings.globalWords = newGlobalWords;

    // update snapshot (current state) and save to disk
    this.settings.lastSnapshot = [...newGlobalWords];
    await this.saveData(this.settings);

    // refresh UI
    this.settingsTab?.refresh();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Saves settings.
   * @param updateSnapshot - If true, updates the snapshot to match current words.
   * Usually true after a sync, false after a local user action (pending sync).
   */
  async saveSettings(updateSnapshot: boolean = false) {
    if (updateSnapshot) {
      this.settings.lastSnapshot = [...this.settings.globalWords];
    }
    await this.saveData(this.settings);
  }
}
