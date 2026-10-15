import { App, Modal, PluginSettingTab, Setting, Notice } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { privateDictAPI } from "../electronDictAPI";
import SyncableDictionaryPlugin from "../main";

export class SyncableDictionarySettingsTab extends PluginSettingTab {
  plugin: SyncableDictionaryPlugin;

  constructor(app: App, plugin: SyncableDictionaryPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  refresh(): void {
    this.update();
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
