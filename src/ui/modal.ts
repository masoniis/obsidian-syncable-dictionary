import { App, Modal, ButtonComponent } from "obsidian";
import GlobalDictionarySyncPlugin from "../main";

export class DictionaryMergeModal extends Modal {
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
