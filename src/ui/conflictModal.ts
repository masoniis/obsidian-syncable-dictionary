import { App, Modal, Setting } from "obsidian";
import { MergeConflict } from "../types";

export class DictionaryConflictModal extends Modal {
  private conflicts: MergeConflict[];
  private resolutions: Map<string, boolean>; // true = keep word, false = delete word
  private onSubmit: (resolvedWords: string[]) => void | Promise<void>;

  constructor(
    app: App,
    conflicts: MergeConflict[],
    onSubmit: (resolvedWords: string[]) => void | Promise<void>,
  ) {
    super(app);
    this.conflicts = conflicts;
    this.onSubmit = onSubmit;
    this.resolutions = new Map();

    // default resolution: keep the word
    this.conflicts.forEach((c) => this.resolutions.set(c.word, true));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Dictionary Sync Conflicts" });
    contentEl.createEl("p", {
      text: "The following words have conflicting changes between your local dictionary and the remote file. Please choose which action to take for each word.",
    });

    // create a setting row for each conflict
    this.conflicts.forEach((conflict) => {
      const isRemoteAdd = conflict.remoteState === "added";
      const word = conflict.word;

      new Setting(contentEl)
        .setName(word)
        .setDesc(
          isRemoteAdd
            ? "Remote added this, but you deleted it."
            : "You added this, but remote deleted it.",
        )
        .addDropdown((dropdown) => {
          dropdown
            .addOption("keep", "Keep Word")
            .addOption("discard", "Delete Word")
            .setValue("keep")
            .onChange((value) => {
              this.resolutions.set(word, value === "keep");
            });
        });
    });

    // submit button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Resolve & Sync")
        .setCta()
        .onClick(() => {
          const wordsToKeep: string[] = [];
          this.resolutions.forEach((keep, word) => {
            if (keep) wordsToKeep.push(word);
          });

          this.close();
          void this.onSubmit(wordsToKeep);
        }),
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}
