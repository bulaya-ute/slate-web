/**
 * App-session singletons for the sync feature. One `AutosaveManager`
 * per browser tab, shared by every open note — that's what lets a
 * reconnect flush every note's queued save in one deterministic order
 * (see `offlineQueue.ts`), and lets `SyncProvider` and the editor agree
 * on save status without threading a manager instance through props.
 */
import { AutosaveManager } from './autosave'
import { getDeviceId } from './deviceId'
import { putNoteContent } from './notesSyncApi'

export const deviceId = getDeviceId()

export const autosaveManager = new AutosaveManager({
  deviceId,
  save: ({ noteId, content, baseRevId, deviceId: d }) =>
    putNoteContent(noteId, { content, baseRevId, deviceId: d }),
})
