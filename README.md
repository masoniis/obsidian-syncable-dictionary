# obsidian-syncable-dictionary


This plugin maintains a global list of custom words inside the `.obsidian` folder so that they can be synced across desktop devices (mobile devices use their own native dictionaries) without the user having to worry about it.

Note that this does not sync the dictionary all on it's own. You still need to have a syncing system such as Obsidian sync set up, this plugin just moves the information of the dictionary to a **syncable location**.


## Warnings
- The plugin relies on calls to private Obsidian APIs to manage the Obsidian dictionary. These could break unexpectedly, but the hope is they don't break often!
- I recommend you create a backup of your dictionary if you have many important entries as the plugin has currently only been tested by me (although without any dictionary destruction... yet)

## How the syncing works

There are two ways this plugin syncs words
1. Merge a local dictionary with the global list. This always results in a equal-size or larger global dictionary
2. By replacing the local dictionary with the global list word-for-word. This may delete local entries.

Every 15 seconds (todo: configurable) the plugin checks for internal changes to the local dictionary and external changes to the global dictionary.
- If there were external changes, we replace the local dictionary with the global dictionary.
- If there were local changes, we merge the local dictionary with the global dictionary.
- If there were external AND local changes, we replace the local dictionary with the global dictionary BUT if more than 5 local words are going to be deleted by this, the user gets a popup allowing them to choose merge or replacement.
