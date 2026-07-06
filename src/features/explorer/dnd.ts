/** Native HTML5 drag-and-drop payload shared by tree rows and the root drop zone. */
export interface DragPayload {
  path: string
  kind: 'folder' | 'note'
}

const DRAG_MIME = 'application/x-slate-tree-node'

export function setDragPayload(e: React.DragEvent, payload: DragPayload): void {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

export function readDragPayload(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}
