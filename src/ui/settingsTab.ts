import { App, Modal, PluginSettingTab, Setting, Notice } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { privateDictAPI } from "../electronDictAPI";
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
    if (this.wordsList) {
      this.updateWordCount();
      this.renderWordsList();
    } else if (typeof this.update === "function") {
      this.update();
    }
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "Dictionary syncing",
        items: [
          {
            name: "Warning threshold",
            desc: "If this many words would be removed in a single sync, ask for confirmation before removing them.",
            control: { type: "number", key: "warningThreshold", min: 1 },
          },
          {
            name: "Sync polling rate (ms)",
            desc: "How often the dictionary sync is checked. A higher rate syncs faster but uses more overhead.",
            control: {
              type: "number",
              key: "syncPollingRate",
              min: 1000,
              step: 500,
            },
          },
        ],
      },
      {
        type: "list",
        name: "Global dictionary",
        heading: "Global dictionary",
        emptyState:
          'No words in the dictionary yet. Use the command "add selection to global dictionary" to add some!',
        search: {
          placeholder: "Type to filter words...",
          match: (def, query) =>
            def.name.toLowerCase().includes(query.toLowerCase()),
        },
        addItem: {
          name: "Add word",
          action: () => this.promptAddWord(),
        },
        items: this.plugin.settings.globalWords.map((word) => ({
          name: word,
        })),
        onDelete: (index) => void this.removeWordAt(index),
      },
    ];
  }

  private promptAddWord(): void {
    const modal = new AddWordModal(this.app, (word) => {
      if (this.plugin.settings.globalWords.includes(word)) {
        new Notice(`'${word}' is already in your dictionary.`);
        return;
      }
      void this.plugin.addWordImmediate(word);
    });
    modal.open();
  }

  private async removeWordAt(index: number): Promise<void> {
    const word = this.plugin.settings.globalWords[index];
    if (!word) return;
    privateDictAPI.removeWord(word);
    await this.plugin.syncDictionaries(false);
    new Notice(`'${word}' removed from dictionary.`);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    activeDocument.body.classList.add("global-dictionary-settings");

    new Setting(containerEl).setName("Dictionary syncing").setHeading();

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
              await this.plugin.addWordImmediate(word);

              // refresh ui
              addWordInput.value = "";
              this.filterWords();
              this.updateWordCount();
            } catch (e) {
              new Notice(
                `NOTE: Updating dict doesn't work on iOS (untested on android).\n\n Can't update dictionary: ${e}.`,
              );
            }
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
    // always refresh from source of truth before filtering
    const allWords = this.plugin.settings.globalWords;

    const searchTerm = this.searchInput.value.toLowerCase();
    if (searchTerm) {
      this.filteredWords = allWords.filter((word) =>
        word.toLowerCase().includes(searchTerm),
      );
    } else {
      this.filteredWords = [...allWords];
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
          text: 'No words in the dictionary yet. Use the command "add selection to global dictionary" to add some!',
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
            // remove from electron and sync
            privateDictAPI.removeWord(word);
            await this.plugin.syncDictionaries(false);

            new Notice(`'${word}' removed from dictionary.`);

            // refresh ui
            this.filterWords();
            this.updateWordCount();
          } catch (e) {
            new Notice(`Error removing word: ${e}.`);
          }
        })();
      });
    });
  }
}

class AddWordModal extends Modal {
  private onSubmit: (word: string) => void;

  constructor(app: App, onSubmit: (word: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.titleEl.setText("Add word to dictionary");
    const inputEl = this.contentEl.createEl("input", {
      type: "text",
      placeholder: "Enter a word...",
    });
    inputEl.addClass("dictionary-add-input");

    const submit = () => {
      const word = inputEl.value.trim();
      this.close();
      if (word) this.onSubmit(word);
    };
    inputEl.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") submit();
    });
    inputEl.focus();

    new Setting(this.contentEl).addButton((btn) =>
      btn.setButtonText("Add").setCta().onClick(submit),
    );
  }
}
