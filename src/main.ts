import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  Platform,
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
    // this sync is a non-destructive additive merge. Problem: since it is additive,
    // we can never remove from the synced dictionary properly so this needs a solution
    try {
      const localWords = await privateDictAPI.listWords();

      if (localWords && Array.isArray(localWords)) {
        // Update global dict with new words from local dict
        let addedToGlobalCount = 0;
        for (const word of localWords) {
          if (!this.settings.globalWords.includes(word)) {
            this.settings.globalWords.push(word);
            addedToGlobalCount++;
          }
        }

        // Update local dict with new words from global dict
        let addedToApiCount = 0;
        for (const word of this.settings.globalWords) {
          if (!localWords.includes(word)) {
            privateDictAPI.addWord(word);
            addedToApiCount++;
          }
        }

        // Sort and save if changes were made
        if (addedToGlobalCount > 0) {
          this.settings.globalWords.sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase()),
          );
          await this.saveSettings();
          console.log(
            `Merged dictionaries: Added ${addedToGlobalCount} words from system dictionary to global dictionary`,
          );
        }

        if (addedToApiCount > 0) {
          console.log(
            `Merged dictionaries: Added ${addedToApiCount} words from global dictionary to system dictionary`,
          );
        }

        if (addedToGlobalCount > 0 || addedToApiCount > 0) {
          new Notice(
            `Dictionary sync complete: ${addedToGlobalCount} words added to global, ${addedToApiCount} added to system`,
          );
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

    // Add CSS classes to document
    document.body.classList.add("global-dictionary-settings");
    this.addStyles();

    containerEl.createEl("h2", { text: "Global Dictionary Sync Settings" });

    // Combined Search and Dictionary Management
    const dictionarySetting = new Setting(containerEl)
      .setName("Manage Global Dictionary")
      .setDesc("Search, add, or remove words from your dictionary.");

    // Add search input to the setting
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

    // Words list container
    const wordsContainer = containerEl.createDiv("dictionary-words-container");
    this.wordsList = wordsContainer.createDiv("dictionary-words-list");

    // Word count indicator
    const countIndicator = containerEl.createDiv("dictionary-count");
    countIndicator.createSpan({
      text: `Total words in dictionary: ${this.plugin.settings.globalWords.length}`,
    });

    // Initialize the word list
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
          new Notice(`Error removing word: ${e}`);
        }
      });
    });
  }

  addStyles() {
    // Add a <style> element if needed for the dictionary styles
    if (!document.getElementById("global-dictionary-styles")) {
      const styleEl = document.head.createEl("style");
      styleEl.id = "global-dictionary-styles";
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
          max-height: 300px;
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
      `;
    }
  }
}
