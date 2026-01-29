import { App, Modal, ButtonComponent } from "obsidian";
import SyncableDictionaryPlugin from "../main";

export class DictionaryMergeModal extends Modal {
  plugin: SyncableDictionaryPlugin;
  wordsToRemove: string[];
  onConfirmRemove: () => void | Promise<void>;
  onMerge: () => void | Promise<void>;

  constructor(
    app: App,
    plugin: SyncableDictionaryPlugin,
    wordsToRemove: string[],
    onConfirmRemove: () => void | Promise<void>,
    onMerge: () => void | Promise<void>,
  ) {
    super(app);
    this.plugin = plugin;
    this.wordsToRemove = wordsToRemove;
    this.onConfirmRemove = onConfirmRemove;
    this.onMerge = onMerge;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Dictionary sync conflict" });

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
      .setButtonText(`Remove ${this.wordsToRemove.length} words`)
      .setCta()
      .onClick(() => {
        void this.onConfirmRemove();
        this.close();
      });

    new ButtonComponent(buttonContainer)
      .setButtonText("Merge words")
      .onClick(() => {
        void this.onMerge();
        this.close();
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
