import { Editor, MarkdownView, Notice, Plugin } from "obsidian";

import { privateDictAPI } from "./privateDictAPI";
import { GlobalDictionarySettingTab } from "./ui/settingsTab";
import { DictionaryMergeModal } from "./ui/modal";

interface GlobalDictionarySettings {
  globalWords: string[];
}

const DEFAULT_SETTINGS: GlobalDictionarySettings = {
  globalWords: [],
};

export default class GlobalDictionarySyncPlugin extends Plugin {
  settings: GlobalDictionarySettings;
  syncIntervalId: NodeJS.Timeout;

  async onload() {
    await this.loadSettings();

    await this.syncDictionaries(true);

    this.syncIntervalId = setInterval(
      () => {
        this.syncDictionaries(false, true); // Don't show notices for background syncs
      },
      2 * 60 * 1000,
    );

    console.log("Global Dictionary: Set up automatic sync every 2 minutes");

    this.addSettingTab(new GlobalDictionarySettingTab(this.app, this));

    this.addCommand({
      id: "add-selection-to-synced-dictionary",
      name: "Add selection to Global Dictionary",
      editorCallback: (editor: Editor, _: MarkdownView) => {
        const selection = editor.getSelection();
        if (selection) {
          const word = selection.trim();
          if (word) {
            privateDictAPI.addWord(word);
          } else {
            new Notice("No word selected.");
          }
        } else {
          new Notice("No word selected.");
        }
      },
    });
  }

  // On unload, sync all extra local words to global
  onunload() {
    // Clear the sync interval when plugin is unloaded
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

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

        async function merge(): Promise<number> {
          let mergedCount = 0;
          for (const word of wordsToRemove) {
            if (!this.settings.globalWords.includes(word)) {
              this.settings.globalWords.push(word);
              mergedCount++;
            }
          }

          // Add missing words to system dictionary
          for (const word of wordsToAdd) {
            privateDictAPI.addWord(word);
          }

          this.settings.globalWords.sort((a: string, b: string) =>
            a.toLowerCase().localeCompare(b.toLowerCase()),
          );

          await this.saveSettings();

          return mergedCount;
        }

        if (shouldMerge) {
          merge();
        }

        // If we have 5 words or more to remove, show confirmation dialog
        if (wordsToRemove.length >= 5 && showNotice) {
          const modal = new DictionaryMergeModal(
            this.app,
            this,
            wordsToRemove,
            // Function to execute if user confirms removal
            async () => {
              // Remove words from system dictionary
              for (const word of wordsToRemove) {
                privateDictAPI.removeWord(word);
              }

              // Add missing words to system dictionary
              for (const word of wordsToAdd) {
                privateDictAPI.addWord(word);
              }

              new Notice(
                `Dictionary sync complete: ${wordsToAdd.length} words added, ${wordsToRemove.length} words removed`,
              );
            },
            // Function to execute if user chooses to merge instead
            async () => {
              const mergedCount = merge();

              new Notice(
                `Dictionary merged: ${mergedCount} words added to global dictionary, ${wordsToAdd.length} words added to system`,
              );
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

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
