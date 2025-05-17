import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  Platform,
  Modal,
  ButtonComponent,
} from "obsidian";

// INFO: This class is prone to breaking because it calls private methods
class PrivateDictAPI {
  private session: any;

  constructor() {
    const electron = require("electron") as any;
    if (electron && electron.remote) {
      const remote = electron.remote;
      const currentWebContents = remote.getCurrentWebContents();
      this.session = currentWebContents.session;
    }
  }

  addWord(newEntry: string) {
    console.log(`ADDING WORD: ${newEntry}`);
    this.session.addWordToSpellCheckerDictionary(newEntry);
  }

  removeWord(word: string) {
    this.session.removeWordFromSpellCheckerDictionary(word);
  }

  async listWords(): Promise<string> {
    return await this.session.listWordsInSpellCheckerDictionary();
  }
}
const privateDictAPI = new PrivateDictAPI();

interface GlobalDictionarySettings {
  globalWords: string[];
}

const DEFAULT_SETTINGS: GlobalDictionarySettings = {
  globalWords: [],
};

export default class GlobalDictionarySyncPlugin extends Plugin {
  settings: GlobalDictionarySettings;

  async onload() {
    await this.loadSettings();

    // INFO: Two-way sync between private dictionary API and our global dictionary
    try {
      const localWords = await privateDictAPI.listWords();
      console.log("Local words:", localWords);

      if (localWords && Array.isArray(localWords)) {
        // Identify words to remove from local dictionary
        const wordsToRemove = localWords.filter(
          (word) => !this.settings.globalWords.includes(word),
        );

        // Identify words to add to local dictionary
        const wordsToAdd = this.settings.globalWords.filter(
          (word) => !localWords.includes(word),
        );

        // If we have 5 words or more to remove, show confirmation dialog
        if (wordsToRemove.length >= 5) {
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
              // Add the words to global dictionary instead of removing them
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

              // Sort and save
              this.settings.globalWords.sort((a, b) =>
                a.toLowerCase().localeCompare(b.toLowerCase()),
              );
              await this.saveSettings();

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

          if (addedToApiCount > 0 || removedFromApiCount > 0) {
            new Notice(
              `Dictionary sync complete: ${addedToApiCount} words added to system, ${removedFromApiCount} removed from system`,
            );
          }
        }
      }
    } catch (dictError) {
      console.error("Failed to sync dictionaries:", dictError);
    }

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

  // onunload() {
  // not sure it's needed as of now
  // }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class GlobalDictionarySettingTab extends PluginSettingTab {
  plugin: GlobalDictionarySyncPlugin;
  searchInput: HTMLInputElement;
  wordsList: HTMLElement;
  filteredWords: string[] = [];

  constructor(app: App, plugin: GlobalDictionarySyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    document.body.classList.add("synced-dictionary-settings");

    // INFO: ------
    // -- Header --
    // ------------
    this.addStyles();
    containerEl.createEl("h2", { text: "Global Dictionary Sync Settings" });

    // INFO: -----------------------
    // -- Add word to dict button --
    // -----------------------------
    const addWordSetting = new Setting(containerEl)
      .setName("Add Word to Dictionary")
      .setDesc("Enter a word to add to your global dictionary.");

    const addWordContainer = addWordSetting.controlEl.createDiv(
      "dictionary-add-container",
    );

    const addWordInput = addWordContainer.createEl("input", {
      attr: {
        type: "text",
        placeholder: "Enter a word...",
      },
      cls: "dictionary-add-input",
    });

    const addWordButton = addWordContainer.createEl("button", {
      text: "Add Word",
      cls: "dictionary-add-button",
    });

    addWordButton.addEventListener("click", async () => {
      const word = addWordInput.value.trim();
      if (word) {
        if (!this.plugin.settings.globalWords.includes(word)) {
          try {
            privateDictAPI.addWord(word);
          } catch (e) {
            new Notice(
              `Can't update dictionary: ${e}. NOTE: Updating dict doesn't work on iOS (untested on android).`,
            );
            return;
          }
          this.plugin.settings.globalWords.push(word);
          this.plugin.settings.globalWords.sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase()),
          );
          await this.plugin.saveSettings();
          new Notice(`'${word}' added to dictionary.`);
          addWordInput.value = ""; // Clear the input
          this.filterWords(); // Refresh the word list
        } else {
          new Notice(`'${word}' is already in your dictionary.`);
        }
      }
    });

    // INFO: ----------------------------
    // -- Search and manage dictionary --
    // ----------------------------------
    const dictionarySetting = new Setting(containerEl)
      .setName("Manage Global Dictionary")
      .setDesc("Search, add, or remove words from your dictionary.");

    const searchContainer = dictionarySetting.controlEl.createDiv(
      "dictionary-search-container",
    );
    this.searchInput = searchContainer.createEl("input", {
      attr: {
        type: "text",
        id: "dictionary-search",
        placeholder: "Type to filter words...",
      },
    });

    this.searchInput.addEventListener("input", () => {
      this.filterWords();
    });

    const wordsContainer = containerEl.createDiv("dictionary-words-container");
    this.wordsList = wordsContainer.createDiv("dictionary-words-list");

    const countIndicator = containerEl.createDiv("dictionary-count");
    countIndicator.createSpan({
      text: `Total words in dictionary: ${this.plugin.settings.globalWords.length}`,
    });

    this.filteredWords = [...this.plugin.settings.globalWords];
    this.renderWordsList();
  }

  filterWords(): void {
    const searchTerm = this.searchInput.value.toLowerCase();
    if (searchTerm) {
      this.filteredWords = this.plugin.settings.globalWords.filter((word) =>
        word.toLowerCase().includes(searchTerm),
      );
    } else {
      this.filteredWords = [...this.plugin.settings.globalWords];
    }
    this.renderWordsList();
  }

  renderWordsList(): void {
    this.wordsList.empty();

    if (this.filteredWords.length === 0) {
      if (this.searchInput.value) {
        this.wordsList.createEl("p", {
          text: "No matching words found.",
          cls: "dictionary-empty-message",
        });
      } else {
        this.wordsList.createEl("p", {
          text: 'No words in the dictionary yet. Use the command "Add selection to Global Dictionary" to add some!',
          cls: "dictionary-empty-message",
        });
      }
      return;
    }

    const ul = this.wordsList.createEl("ul", { cls: "dictionary-words-ul" });

    this.filteredWords.forEach((word) => {
      const li = ul.createEl("li", { cls: "dictionary-word-item" });
      li.createSpan({ text: word, cls: "dictionary-word-text" });

      const removeButton = li.createEl("button", {
        text: "Remove",
        cls: "dictionary-remove-button",
      });

      removeButton.addEventListener("click", async () => {
        try {
          privateDictAPI.removeWord(word);
          this.plugin.settings.globalWords =
            this.plugin.settings.globalWords.filter((w) => w !== word);
          await this.plugin.saveSettings();
          new Notice(`'${word}' removed from dictionary.`);
          this.filterWords(); // Refresh the display
        } catch (e) {
          new Notice(
            `Error removing word: ${e}. NOTE: Updating dict doesn't work on iOS (untested on android).`,
          );
        }
      });
    });
  }

  addStyles() {
    // Add a <style> element if needed for the dictionary styles
    if (!document.getElementById("synced-dictionary-styles")) {
      const styleEl = document.head.createEl("style");
      styleEl.id = "synced-dictionary-styles";
      styleEl.textContent = `
        .dictionary-search-container {
          display: flex;
          align-items: center;
          flex-grow: 1;
          width: 100%;
        }
        
        .dictionary-search-container input {
          width: 100%;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--background-modifier-border);
          background-color: var(--background-primary);
          color: var(--text-normal);
        }
        
        .dictionary-words-container {
          max-height: 350px;
          overflow-y: auto;
          border: 1px solid var(--background-modifier-border);
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .dictionary-words-list {
          padding: 10px;
        }
        
        .dictionary-words-ul {
          list-style-type: none;
          padding-left: 0;
          margin: 0;
        }
        
        .dictionary-word-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 5px;
          border-bottom: 1px solid var(--background-modifier-border-hover);
          transition: background-color 0.2s;
        }
        
        .dictionary-word-item:hover {
          background-color: var(--background-modifier-hover);
        }
        
        .dictionary-word-text {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .dictionary-remove-button {
          padding: 4px 8px;
          background: var(--background-modifier-error-rgb);
          color: white;
          border-radius: 4px;
          font-size: 0.8em;
          opacity: 0.7;
          transition: opacity 0.2s;
					cursor: pointer;
        }
        
        .dictionary-remove-button:hover {
          opacity: 1;
        }
        
        .dictionary-empty-message {
          padding: 20px;
          text-align: center;
          color: var(--text-muted);
        }
        
        .dictionary-count {
          text-align: right;
          font-size: 0.8em;
          color: var(--text-muted);
          padding: 5px;
        }

        .dictionary-add-container {
          display: flex;
          width: 100%;
          gap: 8px;
        }
        
        .dictionary-add-input {
          flex-grow: 1;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--background-modifier-border);
          background-color: var(--background-primary);
          color: var(--text-normal);
        }
        
        .dictionary-add-button {
          padding: 8px 12px;
          border-radius: 4px;
          background-color: var(--interactive-accent);
          color: var(--text-on-accent);
          font-size: 0.8em;
          cursor: pointer;
          transition: background-color 0.2s;
          border: none;
        }
        
        .dictionary-add-button:hover {
          background-color: var(--interactive-accent-hover);
        }
      `;
    }
  }
}
class DictionaryMergeModal extends Modal {
  plugin: GlobalDictionarySyncPlugin;
  wordsToRemove: string[];
  onConfirmRemove: () => void;
  onMerge: () => void;

  constructor(
    app: App,
    plugin: GlobalDictionarySyncPlugin,
    wordsToRemove: string[],
    onConfirmRemove: () => void,
    onMerge: () => void,
  ) {
    super(app);
    this.plugin = plugin;
    this.wordsToRemove = wordsToRemove;
    this.onConfirmRemove = onConfirmRemove;
    this.onMerge = onMerge;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Dictionary Sync Conflict" });

    contentEl.createEl("p", {
      text: `${this.wordsToRemove.length} words (shown below) will be removed from your local dictionary based on the synced dictionary.`,
    });

    contentEl.createEl("p", {
      text: "Do you want to remove these, or merge them into the global synced dictionary?",
    });

    // Create container for displaying words
    const wordsContainer = contentEl.createDiv(
      "dictionary-merge-words-container",
    );
    const wordsList = wordsContainer.createEl("ul");

    // Show at most 20 words to avoid excessively large modals
    const displayWords = this.wordsToRemove.slice(0, 20);
    displayWords.forEach((word) => {
      wordsList.createEl("li", { text: word });
    });

    // If there are more words than we're showing
    if (this.wordsToRemove.length > 20) {
      contentEl.createEl("p", {
        text: `...and ${this.wordsToRemove.length - 20} more words`,
        cls: "dictionary-merge-more-text",
      });
    }

    const buttonContainer = contentEl.createDiv("dictionary-merge-buttons");
    new ButtonComponent(buttonContainer)
      .setButtonText(`Remove ${this.wordsToRemove.length} Words`)
      .setCta()
      .onClick(() => {
        this.onConfirmRemove();
        this.close();
      });

    new ButtonComponent(buttonContainer)
      .setButtonText("Merge Words")
      .onClick(() => {
        this.onMerge();
        this.close();
      });

    contentEl.createEl("style", {
      text: `
        .dictionary-merge-words-container {
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid var(--background-modifier-border);
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 16px;
        }
        
        .dictionary-merge-more-text {
          text-align: center;
          font-style: italic;
          color: var(--text-muted);
        }
        
        .dictionary-merge-buttons {
          display: flex;
          justify-content: space-around;
          margin-top: 20px;
          gap: 10px;
        }
      `,
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
