import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { privateDictAPI } from "../privateDictAPI";
import SyncableDictionaryPlugin from "../main";

export class SyncableDictionarySettingsTab extends PluginSettingTab {
  plugin: SyncableDictionaryPlugin;
  searchInput: HTMLInputElement;
  wordsList: HTMLElement;
  countIndicator: HTMLElement;
  filteredWords: string[] = [];

  constructor(app: App, plugin: SyncableDictionaryPlugin) {
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

    new Setting(containerEl)
      .setName("Global dictionary sync settings")
      .setHeading();

    // new word input and add button
    const addWordSetting = new Setting(containerEl)
      .setName("Add word to dictionary")
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
      text: "Add word",
      cls: "dictionary-add-button",
    });

    // Add event listener to the button
    addWordButton.addEventListener("click", () => {
      void (async () => {
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
      })();
    });

    // Combined search and dictionary management section
    const dictionarySetting = new Setting(containerEl)
      .setName("Search global dictionary")
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

      removeButton.addEventListener("click", () => {
        void (async () => {
          try {
            privateDictAPI.removeWord(word);
            this.plugin.settings.globalWords =
              this.plugin.settings.globalWords.filter((w) => w !== word);
            await this.plugin.saveSettings();
            new Notice(`'${word}' removed from dictionary.`);
            this.filterWords(); // refresh the display
            this.updateWordCount(); // update the word count
          } catch (e) {
            new Notice(`Error removing word: ${e}.`);
          }
        })();
      });
    });
  }
}
