import { Editor, MarkdownView, Notice, Plugin } from "obsidian";

import { privateDictAPI } from "./privateDictAPI";
import { SyncableDictionarySettingsTab } from "./ui/settingsTab";
import { DictionaryMergeModal } from "./ui/modal";

interface SyncableDictionarySettings {
  globalWords: string[];
  warningThreshold: number;
  syncPollingRate: number;
}

const DEFAULT_SETTINGS: SyncableDictionarySettings = {
  globalWords: [],
  warningThreshold: 5,
  syncPollingRate: 15 * 1000,
};

export default class SyncableDictionaryPlugin extends Plugin {
  settings: SyncableDictionarySettings;
  settingsTab: SyncableDictionarySettingsTab;
  syncIntervalId: NodeJS.Timeout;

  async onload() {
    // Load settings and perform a destructive sync
    await this.loadSettings();
    await this.syncDictionaries(true, false);

    // Set up a periodic syncing interval
    this.syncIntervalId = setInterval(() => {
      void (async () => {
        const hasChanges = await this.checkForExternalChanges();
        if (hasChanges) {
          // Destrucively replace local dict with external dict
          await this.syncDictionaries(false, false);
        } else {
          // Constructively combine local with external dict
          await this.syncDictionaries(false, true);
        }
      })();
    }, this.settings.syncPollingRate);

    console.debug(
      `SyncableDictionary: Set up automatic sync every ${this.settings.syncPollingRate / 1000} seconds.`,
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
            privateDictAPI.addWord(word);
            if (!this.settings.globalWords.includes(word)) {
              this.settings.globalWords.push(word);
              this.saveSettings();
            }
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

    // Final sync of dictionary before unloading
    this.syncDictionaries(false, true).catch((e) =>
      console.error("Error during final dictionary sync:", e),
    );
  }

  async syncDictionaries(
    showNotice: boolean = false,
    shouldMerge: boolean = false,
  ) {
    try {
      const localWords = await privateDictAPI.listWords();

      if (localWords && Array.isArray(localWords)) {
        // Identify words to remove from local dictionary
        const wordsToRemove = localWords.filter(
          (word) => !this.settings.globalWords.includes(word),
        );

        // Identify words to add to local dictionary
        const wordsToAdd = this.settings.globalWords.filter(
          (word) => !localWords.includes(word),
        );

        const merge = async (): Promise<number> => {
          let mergedCount = 0;
          let madeChanges = false;

          for (const word of wordsToRemove) {
            if (!this.settings.globalWords.includes(word)) {
              this.settings.globalWords.push(word);
              mergedCount++;
              madeChanges = true;
            }
          }

          // Add missing words to lcoal dictionary
          for (const word of wordsToAdd) {
            privateDictAPI.addWord(word);
          }

          if (madeChanges) {
            this.settings.globalWords.sort((a: string, b: string) =>
              a.toLowerCase().localeCompare(b.toLowerCase()),
            );
            await this.saveSettings();
          }

          return mergedCount;
        };

        if (shouldMerge) {
          // if we merge we return early
          await merge();
          return;
        }

        // If we surpass warning threshold, show confirmation dialog
        if (wordsToRemove.length >= this.settings.warningThreshold) {
          const modal = new DictionaryMergeModal(
            this.app,
            this,
            wordsToRemove,
            // Function to execute if user confirms removal
            () => {
              void (async () => {
                // Remove words from system dictionary
                for (const word of wordsToRemove) {
                  privateDictAPI.removeWord(word);
                }

                // Add missing words to system dictionary
                for (const word of wordsToAdd) {
                  privateDictAPI.addWord(word);
                }

                if (showNotice) {
                  new Notice(
                    `Dictionary sync complete: ${wordsToAdd.length} words added, ${wordsToRemove.length} words removed`,
                  );
                }
              })();
            },
            // Function to execute if user chooses to merge instead
            () => {
              void (async () => {
                const mergedCount = await merge();

                if (showNotice) {
                  new Notice(
                    `Dictionary merged: ${mergedCount} words added to global dictionary, ${wordsToAdd.length} words added to system`,
                  );
                }
              })();
            },
          );
          modal.open();
        } else {
          // If 5 or fewer words to remove, proceed with normal sync
          let removedFromApiCount = 0;
          for (const word of wordsToRemove) {
            privateDictAPI.removeWord(word);
            removedFromApiCount++;
          }

          let addedToApiCount = 0;
          for (const word of wordsToAdd) {
            privateDictAPI.addWord(word);
            addedToApiCount++;
          }

          if ((addedToApiCount > 0 || removedFromApiCount > 0) && showNotice) {
            new Notice(
              `Dictionary sync complete: ${addedToApiCount} words added to system, ${removedFromApiCount} removed from system`,
            );
          }
        }
      }
    } catch (dictError) {
      console.error("Failed to sync dictionaries:", dictError);
    }
  }

  async checkForExternalChanges() {
    // Load the latest data from disk
    const latestData = (await this.loadData()) as SyncableDictionarySettings;

    if (!latestData || !latestData.globalWords) return false;

    // Check if there are any differences between disk data and current memory
    // by comparing lengths and contents
    const currentWords = this.settings.globalWords;
    const externalWords = latestData.globalWords;

    if (
      currentWords.length !== externalWords.length ||
      !currentWords.every((word) => externalWords.includes(word)) ||
      !externalWords.every((word) => currentWords.includes(word))
    ) {
      // completely replace current settings with external data
      this.settings.globalWords = [...externalWords];

      // resort the list
      this.settings.globalWords.sort((a: string, b: string) =>
        a.toLowerCase().localeCompare(b.toLowerCase()),
      );

      // refresh settings tab so that wordcounts and words update
      this.settingsTab.refresh();

      console.debug(
        `External settings file has changed, replaced in-memory dictionary with ${externalWords.length} words`,
      );
      return true;
    }

    return false;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
