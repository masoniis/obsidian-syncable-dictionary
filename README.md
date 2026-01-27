# obsidian-syncable-dictionary

This plugin maintains a global list of custom words inside the `.obsidian` folder so that they can be synced across **desktop (and only desktop) devices** without the user having to worry about it. If you use something like **Obsidian Sync** then your dictionary should be synced automatically through the plugin's settings assuming you have the right sync options enabled!

- Why no **mobile support**? iOS doesn't abide by the obsidian editor dictionary so there isn't a point in using it on iOS. I am not sure about android, but I assumed something similar may be going on.

## Warnings

- This does not sync the dictionary all on it's own. You still need to have a syncing system such as Obsidian Sync set up, this plugin just moves the information of the dictionary to a **syncable location** (namely the plugin's config inside `.obsidian` folder).
- The plugin relies on calls to private Obsidian APIs to manage the Obsidian dictionary. These could break unexpectedly, but the hope is they don't break often!
- I recommend you create a backup of your dictionary if you have many important entries as the plugin has currently only been tested by me (albeit successfully, without losing any dictionary entries)

## How the syncing works

There are two different ways this plugin syncs words

1. **MERGE**: Merge a local device dictionary into the plugin's global list. This always results in a equal-size or larger global dictionary that will be synced accross future devices.
2. **REPLACE**: Replace the local dictionary with the global list word-for-word. This may delete local entries. As a failsafe, if more than 5 local entries are to be deleted, you will get a popup offering a merge.

Every 15 seconds (todo: configurable period) the plugin checks for internal changes to the local dictionary (you added/removed words on your local device) and external changes to the global dictionary (you added/removed entries on another device).

- If there were external changes, we **REPLACE** the local dictionary with the global dictionary. If only external changes occured, we can trust them as it must mean it is the most recent copy of the global dictionary.
- If there were local changes, we **MERGE** the local dictionary with the global dictionary.
- If there were external AND local changes, we **REPLACE** the local dictionary with the global dictionary **BUT** if more than 5 local words are going to be deleted by this, the user gets a popup allowing them to choose merge or replacement.
