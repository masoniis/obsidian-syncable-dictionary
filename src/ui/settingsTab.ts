import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import GlobalDictionarySyncPlugin from "../main";
import { privateDictAPI } from "../privateDictAPI";

export class GlobalDictionarySettingsTab extends PluginSettingTab {
  plugin: GlobalDictionarySyncPlugin;
  searchInput: HTMLInputElement;
  wordsList: HTMLElement;
  countIndicator: HTMLElement;
  filteredWords: string[] = [];

  constructor(app: App, plugin: GlobalDictionarySyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  refresh(): void {
    this.filteredWords = [...this.plugin.settings.globalWords];
    this.updateWordCount();
    this.renderWordsList();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    document.body.classList.add("global-dictionary-settings");

    this.addStyles();

    containerEl.createEl("h2", { text: "Global Dictionary Sync Settings" });

    // New word input and add button
    const addWordSetting = new Setting(containerEl)
      .setName("Add Word to Dictionary")
      .setDesc("Enter a word to add to your global dictionary.");

    // Create container for the input and button
    const addWordContainer = addWordSetting.controlEl.createDiv(
      "dictionary-add-container",
    );

    // Create the input element
    const addWordInput = addWordContainer.createEl("input", {
      attr: {
        type: "text",
        placeholder: "Enter a word...",
      },
      cls: "dictionary-add-input",
    });

    // Create the add button
    const addWordButton = addWordContainer.createEl("button", {
      text: "Add Word",
      cls: "dictionary-add-button",
    });

    // Add event listener to the button
    addWordButton.addEventListener("click", async () => {
      const word = addWordInput.value.trim();
      if (word) {
        if (!this.plugin.settings.globalWords.includes(word)) {
          try {
            privateDictAPI.addWord(word);
          } catch (e) {
            new Notice(
              `NOTE: Updating dict doesn't work on iOS (untested on android).\n\n Can't update dictionary: ${e}.`,
            );
            return;
          }
          this.plugin.settings.globalWords.push(word);
          this.plugin.settings.globalWords.sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase()),
          );
          await this.plugin.saveSettings();
          new Notice(`'${word}' added to dictionary.`);
          addWordInput.value = "";
          this.filterWords();
          this.updateWordCount();
        } else {
          new Notice(`'${word}' is already in your dictionary.`);
        }
      }
    });

    // Combined Search and Dictionary Management
    const dictionarySetting = new Setting(containerEl)
      .setName("Search Global Dictionary")
      .setDesc("Search and remove words from your dictionary.");

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
    this.countIndicator = containerEl.createDiv("dictionary-count");
    this.countIndicator.createSpan({
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

  updateWordCount(): void {
    if (this.countIndicator) {
      this.countIndicator.empty();
      this.countIndicator.createSpan({
        text: `Total words in dictionary: ${this.plugin.settings.globalWords.length}`,
      });
    }
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
          this.updateWordCount(); // Update the word count
        } catch (e) {
          new Notice(
            `NOTE: Updating dict doesn't work on iOS (untested on android).\n\nError removing word: ${e}.`,
          );
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
      `;
    }
  }
}
