// INFO: This class is prone to breaking because it calls private methods
export class PrivateDictAPI {
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

  async listWords(): Promise<string[]> {
    return await this.session.listWordsInSpellCheckerDictionary();
  }
}

// Create a singleton instance
export const privateDictAPI = new PrivateDictAPI();
