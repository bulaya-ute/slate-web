import { toast } from '../../components/ui/Toast'
import type { NoteMeta } from '../../lib/api/types'
import { useActiveEditor } from '../editor/activeEditorController'
import { nextAvailableName } from '../explorer/tree'
import { useTabs } from '../tabs/tabs.store'
import { useTheme, type ThemeOverride } from '../../stores/theme'
import { useSidebarControl } from '../workspace/sidebarControl'

export interface Command {
  id: string
  label: string
  /** Short trailing hint text (a keybinding, or a status note) — shown dim/right-aligned in the list. */
  hint?: string
  run: () => void
}

export interface CommandContext {
  vaultId: string | null
  /** Existing note titles at the vault root, for the "New note" default-name-collision check. */
  rootNoteNames: Set<string>
  createNote: (input: { path: string; content?: string }, onCreated: (created: NoteMeta) => void) => void
}

const THEME_ORDER: ThemeOverride[] = ['system', 'light', 'dark']

/**
 * The `Ctrl/Cmd+Shift+P` command list. A plain function (not a hook) so
 * it's trivially testable and so `CommandPalette` can rebuild it from
 * whatever context it already has via hooks, without this module
 * needing to know about React.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const commands: Command[] = []

  commands.push({
    id: 'new-note',
    label: 'New note',
    hint: 'Vault root',
    run: () => {
      if (!ctx.vaultId) return
      const name = nextAvailableName(ctx.rootNoteNames, 'Untitled')
      ctx.createNote({ path: `${name}.md`, content: '' }, (created) => {
        useTabs.getState().openTab(ctx.vaultId as string, { noteId: created.id, path: created.path, title: created.title })
      })
    },
  })

  commands.push({
    id: 'toggle-theme',
    label: 'Toggle theme',
    hint: 'System → Light → Dark',
    run: () => {
      const { override, setOverride } = useTheme.getState()
      setOverride(THEME_ORDER[(THEME_ORDER.indexOf(override) + 1) % THEME_ORDER.length])
    },
  })

  commands.push({
    id: 'toggle-preview',
    label: 'Toggle preview pane',
    run: () => {
      const controller = useActiveEditor.getState().controller
      if (controller) controller.togglePreview()
      else toast.info('No note open', 'Open a note to toggle its preview pane.')
    },
  })

  commands.push({
    id: 'open-graph',
    label: 'Open graph view',
    run: () => toast.info('Graph view is coming soon', 'The vault-wide graph view is planned for a later update.'),
  })

  commands.push({
    id: 'open-settings',
    label: 'Open settings',
    run: () => toast.info('Settings are coming soon', 'The settings screen is planned for a later update.'),
  })

  commands.push({
    id: 'open-vault-switcher',
    label: 'Open vault switcher',
    run: () => useSidebarControl.getState().expandSidebar?.(),
  })

  return commands
}
