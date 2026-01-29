import type { Session } from "electron";

// INFO: -------------------------
//         glue interfaces
// -------------------------------

// modern electron types removed 'remote', but obsidian
// still provides it
interface LegacyWebContents {
  session: Session;
}

interface LegacyRemote {
  getCurrentWebContents(): LegacyWebContents;
}

interface LegacyElectronModule {
  remote: LegacyRemote;
}

// INFO: ------------------------
//         concrete class
// ------------------------------

/**
 * This class relies on targeting electron and hooking on to their Spellcheck API.
 *
 * This is because Obsidian internally uses the electron official spellchecker, so
 * modifying the electron session's spellchecker also modifies the obsidian "built-in"
 * dictionary, but of course this only works for the electron obsidian platforms.
 */
export class ElectronDictAPI {
  private session: Session | null = null;

  constructor() {
    // safely check if require can be called via Reflect
    const requireFn = Reflect.get(window, "require");

    if (typeof requireFn === "function") {
      try {
        // try to load electron module dynamically
        const electron = requireFn(
          "electron",
        ) as unknown as LegacyElectronModule;

        // check for the legacy 'remote' property (obsidian should have this enabled)
        if (electron && electron.remote) {
          const remote = electron.remote;
          const currentWebContents = remote.getCurrentWebContents();

          this.session = currentWebContents.session;
          console.debug(
            "✅ PrivateDictAPI: Successfully hooked into Electron session.",
          );
        } else {
          console.debug(
            "⚠️ PrivateDictAPI: Electron found, but 'remote' API is missing.",
          );
        }
      } catch (e) {
        console.debug(
          "⚠️ PrivateDictAPI: Electron API not available via window.require: ",
          e,
        );
      }
    } else {
      console.debug(
        "ℹ️ PrivateDictAPI: Not running in an Electron environment (likely mobile).",
      );
    }
  }

  /**
   * Safe guard to check if the specific electron method exists at runtime.
   */
  private isMethodAvailable(methodName: keyof Session): boolean {
    return (
      this.session !== null && typeof this.session[methodName] === "function"
    );
  }

  addWord(newEntry: string) {
    if (this.isMethodAvailable("addWordToSpellCheckerDictionary")) {
      try {
        this.session!.addWordToSpellCheckerDictionary(newEntry);
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
        this.session!.removeWordFromSpellCheckerDictionary(word);
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
        return (await this.session!.listWordsInSpellCheckerDictionary()) ?? [];
      } catch (e) {
        console.warn("Failed to list words from system dictionary:", e);
      }
    }
    return [];
  }
}

export const privateDictAPI = new ElectronDictAPI();
