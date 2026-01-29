// INFO: ---------------------------
//         target interfaces
// ---------------------------------

interface ElectronSession {
  addWordToSpellCheckerDictionary(word: string): void;
  removeWordFromSpellCheckerDictionary(word: string): void;
  listWordsInSpellCheckerDictionary(): Promise<string[]>;
}

interface WebContents {
  session: ElectronSession;
}

interface ElectronRemote {
  getCurrentWebContents(): WebContents;
}

interface ElectronModule {
  remote: ElectronRemote;
}

// INFO: ------------------------
//         concrete class
// ------------------------------

// NOTE: This class is prone to breaking because it relies on obsidian API private methods
//
// This relies on the [obsidian-typings](https://github.com/Fevol/obsidian-typings) library
// and their work regarding the typing of internal undocumented APIs.
export class PrivateDictAPI {
  private session: ElectronSession | null = null;

  constructor() {
    // safely check if require can be called
    const requireFn = Reflect.get(window, "require");

    if (typeof requireFn === "function") {
      try {
        // try to load electron
        const electron = requireFn("electron") as unknown as ElectronModule;

        if (electron && electron.remote) {
          const remote = electron.remote;
          const currentWebContents = remote.getCurrentWebContents();
          this.session = currentWebContents.session;
        } else {
          console.debug(
            "PrivateDictAPI: Electron found, but 'remote' API is missing.",
          );
        }
      } catch (e) {
        console.debug("Electron API not available via window.require: ", e);
      }
    } else {
      console.debug(
        "PrivateDictAPI: Not running in an Electron environment (maybe you are on mobile?).",
      );
    }
  }

  /**
   * Safe guard to check if the specific electron method exists at runtime.
   */
  private isMethodAvailable(methodName: keyof ElectronSession): boolean {
    return (
      this.session !== null && typeof this.session[methodName] === "function"
    );
  }

  addWord(newEntry: string) {
    if (this.isMethodAvailable("addWordToSpellCheckerDictionary")) {
      try {
        this.session!.addWordToSpellCheckerDictionary!(newEntry);
      } catch (e) {
        console.warn(
          "Failed to add word to obsidian Spellcheck dictionary:",
          e,
        );
      }
    }
  }

  removeWord(word: string) {
    if (this.isMethodAvailable("removeWordFromSpellCheckerDictionary")) {
      try {
        this.session!.removeWordFromSpellCheckerDictionary!(word);
      } catch (e) {
        console.warn(
          "Failed to remove word from obsidian Spellcheck dictionary:",
          e,
        );
      }
    }
  }

  async listWords(): Promise<string[]> {
    if (this.isMethodAvailable("listWordsInSpellCheckerDictionary")) {
      try {
        return (await this.session!.listWordsInSpellCheckerDictionary!()) ?? [];
      } catch (e) {
        console.warn("Failed to list words from system dictionary:", e);
      }
    }
    return [];
  }
}

export const privateDictAPI = new PrivateDictAPI();
