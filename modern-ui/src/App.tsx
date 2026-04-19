import { startTransition, useEffect, useMemo, useState, type CSSProperties } from 'react'

type AccountRow = {
  username: string
  alias: string
  description: string
  group: string
  userId: number
  lastUse: string | null
  lastAttemptedRefresh: string | null
  hasPassword: boolean
  hasSecurityToken: boolean
  fields: Record<string, string>
}

type RecentGame = {
  placeId: number
  name: string
  filteredName: string
  imageUrl: string
}

type FavoriteGame = {
  name: string
  filteredName: string
  placeId: number
  privateServer: string
  imageUrl: string
}

type SearchGame = {
  placeId: number
  name: string
  filteredName: string
  creatorName: string
  playerCount: number
  likeRatio: number | null
  imageUrl: string
}

type ServerEntry = {
  id: string
  placeId: number
  playing: number
  maxPlayers: number
  ping: number
  fps: string
  name: string
  vipServerId: number
  accessCode: string
  type: string
  playerTokens: string[]
}

type OutfitEntry = {
  id: number
  name: string
  imageUrl: string
}

type AssetEntry = {
  assetId: number
  name: string
  description: string
  imageUrl: string
  priceInRobux: number
  isForSale: boolean
  productId: number
  creatorId: number
  creatorName: string
}

type ControlledAccountEntry = {
  username: string
  autoExecute: string
  placeId: string
  jobId: string
  relaunchDelay: number
  autoRelaunch: boolean
  isChecked: boolean
  clientCanReceive: boolean
  status: string
  lastPing: string | null
  inGameJobId: string
}

type NexusSettingsState = {
  allowExternalConnections: boolean
  nexusPort: number
  relaunchDelay: number
  launcherDelay: number
  startOnLaunch: boolean
  usePresence: boolean
}

type NexusServerState = {
  running: boolean
  host: string
  port: number
  connectedCount: number
  logEntries: Array<{
    at: string
    message: string
    details: unknown
  }>
}

type DynamicControlElement = {
  id: string
  kind: 'button' | 'textbox' | 'numeric' | 'label' | 'newline'
  name: string
  content?: string
  margin?: number[]
  size?: number[]
  decimalPlaces?: number
  increment?: number
}

type ViewKey =
  | 'Dashboard'
  | 'Accounts'
  | 'Avatar'
  | 'Missing Assets'
  | 'Control'
  | 'Server Browser'
  | 'Browser Actions'
  | 'Recent Games'
  | 'Utilities'
  | 'Settings'
  | 'Debug'
type EditorState = { alias: string; description: string; group: string }
type ThemeState = Record<string, string>

const navSections: Array<{ label: string; views: ViewKey[] }> = [
  { label: 'Operate', views: ['Dashboard', 'Accounts', 'Browser Actions', 'Server Browser'] },
  { label: 'Customize', views: ['Avatar', 'Missing Assets', 'Recent Games', 'Utilities'] },
  { label: 'Systems', views: ['Control', 'Settings', 'Debug'] },
]
const viewDescriptions: Record<ViewKey, string> = {
  Dashboard: 'Launch flow, live account scope, and the current operating surface.',
  Accounts: 'Real stored accounts, import paths, clipboard tools, and field editing.',
  Avatar: 'Outfit lookup, avatar JSON copy, and direct avatar application.',
  'Missing Assets': 'Asset inspection and purchase flow tied to the selected account.',
  Control: 'Executor control, Nexus links, relaunch settings, and transport state.',
  'Server Browser': 'Public server scanning, VIP saves, favorites, and direct join tools.',
  'Browser Actions': 'Logged-in Chromium actions, custom URLs, scripts, and browser launch modes.',
  'Recent Games': 'Saved places, favorites, and quick relaunch history.',
  Utilities: 'Account-level tools, diagnostics, follow privacy, logout, and cookie helpers.',
  Settings: 'Legacy settings, theme, web API, and local runtime behavior.',
  Debug: 'Renderer traces, action attempts, and backend instrumentation.',
}
const generalToggleSettings = [
  ['CheckForUpdates', 'Check for updates'],
  ['AsyncJoin', 'Async launching'],
  ['AutoCookieRefresh', 'Auto refresh cookies'],
  ['EnableMultiRbx', 'Enable multi Roblox'],
  ['ShowPresence', 'Show presence'],
  ['UnlockFPS', 'Unlock FPS'],
  ['SavePasswords', 'Save passwords'],
  ['DisableAgingAlert', 'Disable aging alert'],
  ['HideRbxAlert', 'Hide multi Roblox alert'],
  ['DisableImages', 'Disable images'],
  ['ShuffleChoosesLowestServer', 'Shuffle lowest server'],
  ['StartOnPCStartup', 'Run on Windows startup'],
] as const
const webserverToggleSettings = [
  ['EnableWebServer', 'Enable web server', 'Developer'],
  ['AllowGetCookie', 'Allow cookie reads', 'WebServer'],
  ['AllowGetAccounts', 'Allow account reads', 'WebServer'],
  ['AllowLaunchAccount', 'Allow launching', 'WebServer'],
  ['AllowAccountEditing', 'Allow account edits', 'WebServer'],
  ['AllowExternalConnections', 'Allow external connections', 'WebServer'],
  ['EveryRequestRequiresPassword', 'Require password', 'WebServer'],
] as const
const themeColorSettings = [
  ['FormsBG', 'App background'],
  ['FormsFG', 'App text'],
  ['AccountsBG', 'Panel fill'],
  ['AccountsFG', 'Panel text'],
  ['ButtonsBG', 'Button fill'],
  ['ButtonsFG', 'Button text'],
  ['ButtonsBC', 'Button border'],
  ['TextBoxesBG', 'Input fill'],
  ['TextBoxesFG', 'Input text'],
  ['TextBoxesBC', 'Input border'],
  ['LabelsBC', 'Label surface'],
  ['LabelsFC', 'Label text'],
] as const
const themeToggleSettings = [
  ['DarkTopBar', 'Dark navigation rail'],
  ['ShowHeaders', 'Show section kickers'],
  ['LabelsTransparent', 'Transparent labels'],
  ['LightImages', 'Brighten loaded images'],
] as const
const themeSelectSettings = [
  ['ButtonStyle', ['Flat', 'Standard']],
] as const
const emptyEditor = { alias: '', description: '', group: 'Default' }

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>('Dashboard')
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [recentGames, setRecentGames] = useState<RecentGame[]>([])
  const [favoriteGames, setFavoriteGames] = useState<FavoriteGame[]>([])
  const [searchGames, setSearchGames] = useState<SearchGame[]>([])
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [outfits, setOutfits] = useState<OutfitEntry[]>([])
  const [assets, setAssets] = useState<AssetEntry[]>([])
  const [controlledAccounts, setControlledAccounts] = useState<ControlledAccountEntry[]>([])
  const [dynamicElements, setDynamicElements] = useState<DynamicControlElement[]>([])
  const [settings, setSettings] = useState<Record<string, Record<string, string>>>({})
  const [theme, setTheme] = useState<ThemeState>({})
  const [nexusSettings, setNexusSettings] = useState<NexusSettingsState>({
    allowExternalConnections: false,
    nexusPort: 5242,
    relaunchDelay: 60,
    launcherDelay: 9,
    startOnLaunch: false,
    usePresence: false,
  })
  const [nexusServer, setNexusServer] = useState<NexusServerState>({
    running: false,
    host: '127.0.0.1',
    port: 5242,
    connectedCount: 0,
    logEntries: [],
  })
  const [accountSource, setAccountSource] = useState('missing')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [toast, setToast] = useState('Loading Roblox Account Manager data...')
  const [accountsLocked, setAccountsLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')

  const [placeId, setPlaceId] = useState('')
  const [jobId, setJobId] = useState('')
  const [followUser, setFollowUser] = useState(false)
  const [followUserId, setFollowUserId] = useState('')
  const [joinVip, setJoinVip] = useState(false)
  const [useOldJoin, setUseOldJoin] = useState(false)
  const [isTeleport, setIsTeleport] = useState(false)
  const [currentVersionOverride, setCurrentVersionOverride] = useState('')
  const [browserTarget, setBrowserTarget] = useState('https://www.roblox.com/home')
  const [browserScript, setBrowserScript] = useState('')
  const [browserMode, setBrowserMode] = useState<'standard' | 'groupJoin'>('standard')
  const [gameSearchTerm, setGameSearchTerm] = useState('')
  const [gameSearchPage, setGameSearchPage] = useState('0')
  const [serverLookupUsername, setServerLookupUsername] = useState('')
  const [avatarUsername, setAvatarUsername] = useState('')
  const [avatarJsonInput, setAvatarJsonInput] = useState('')
  const [assetInput, setAssetInput] = useState('')
  const [controlCommandName, setControlCommandName] = useState('Command')
  const [controlCommandPayload, setControlCommandPayload] = useState('')
  const [controlScript, setControlScript] = useState('')
  const [nexusLoaderScript, setNexusLoaderScript] = useState('')

  const [editor, setEditor] = useState<EditorState>(emptyEditor)
  const [fieldName, setFieldName] = useState('')
  const [fieldValue, setFieldValue] = useState('')
  const [cookieInput, setCookieInput] = useState('')
  const [cookiePassword, setCookiePassword] = useState('')
  const [bulkCookieInput, setBulkCookieInput] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [debugEntries, setDebugEntries] = useState<string[]>([])
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [friendUsername, setFriendUsername] = useState('')
  const [blockUsername, setBlockUsername] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [quickLoginCode, setQuickLoginCode] = useState('')
  const [followPrivacy, setFollowPrivacy] = useState('0')
  const [utilityOutput, setUtilityOutput] = useState('')
  const [showAccountGroups, setShowAccountGroups] = useState(true)

  const selectedRows = useMemo(
    () => accounts.filter((account) => selectedAccounts.includes(account.username)),
    [accounts, selectedAccounts],
  )
  const primaryAccount = selectedRows[0] ?? null
  const selectedControlledAccounts = controlledAccounts.filter((entry) => entry.isChecked)
  const general = settings.General ?? {}
  const developer = settings.Developer ?? {}
  const webServer = settings.WebServer ?? {}
  const bridge = typeof window !== 'undefined' ? window.desktopBridge : undefined
  const activeViewDescription = viewDescriptions[activeView]
  const themeStyle = useMemo(
    () =>
      ({
        '--theme-accounts-bg': theme.AccountsBG ?? '#162033',
        '--theme-accounts-fg': theme.AccountsFG ?? '#F8FAFC',
        '--theme-buttons-bg': theme.ButtonsBG ?? '#1D2B44',
        '--theme-buttons-fg': theme.ButtonsFG ?? '#F8FAFC',
        '--theme-buttons-bc': theme.ButtonsBC ?? '#4F6B95',
        '--theme-forms-bg': theme.FormsBG ?? '#0B1220',
        '--theme-forms-fg': theme.FormsFG ?? '#F8FAFC',
        '--theme-textboxes-bg': theme.TextBoxesBG ?? '#111A2B',
        '--theme-textboxes-fg': theme.TextBoxesFG ?? '#F8FAFC',
        '--theme-textboxes-bc': theme.TextBoxesBC ?? '#38506F',
        '--theme-labels-bc': theme.LabelsBC ?? '#162033',
        '--theme-labels-fc': theme.LabelsFC ?? '#D6E2F3',
      }) as CSSProperties,
    [theme],
  )
  const showHeaders = String(theme.ShowHeaders ?? 'True').toLowerCase() !== 'false'
  const labelsTransparent = String(theme.LabelsTransparent ?? 'True').toLowerCase() === 'true'
  const lightImages = String(theme.LightImages ?? 'True').toLowerCase() === 'true'
  const darkTopBar = String(theme.DarkTopBar ?? 'True').toLowerCase() !== 'false'
  const buttonStyle = String(theme.ButtonStyle ?? 'Flat')

  function addDebug(message: string, details?: unknown) {
    const line = `${new Date().toLocaleTimeString()} ${message}${details !== undefined ? ` ${JSON.stringify(details)}` : ''}`
    setDebugEntries((current) => [line, ...current].slice(0, 18))
    if (bridge) {
      void bridge.debugLog({ scope: 'ui', message, details }).catch(() => {})
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      addDebug('pointerdown', {
        tag: target?.tagName ?? 'unknown',
        className: target?.className ?? '',
        text: target?.textContent?.trim()?.slice(0, 48) ?? '',
      })
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  useEffect(() => {
    if (!primaryAccount) {
      setEditor(emptyEditor)
      return
    }

    setEditor({
      alias: primaryAccount.alias,
      description: primaryAccount.description,
      group: primaryAccount.group || 'Default',
    })
  }, [primaryAccount])

  useEffect(() => {
    if (activeView !== 'Control' || !bridge) return

    void loadControlState()
    if (!nexusLoaderScript) {
      void loadNexusHelper()
    }
    const timer = window.setInterval(() => {
      void loadControlState()
    }, 2000)

    return () => window.clearInterval(timer)
  }, [activeView, bridge, nexusLoaderScript])

  async function loadState() {
    addDebug('loadState.start', { hasBridge: Boolean(bridge) })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const state = await bridge.loadState()
      addDebug('loadState.success', { accountCount: state.accounts.length, locked: state.accountsLocked })
      applyLoadedState(state)
      const controlState = await bridge.loadControlState()
      applyControlState(controlState)
      setToast(
        state.accountsLocked
          ? 'Account data is password-locked. Enter the password to load your real accounts.'
          : `Loaded ${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'} from ${state.accountSource}.`,
      )
    } catch (error) {
      addDebug('loadState.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to load local state.')
    } finally {
      setLoading(false)
    }
  }

  function applyLoadedState(state: {
    accounts: AccountRow[]
    accountsLocked: boolean
    accountSource: string
    settings: Record<string, Record<string, string>>
    theme: ThemeState
    recentGames: RecentGame[]
    favoriteGames: FavoriteGame[]
  }) {
    setAccounts(state.accounts)
    setRecentGames(state.recentGames)
    setFavoriteGames(state.favoriteGames)
    setSettings(state.settings)
    setTheme(state.theme)
    setAccountsLocked(state.accountsLocked)
    setAccountSource(state.accountSource)

    startTransition(() => {
      setSelectedAccounts((current) => {
        const existing = current.filter((name) => state.accounts.some((account) => account.username === name))
        return existing.length > 0 ? existing : state.accounts.slice(0, 1).map((account) => account.username)
      })
    })

    if (!placeId) {
      setPlaceId(String(state.recentGames[0]?.placeId ?? state.settings.General?.SavedPlaceId ?? ''))
    }

    if (!followUserId) {
      setFollowUserId(String(state.settings.General?.SavedFollowUser ?? ''))
    }

    if (!avatarUsername && state.accounts[0]?.username) {
      setAvatarUsername(state.accounts[0].username)
    }
  }

  function applyControlState(state: {
    controlledAccounts: ControlledAccountEntry[]
    nexusSettings: NexusSettingsState
    server: NexusServerState
    dynamicElements: DynamicControlElement[]
  }) {
    setControlledAccounts(state.controlledAccounts)
    setNexusSettings(state.nexusSettings)
    setNexusServer(state.server)
    setDynamicElements(state.dynamicElements)
  }

  async function unlockAccounts() {
    addDebug('unlockAccounts.click')
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!password.trim()) {
      setToast('Enter the account password first.')
      return
    }

    setPasswordBusy(true)
    try {
      const result = await bridge.unlockAccounts(password)
      addDebug('unlockAccounts.success', { accountCount: result.accounts.length, locked: result.accountsLocked })
      setAccounts(result.accounts)
      setAccountsLocked(result.accountsLocked)
      setAccountSource(result.accountSource)
      setSelectedAccounts(result.accounts.slice(0, 1).map((account) => account.username))
      setToast(
        result.accountsLocked
          ? 'Password was rejected. Try again.'
          : `Unlocked ${result.accounts.length} account${result.accounts.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      addDebug('unlockAccounts.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to unlock accounts.')
    } finally {
      setPasswordBusy(false)
    }
  }

  async function runBusyTask<T>(key: string, task: () => Promise<T>) {
    setBusyKey(key)
    try {
      return await task()
    } finally {
      setBusyKey('')
    }
  }

  function isBusy(key: string) {
    return busyKey === key
  }

  function applyAccountMutation(result: { accounts: AccountRow[]; accountSource: string }) {
    setAccounts(result.accounts)
    setAccountSource(result.accountSource)
    setSelectedAccounts((current) => {
      const filtered = current.filter((name) => result.accounts.some((account) => account.username === name))
      return filtered.length > 0 ? filtered : result.accounts.slice(0, 1).map((account) => account.username)
    })
  }

  function toggleAccount(name: string) {
    setSelectedAccounts((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    )
  }

  async function persistSetting(section: string, key: string, value: string | boolean | number, label: string) {
    addDebug('persistSetting.click', { section, key, value })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const next = await bridge.saveSetting({ section, key, value })
      addDebug('persistSetting.success', { section, key })
      setSettings(next)
      setToast(`${label} saved.`)
    } catch (error) {
      addDebug('persistSetting.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to save setting.')
    }
  }

  function applyLocalSetting(section: string, key: string, value: string) {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...(current[section] ?? {}),
        [key]: value,
      },
    }))
  }

  async function pickCustomClientSettings() {
    addDebug('pickCustomClientSettings.click')
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await bridge.pickCustomClientSettings()
      setSettings(result.settings)
      setToast(result.message)
    } catch (error) {
      addDebug('pickCustomClientSettings.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to select custom client settings.')
    }
  }

  async function clearCustomClientSettings() {
    addDebug('clearCustomClientSettings.click')
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await bridge.clearCustomClientSettings()
      setSettings(result.settings)
      setToast(result.message)
    } catch (error) {
      addDebug('clearCustomClientSettings.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to clear custom client settings.')
    }
  }

  async function openReleasePage() {
    addDebug('openReleasePage.click')
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await bridge.openReleasePage()
      setToast(result.message)
    } catch (error) {
      addDebug('openReleasePage.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to open the release page.')
    }
  }

  async function saveThemePatch(patch: Record<string, string>, label: string) {
    addDebug('saveThemePatch.click', { label, patch })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const next = await bridge.saveTheme({
        ...theme,
        ...patch,
      })
      setTheme(next)
      setToast(`${label} saved.`)
    } catch (error) {
      addDebug('saveThemePatch.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to save theme.')
    }
  }

  async function saveAccountDetails() {
    addDebug('saveAccountDetails.click', { username: primaryAccount?.username })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first.')
      return
    }

    try {
      const result = await runBusyTask('save-account', () =>
        bridge.updateAccount({
          username: primaryAccount.username,
          alias: editor.alias,
          description: editor.description,
          group: editor.group,
        }),
      )
      applyAccountMutation(result)
      setToast(`Saved details for ${primaryAccount.username}.`)
    } catch (error) {
      addDebug('saveAccountDetails.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to save account details.')
    }
  }

  async function saveField() {
    addDebug('saveField.click', { username: primaryAccount?.username, fieldName })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first.')
      return
    }

    if (!fieldName.trim()) {
      setToast('Enter a field name first.')
      return
    }

    try {
      const result = await runBusyTask('save-field', () =>
        bridge.setAccountField({
          username: primaryAccount.username,
          field: fieldName.trim(),
          value: fieldValue,
        }),
      )
      applyAccountMutation(result)
      setFieldName('')
      setFieldValue('')
      setToast(`Saved field on ${primaryAccount.username}.`)
    } catch (error) {
      addDebug('saveField.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to save field.')
    }
  }

  async function removeField(field: string) {
    addDebug('removeField.click', { username: primaryAccount?.username, field })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first.')
      return
    }

    try {
      const result = await runBusyTask(`remove-field-${field}`, () =>
        bridge.removeAccountField({
          username: primaryAccount.username,
          field,
        }),
      )
      applyAccountMutation(result)
      setToast(`Removed field ${field}.`)
    } catch (error) {
      addDebug('removeField.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to remove field.')
    }
  }

  async function removeSelectedAccounts() {
    addDebug('removeSelectedAccounts.click', { count: selectedAccounts.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedAccounts.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    try {
      const result = await runBusyTask('remove-accounts', () => bridge.removeAccounts(selectedAccounts))
      applyAccountMutation(result)
      setToast(`Removed ${selectedAccounts.length} account${selectedAccounts.length === 1 ? '' : 's'}.`)
    } catch (error) {
      addDebug('removeSelectedAccounts.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to remove accounts.')
    }
  }

  async function sortAccountsAlphabetically() {
    addDebug('sortAccounts.click', { count: accounts.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await runBusyTask('sort-accounts', () => bridge.sortAccounts())
      applyAccountMutation(result)
      setToast('Accounts sorted alphabetically.')
    } catch (error) {
      addDebug('sortAccounts.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to sort accounts.')
    }
  }

  async function saveLaunchPreset(clear = false) {
    addDebug('saveLaunchPreset.click', { clear, count: selectedRows.length, placeId, jobId })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    try {
      const result = await runBusyTask(clear ? 'clear-saved-launch' : 'save-saved-launch', () =>
        bridge.saveLaunchForAccounts({
          usernames: selectedRows.map((row) => row.username),
          placeId,
          jobId,
          clear,
        }),
      )
      applyAccountMutation(result)
      setToast(clear ? 'Cleared saved launch fields for selected accounts.' : 'Saved launch fields to selected accounts.')
    } catch (error) {
      addDebug('saveLaunchPreset.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to save launch preset.')
    }
  }

  async function copyAccountData(
    kind: 'username' | 'password' | 'combo' | 'userId' | 'securityToken' | 'profile' | 'group' | 'authTicket',
  ) {
    addDebug('copyAccountData.click', { kind, count: selectedRows.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    try {
      const result = await runBusyTask(`copy-${kind}`, () =>
        bridge.copyAccountData({
          usernames: selectedRows.map((row) => row.username),
          kind,
        }),
      )
      setToast(result.message)
    } catch (error) {
      addDebug('copyAccountData.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to copy account data.')
    }
  }

  async function dumpSelectedAccounts() {
    addDebug('dumpSelectedAccounts.click', { count: selectedRows.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    try {
      const result = await runBusyTask('dump-accounts', () =>
        bridge.dumpAccountDetails({
          usernames: selectedRows.map((row) => row.username),
        }),
      )
      setToast(result.message)
    } catch (error) {
      addDebug('dumpSelectedAccounts.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to export account dumps.')
    }
  }

  async function importCookieAccount() {
    addDebug('importCookieAccount.click', { hasCookie: Boolean(cookieInput.trim()) })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!cookieInput.trim()) {
      setToast('Paste a .ROBLOSECURITY cookie first.')
      return
    }

    try {
      const result = await runBusyTask('import-cookie', () =>
        bridge.importCookie({
          cookie: cookieInput.trim(),
          password: cookiePassword,
        }),
      )
      applyAccountMutation(result)
      setCookieInput('')
      setCookiePassword('')
      setToast('Cookie imported successfully.')
    } catch (error) {
      addDebug('importCookieAccount.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to import cookie.')
    }
  }

  async function importBulkCookies() {
    addDebug('importBulkCookies.click', { count: bulkCookieInput.split(/\r?\n/).filter((line) => line.trim()).length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    const cookies = bulkCookieInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (cookies.length === 0) {
      setToast('Paste one cookie per line first.')
      return
    }

    try {
      const result = await runBusyTask('import-cookie-bulk', () =>
        bridge.importCookiesBulk({
          cookies,
          password: cookiePassword,
        }),
      )
      setBulkCookieInput('')
      setAccounts(result.accounts)
      setAccountSource(result.accountSource)
      const addedCount = result.results.filter((entry) => entry.ok).length
      const failedCount = result.results.length - addedCount
      setToast(`Bulk import finished. Added ${addedCount}, failed ${failedCount}.`)
      setUtilityOutput(JSON.stringify(result.results, null, 2))
    } catch (error) {
      addDebug('importBulkCookies.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to bulk import cookies.')
    }
  }

  async function startAccountLogin(mode: 'browser' | 'credentials') {
    addDebug('startAccountLogin.click', { mode, hasUsername: Boolean(loginUsername), hasPassword: Boolean(loginPassword) })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (mode === 'credentials' && (!loginUsername.trim() || !loginPassword)) {
      setToast('Enter both username and password first.')
      return
    }

    try {
      const result = await runBusyTask(`login-${mode}`, () =>
        bridge.startAccountLogin({
          mode,
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      )
      addDebug('startAccountLogin.result', result)
      setToast(result.message)
      await loadState()
    } catch (error) {
      addDebug('startAccountLogin.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to start account login flow.')
    }
  }

  async function launchSelected(nextPlaceId?: number | string) {
    addDebug('launchSelected.click', { placeId: nextPlaceId ?? placeId, count: selectedRows.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    const targetPlaceId = String(nextPlaceId ?? placeId).trim()
    if (!followUser && !targetPlaceId) {
      setToast('Enter a place ID first.')
      return
    }

    if (followUser && !followUserId.trim()) {
      setToast('Enter the user ID to follow first.')
      return
    }

    try {
      const result = await runBusyTask('launch', () =>
        bridge.performAction({
          type: 'launch',
          accounts: selectedRows.map((row) => row.username),
          placeId: targetPlaceId,
          jobId,
          followUser,
          followUserId,
          joinVip,
          useOldJoin,
          isTeleport,
          currentVersion: currentVersionOverride.trim(),
        }),
      )
      if (!result.ok) {
        throw new Error(result.message)
      }
      setToast(result.message)
    } catch (error) {
      addDebug('launchSelected.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to launch selected accounts.')
    }
  }

  async function runBrowserFlow() {
    addDebug('runBrowserFlow.click', { count: selectedRows.length, url: browserTarget, browserMode })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    const targetUrl = browserTarget.trim()
    if (!targetUrl) {
      setToast('Enter a browser URL first.')
      return
    }

    try {
      const result = await runBusyTask('browser', () =>
        bridge.performAction({
          type: 'browser',
          accounts: selectedRows.map((row) => row.username),
          url: targetUrl,
          script: browserScript,
          browserMode,
        }),
      )
      if (!result.ok) {
        throw new Error(result.message)
      }
      setToast(result.message)
    } catch (error) {
      addDebug('runBrowserFlow.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to open browser windows.')
    }
  }

  async function copyLaunchLink(type: 'copy-player-link' | 'copy-app-link') {
    addDebug('copyLaunchLink.click', { type, count: selectedRows.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    if (type === 'copy-player-link' && followUser && !followUserId.trim()) {
      setToast('Enter the user ID to follow first.')
      return
    }

    if (type === 'copy-player-link' && !followUser && !String(placeId).trim()) {
      setToast('Enter a place ID first.')
      return
    }

    try {
      const result = await runBusyTask(type, () =>
        bridge.performAction({
          type,
          accounts: [selectedRows[0].username],
          placeId,
          jobId,
          followUser,
          followUserId,
          joinVip,
          useOldJoin,
          isTeleport,
          currentVersion: currentVersionOverride.trim(),
        }),
      )
      if (!result.ok) {
        throw new Error(result.message)
      }
      setToast(result.message)
    } catch (error) {
      addDebug('copyLaunchLink.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to copy launch link.')
    }
  }

  async function runAccountTool(
    action:
      | 'get_cookie'
      | 'get_csrf'
      | 'send_friend_request'
      | 'set_display_name'
      | 'set_follow_privacy'
      | 'unlock_pin'
      | 'logout_other_sessions'
      | 'toggle_block'
      | 'get_blocked_list'
      | 'quick_login',
    value?: string,
  ) {
    addDebug('accountTool.click', { action, value, username: primaryAccount?.username })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first.')
      return
    }

    try {
      const result = await runBusyTask(`tool-${action}`, () =>
        bridge.accountTool({
          username: primaryAccount.username,
          action,
          value,
        }),
      )
      setToast(result.message)
      setUtilityOutput(result.data ? JSON.stringify(result.data, null, 2) : result.message)
      if (action === 'logout_other_sessions') {
        await loadState()
      }
    } catch (error) {
      addDebug('accountTool.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to run account tool.')
    }
  }

  async function loadDiagnostics() {
    addDebug('diagnostics.click', { username: primaryAccount?.username })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first.')
      return
    }

    try {
      const result = await runBusyTask('diagnostics', () =>
        bridge.getAccountDiagnostics({ username: primaryAccount.username }),
      )
      setToast(result.message)
      setUtilityOutput(result.data ? JSON.stringify(result.data, null, 2) : result.message)
    } catch (error) {
      addDebug('diagnostics.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to load diagnostics.')
    }
  }

  async function searchGameCatalog() {
    addDebug('searchGameCatalog.click', { query: gameSearchTerm, page: gameSearchPage })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!gameSearchTerm.trim()) {
      setSearchGames([])
      setToast('Enter a game name or keyword first.')
      return
    }

    try {
      const result = await runBusyTask('search-games', () =>
        bridge.searchGames({
          query: gameSearchTerm.trim(),
          page: Number.parseInt(gameSearchPage || '0', 10) || 0,
        }),
      )
      setSearchGames(result.games)
      setToast(`Loaded ${result.games.length} game result${result.games.length === 1 ? '' : 's'}.`)
    } catch (error) {
      addDebug('searchGameCatalog.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to search games.')
    }
  }

  async function refreshServers() {
    addDebug('refreshServers.click', { placeId })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!String(placeId).trim()) {
      setToast('Enter a place ID first.')
      return
    }

    try {
      const result = await runBusyTask('load-servers', () =>
        bridge.getServers({
          placeId,
          includeVip: true,
        }),
      )
      setServers(result.servers)
      setToast(`Loaded ${result.servers.length} server${result.servers.length === 1 ? '' : 's'} for place ${placeId}.`)
    } catch (error) {
      addDebug('refreshServers.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to load live servers.')
    }
  }

  async function locatePlayerServer() {
    addDebug('locatePlayerServer.click', { placeId, username: serverLookupUsername })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!String(placeId).trim()) {
      setToast('Enter a place ID first.')
      return
    }

    if (!serverLookupUsername.trim()) {
      setToast('Enter a username to search for.')
      return
    }

    try {
      const result = await runBusyTask('find-player-server', () =>
        bridge.findPlayerServer({
          placeId,
          username: serverLookupUsername.trim(),
        }),
      )
      if (!result.server) {
        setToast(`${serverLookupUsername.trim()} was not found in the scanned public servers.`)
        return
      }
      setServers([result.server])
      setToast(`Found ${serverLookupUsername.trim()} in a ${result.server.type.toLowerCase()} server.`)
    } catch (error) {
      addDebug('locatePlayerServer.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to search for that player.')
    }
  }

  async function addFavoriteGame(game: { name: string; filteredName?: string; placeId: number; imageUrl?: string }, privateServer = '') {
    addDebug('addFavoriteGame.click', { placeId: game.placeId, privateServer })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await runBusyTask(`favorite-add-${game.placeId}-${privateServer}`, () =>
        bridge.addFavoriteGame({
          name: game.name,
          placeId: game.placeId,
          privateServer,
          imageUrl: game.imageUrl,
        }),
      )
      setFavoriteGames(result.favoriteGames)
      setToast(`${game.filteredName || game.name} was added to favorites.`)
    } catch (error) {
      addDebug('addFavoriteGame.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to add favorite.')
    }
  }

  async function renameFavoriteGame(favorite: FavoriteGame) {
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    const name = window.prompt('Rename favorite game', favorite.name)?.trim()
    if (!name) return

    try {
      const result = await runBusyTask(`favorite-rename-${favorite.placeId}-${favorite.privateServer}`, () =>
        bridge.renameFavoriteGame({
          placeId: favorite.placeId,
          privateServer: favorite.privateServer,
          name,
        }),
      )
      setFavoriteGames(result.favoriteGames)
      setToast(`Renamed favorite to ${name}.`)
    } catch (error) {
      addDebug('renameFavoriteGame.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to rename favorite.')
    }
  }

  async function removeFavoriteGame(favorite: FavoriteGame) {
    addDebug('removeFavoriteGame.click', { placeId: favorite.placeId, privateServer: favorite.privateServer })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await runBusyTask(`favorite-remove-${favorite.placeId}-${favorite.privateServer}`, () =>
        bridge.removeFavoriteGame({
          placeId: favorite.placeId,
          privateServer: favorite.privateServer,
        }),
      )
      setFavoriteGames(result.favoriteGames)
      setToast(`Removed ${favorite.filteredName || favorite.name} from favorites.`)
    } catch (error) {
      addDebug('removeFavoriteGame.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to remove favorite.')
    }
  }

  async function launchServer(server: ServerEntry) {
    const targetPlaceId = String(server.placeId || placeId).trim()
    addDebug('launchServer.click', { serverId: server.id, type: server.type, placeId: targetPlaceId })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    if (!targetPlaceId) {
      setToast('Enter a place ID first.')
      return
    }

    try {
      const result = await runBusyTask(`launch-server-${server.id}`, () =>
        bridge.performAction({
          type: 'launch',
          accounts: selectedRows.map((row) => row.username),
          placeId: targetPlaceId,
          jobId: server.type === 'VIP' ? server.accessCode || server.id : server.id,
          followUser: false,
          joinVip: server.type === 'VIP',
        }),
      )
      if (!result.ok) {
        throw new Error(result.message)
      }
      setPlaceId(targetPlaceId)
      setToast(result.message)
    } catch (error) {
      addDebug('launchServer.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to join the selected server.')
    }
  }

  async function loadOutfits() {
    addDebug('loadOutfits.click', { avatarUsername })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!avatarUsername.trim()) {
      setToast('Enter a Roblox username first.')
      return
    }

    try {
      const result = await runBusyTask('avatar-load', () => bridge.getOutfits({ username: avatarUsername.trim() }))
      setOutfits(result.items)
      setToast(
        result.items.length === 0
          ? `No outfits were found for ${avatarUsername.trim()}.`
          : `Loaded ${result.items.length} outfit${result.items.length === 1 ? '' : 's'} for ${avatarUsername.trim()}.`,
      )
    } catch (error) {
      addDebug('loadOutfits.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to load outfits.')
    }
  }

  async function copyOutfitJson(outfit: OutfitEntry) {
    addDebug('copyOutfitJson.click', { outfitId: outfit.id })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await runBusyTask(`outfit-json-${outfit.id}`, () => bridge.getOutfitDetails({ outfitId: outfit.id }))
      setAvatarJsonInput(result.json)
      await bridge.copyText({ text: result.json, label: 'avatar JSON' })
      setToast(`Copied avatar JSON for ${outfit.name}.`)
    } catch (error) {
      addDebug('copyOutfitJson.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to copy outfit JSON.')
    }
  }

  async function wearAvatarJson() {
    addDebug('wearAvatarJson.click', { username: primaryAccount?.username, length: avatarJsonInput.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first.')
      return
    }

    if (!avatarJsonInput.trim()) {
      setToast('Paste avatar JSON first.')
      return
    }

    try {
      const result = await runBusyTask('wear-avatar-json', () =>
        bridge.wearAvatarJson({
          username: primaryAccount.username,
          json: avatarJsonInput,
        }),
      )
      setToast(
        result.invalidAssetIds && result.invalidAssetIds.length > 0
          ? `${result.message} Missing assets: ${result.invalidAssetIds.join(', ')}`
          : result.message,
      )
    } catch (error) {
      addDebug('wearAvatarJson.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to wear avatar JSON.')
    }
  }

  async function copyText(text: string, label: string) {
    addDebug('copyText.click', { label })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await bridge.copyText({ text, label })
      setToast(result.message)
    } catch (error) {
      addDebug('copyText.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : `Failed to copy ${label}.`)
    }
  }

  async function wearOutfit(outfit: OutfitEntry) {
    addDebug('wearOutfit.click', { outfitId: outfit.id, username: primaryAccount?.username })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first. Wearing an outfit uses the primary selected account.')
      return
    }

    try {
      const result = await runBusyTask(`wear-outfit-${outfit.id}`, () =>
        bridge.wearOutfit({ username: primaryAccount.username, outfitId: outfit.id }),
      )
      setToast(
        result.invalidAssetIds && result.invalidAssetIds.length > 0
          ? `${result.message} Missing assets: ${result.invalidAssetIds.join(', ')}`
          : result.message,
      )
    } catch (error) {
      addDebug('wearOutfit.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to wear that outfit.')
    }
  }

  async function addAssetCard() {
    addDebug('addAssetCard.click', { assetInput })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!assetInput.trim()) {
      setToast('Enter an asset ID first.')
      return
    }

    try {
      const result = await runBusyTask(`asset-load-${assetInput}`, () => bridge.getAssetDetails({ assetId: assetInput.trim() }))
      setAssets((current) => {
        const next = current.filter((entry) => entry.assetId !== result.asset.assetId)
        return [result.asset, ...next]
      })
      setAssetInput('')
      setToast(`Loaded asset ${result.asset.name}.`)
    } catch (error) {
      addDebug('addAssetCard.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to load asset details.')
    }
  }

  async function purchaseAsset(asset: AssetEntry) {
    addDebug('purchaseAsset.click', { assetId: asset.assetId, username: primaryAccount?.username })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!primaryAccount) {
      setToast('Select an account first. Purchasing requires the primary selected account.')
      return
    }

    try {
      const result = await runBusyTask(`purchase-${asset.assetId}`, () =>
        bridge.purchaseAsset({ username: primaryAccount.username, assetId: asset.assetId }),
      )
      setToast(result.message)
    } catch (error) {
      addDebug('purchaseAsset.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to purchase that asset.')
    }
  }

  async function loadControlState() {
    if (!bridge) return

    try {
      const result = await bridge.loadControlState()
      applyControlState(result)
    } catch (error) {
      addDebug('loadControlState.error', error instanceof Error ? error.message : String(error))
    }
  }

  async function loadNexusHelper() {
    if (!bridge) return

    try {
      const result = await bridge.getNexusLoader()
      setNexusLoaderScript(result.script)
    } catch (error) {
      addDebug('loadNexusHelper.error', error instanceof Error ? error.message : String(error))
    }
  }

  async function writeNexusLoader() {
    addDebug('writeNexusLoader.click')
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await bridge.writeNexusLoader()
      setToast(result.message)
    } catch (error) {
      addDebug('writeNexusLoader.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to write Nexus loader.')
    }
  }

  async function linkSelectedAccounts() {
    addDebug('linkSelectedAccounts.click', { count: selectedRows.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedRows.length === 0) {
      setToast('Select at least one account first.')
      return
    }

    try {
      const result = await runBusyTask('control-link', () =>
        bridge.addControlledAccounts({ usernames: selectedRows.map((row) => row.username) }),
      )
      applyControlState(result)
      setToast(result.message)
    } catch (error) {
      addDebug('linkSelectedAccounts.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to link controlled accounts.')
    }
  }

  async function removeControlledSelection() {
    addDebug('removeControlledSelection.click', { count: selectedControlledAccounts.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedControlledAccounts.length === 0) {
      setToast('Check at least one controlled account first.')
      return
    }

    try {
      const result = await runBusyTask('control-remove', () =>
        bridge.removeControlledAccounts({ usernames: selectedControlledAccounts.map((entry) => entry.username) }),
      )
      applyControlState(result)
      setToast(result.message)
    } catch (error) {
      addDebug('removeControlledSelection.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to remove controlled accounts.')
    }
  }

  async function updateControlledAccount(username: string, patch: Partial<ControlledAccountEntry>) {
    if (!bridge) return

    try {
      const result = await bridge.updateControlledAccount({ username, ...patch })
      applyControlState(result)
    } catch (error) {
      addDebug('updateControlledAccount.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to save controlled account settings.')
    }
  }

  async function saveNexusSetting(key: string, value: string | number | boolean, label: string) {
    addDebug('saveNexusSetting.click', { key, value })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = await bridge.saveAccountControlSetting({ key, value })
      applyControlState(result)
      setToast(`${label} saved.`)
    } catch (error) {
      addDebug('saveNexusSetting.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : `Failed to save ${label}.`)
    }
  }

  async function toggleNexusServer() {
    addDebug('toggleNexusServer.click', { running: nexusServer.running })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    try {
      const result = nexusServer.running ? await bridge.stopNexusServer() : await bridge.startNexusServer()
      setNexusServer(result.server)
      setToast(result.message)
      await loadControlState()
    } catch (error) {
      addDebug('toggleNexusServer.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to toggle Nexus server.')
    }
  }

  async function sendControlCommand() {
    addDebug('sendControlCommand.click', { name: controlCommandName, count: selectedControlledAccounts.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!controlCommandName.trim()) {
      setToast('Enter a command name first.')
      return
    }

    try {
      const payload = controlCommandPayload.trim() ? { value: controlCommandPayload.trim() } : undefined
      const result = await runBusyTask('control-command', () =>
        bridge.sendControlCommand({
          usernames: selectedControlledAccounts.map((entry) => entry.username),
          name: controlCommandName.trim(),
          payload,
        }),
      )
      setToast(result.message)
      await loadControlState()
    } catch (error) {
      addDebug('sendControlCommand.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to send command.')
    }
  }

  async function sendControlScript() {
    addDebug('sendControlScript.click', { count: selectedControlledAccounts.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (!controlScript.trim()) {
      setToast('Enter a script first.')
      return
    }

    try {
      const result = await runBusyTask('control-script', () =>
        bridge.sendControlScript({
          usernames: selectedControlledAccounts.map((entry) => entry.username),
          script: controlScript,
        }),
      )
      setToast(result.message)
    } catch (error) {
      addDebug('sendControlScript.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to send script.')
    }
  }

  async function updateDynamicElement(name: string, content: string) {
    if (!bridge) return

    try {
      const result = await bridge.updateDynamicControl({ name, content })
      applyControlState(result)
    } catch (error) {
      addDebug('updateDynamicElement.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to update custom control.')
    }
  }

  async function triggerDynamicButton(name: string) {
    addDebug('triggerDynamicButton.click', { name, count: selectedControlledAccounts.length })
    if (!bridge) {
      setToast('Desktop bridge is unavailable. Start this app through Electron, not a normal browser tab.')
      return
    }

    if (selectedControlledAccounts.length === 0) {
      setToast('Check at least one controlled account first.')
      return
    }

    try {
      const result = await runBusyTask(`dynamic-button-${name}`, () =>
        bridge.triggerDynamicButton({
          usernames: selectedControlledAccounts.map((entry) => entry.username),
          name,
        }),
      )
      setToast(result.message)
    } catch (error) {
      addDebug('triggerDynamicButton.error', error instanceof Error ? error.message : String(error))
      setToast(error instanceof Error ? error.message : 'Failed to trigger custom button.')
    }
  }

  function renderAccountChips(emptyMessage: string) {
    if (accounts.length === 0) {
      return <p className="warning-text">{emptyMessage}</p>
    }

    return accounts.map((account) => {
      const selected = selectedAccounts.includes(account.username)
      return (
        <button
          key={account.username}
          className={`chip ${selected ? 'chip-selected' : ''}`}
          onClick={() => toggleAccount(account.username)}
        >
          {account.alias || account.username}
        </button>
      )
    })
  }

  function renderDashboard() {
    return (
      <>
        <header className="hero-card">
          <div className="hero-copy-block">
            <p className="eyebrow">Modern Desktop Revival</p>
            <h2>Run the old toolbox through a cleaner, sharper command deck.</h2>
            <p className="hero-copy">
              The revived client now drives real account files, real launch flows, real browser actions, Nexus control,
              favorites, theme data, and the restored local API surface without falling back to the old WinForms shell.
            </p>
            <div className="hero-ribbon">
              <span>{accounts.length} accounts loaded</span>
              <span>{selectedRows.length} selected</span>
              <span>{favoriteGames.length} favorites saved</span>
              <span>{developer.EnableWebServer === 'true' ? 'legacy API online' : 'legacy API idle'}</span>
            </div>
          </div>

          <div className="hero-rail">
            <div className="hero-spotlight">
              <span className="hero-spotlight-label">Primary target</span>
              <strong>{primaryAccount ? primaryAccount.alias || primaryAccount.username : 'No account selected'}</strong>
              <p>{primaryAccount ? `User ID ${primaryAccount.userId}` : 'Select an account to launch, shop, or run utilities.'}</p>
            </div>
            <div className="hero-actions">
              <button className="button-primary" onClick={() => void launchSelected()} disabled={isBusy('launch')}>
                {isBusy('launch') ? 'Launching...' : 'Launch Selected'}
              </button>
              <button className="button-secondary" onClick={() => void copyLaunchLink('copy-player-link')} disabled={isBusy('copy-player-link')}>
                Copy Player Link
              </button>
              <button className="button-secondary" onClick={() => void copyLaunchLink('copy-app-link')} disabled={isBusy('copy-app-link')}>
                Copy App Link
              </button>
              <button className="button-secondary" onClick={() => setActiveView('Server Browser')}>
                Server Browser
              </button>
              <button className="button-secondary" onClick={() => setActiveView('Browser Actions')}>
                Browser Actions
              </button>
            </div>
          </div>
        </header>

        <section className="health-grid">
          {[
            { label: 'Accounts Loaded', value: String(accounts.length) },
            { label: 'Selected Now', value: String(selectedRows.length) },
            { label: 'Recent Games', value: String(recentGames.length) },
            { label: 'Favorites', value: String(favoriteGames.length) },
            { label: 'Store Format', value: accountSource },
          ].map((card) => (
            <article key={card.label} className="health-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="surface surface-wide">
            <div className="surface-header">
              <div>
                <p className="panel-kicker">Launch</p>
                <h3>Roblox session controls</h3>
              </div>
            </div>
            <div className="form-grid launch-grid">
              <label className="field">
                <span>Place ID</span>
                <input value={placeId} onChange={(event) => setPlaceId(event.target.value)} placeholder="920587237" />
              </label>
              <label className="field">
                <span>Job ID or VIP access code</span>
                <input value={jobId} onChange={(event) => setJobId(event.target.value)} placeholder="Optional" />
              </label>
              {followUser ? (
                <label className="field">
                  <span>Follow user ID</span>
                  <input value={followUserId} onChange={(event) => setFollowUserId(event.target.value)} placeholder="123456789" />
                </label>
              ) : (
                <div className="field field-hint">
                  <span>Launch mode</span>
                  <p className="muted">
                    Use Place ID for normal launches, Job ID for direct server joins, or enable VIP mode for access codes.
                  </p>
                </div>
              )}
              <label className="check-row">
                <input type="checkbox" checked={followUser} onChange={(event) => setFollowUser(event.target.checked)} />
                <span>Follow user instead of joining a place</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={joinVip} onChange={(event) => setJoinVip(event.target.checked)} />
                <span>Treat Job ID as a VIP access code</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={useOldJoin} onChange={(event) => setUseOldJoin(event.target.checked)} />
                <span>Use old join executable path</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={isTeleport} onChange={(event) => setIsTeleport(event.target.checked)} />
                <span>Mark this launch as teleport</span>
              </label>
              <label className="field">
                <span>Current version override</span>
                <input
                  value={currentVersionOverride}
                  onChange={(event) => setCurrentVersionOverride(event.target.value)}
                  placeholder="version-xxxxxxxxxxxxxxxx"
                />
              </label>
            </div>
          </article>

          <article className="surface">
            <div className="surface-header">
              <div>
                <p className="panel-kicker">Selection</p>
                <h3>Accounts in scope</h3>
              </div>
            </div>
            <div className="chip-list">
              {renderAccountChips('No accounts are loaded yet. Use the Accounts tab to import or log in first.')}
            </div>
          </article>

          <article className="surface surface-wide">
            <div className="surface-header">
              <div>
                <p className="panel-kicker">Recent Games</p>
                <h3>Jump back into recent places</h3>
              </div>
            </div>
            <div className="stack-list">
              {recentGames.length === 0 ? (
                <p className="muted">No recent games found yet.</p>
              ) : (
                recentGames.slice(0, 6).map((game) => (
                  <div key={`${game.placeId}-${game.filteredName}`} className="stack-item stack-item-actions">
                    <div>
                      <strong>{game.filteredName || game.name}</strong>
                      <p>Place ID {game.placeId}</p>
                    </div>
                    <div className="inline-actions">
                      <button
                        className="text-button"
                        onClick={() => {
                          setPlaceId(String(game.placeId))
                          setActiveView('Browser Actions')
                          setBrowserTarget(`https://www.roblox.com/games/${game.placeId}`)
                        }}
                      >
                        Open in Browser
                      </button>
                      <button className="button-secondary" onClick={() => void launchSelected(game.placeId)}>
                        Launch
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </>
    )
  }

  function renderAccounts() {
    return (
      <section className="content-grid accounts-layout">
        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Accounts</p>
              <h3>Real account store</h3>
            </div>
            <div className="inline-actions">
              <button className="text-button" onClick={() => setSelectedAccounts(accounts.map((account) => account.username))}>
                Select all
              </button>
              <button className="text-button" onClick={() => setSelectedAccounts([])}>
                Clear
              </button>
              <label className="check-row compact-check">
                <input type="checkbox" checked={showAccountGroups} onChange={(event) => setShowAccountGroups(event.target.checked)} />
                <span>Group view</span>
              </label>
              <button className="text-button" onClick={() => void sortAccountsAlphabetically()}>
                Sort A-Z
              </button>
              <button className="button-secondary" onClick={() => void loadState()}>
                Refresh
              </button>
              <button className="button-danger" onClick={() => void removeSelectedAccounts()} disabled={isBusy('remove-accounts')}>
                {isBusy('remove-accounts') ? 'Removing...' : 'Remove Selected'}
              </button>
            </div>
          </div>

          <AccountTable
            accounts={accounts}
            selectedAccounts={selectedAccounts}
            toggleAccount={toggleAccount}
            showGroups={showAccountGroups}
          />
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Editor</p>
              <h3>{primaryAccount ? primaryAccount.username : 'Select an account'}</h3>
            </div>
          </div>

          {primaryAccount ? (
            <>
              <div className="form-grid">
                <label className="field">
                  <span>Alias</span>
                  <input value={editor.alias} onChange={(event) => setEditor((current) => ({ ...current, alias: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Group</span>
                  <input value={editor.group} onChange={(event) => setEditor((current) => ({ ...current, group: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    rows={5}
                    value={editor.description}
                    onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
                  />
                </label>
                <div className="inline-actions">
                  <button className="button-primary" onClick={() => void saveAccountDetails()} disabled={isBusy('save-account')}>
                    {isBusy('save-account') ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </div>

              <div className="surface-divider" />

              <div className="surface-header compact">
                <div>
                  <p className="panel-kicker">Saved Launch</p>
                  <h3>Per-account launch overrides</h3>
                </div>
              </div>

              <div className="stack-list">
                <div className="stack-item">
                  <div>
                    <strong>Saved place and job fields</strong>
                    <p>
                      SavedPlaceId: {primaryAccount.fields.SavedPlaceId || '(none)'} | SavedJobId: {primaryAccount.fields.SavedJobId || '(none)'}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <button className="button-secondary" onClick={() => void saveLaunchPreset()}>
                      Save Current Launch
                    </button>
                    <button className="text-button" onClick={() => void saveLaunchPreset(true)}>
                      Clear Saved Launch
                    </button>
                  </div>
                </div>
              </div>

              <div className="surface-divider" />

              <div className="surface-header compact">
                <div>
                  <p className="panel-kicker">Fields</p>
                  <h3>Custom metadata</h3>
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Field name</span>
                  <input value={fieldName} onChange={(event) => setFieldName(event.target.value)} />
                </label>
                <label className="field">
                  <span>Field value</span>
                  <input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} />
                </label>
              </div>
              <div className="inline-actions">
                <button className="button-secondary" onClick={() => void saveField()} disabled={isBusy('save-field')}>
                  {isBusy('save-field') ? 'Saving...' : 'Save Field'}
                </button>
              </div>

              <div className="key-value-list">
                {Object.entries(primaryAccount.fields).length === 0 ? (
                  <p className="muted">No custom fields saved.</p>
                ) : (
                  Object.entries(primaryAccount.fields).map(([key, value]) => (
                    <div key={key} className="key-value-row">
                      <div>
                        <strong>{key}</strong>
                        <p>{value}</p>
                      </div>
                      <button className="text-button danger-text" onClick={() => void removeField(key)}>
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="surface-divider" />

              <div className="surface-header compact">
                <div>
                  <p className="panel-kicker">Clipboard + Dumps</p>
                  <h3>Legacy account actions</h3>
                </div>
              </div>
              <div className="inline-actions">
                <button className="text-button" onClick={() => void copyAccountData('username')}>Copy Usernames</button>
                <button className="text-button" onClick={() => void copyAccountData('password')}>Copy Passwords</button>
                <button className="text-button" onClick={() => void copyAccountData('combo')}>Copy Combos</button>
                <button className="text-button" onClick={() => void copyAccountData('userId')}>Copy User IDs</button>
                <button className="text-button" onClick={() => void copyAccountData('securityToken')}>Copy Cookies</button>
                <button className="text-button" onClick={() => void copyAccountData('profile')}>Copy Profiles</button>
                <button className="text-button" onClick={() => void copyAccountData('group')}>Copy Groups</button>
                <button className="text-button" onClick={() => void copyAccountData('authTicket')}>Copy Auth Tickets</button>
                <button className="button-secondary" onClick={() => void dumpSelectedAccounts()}>Export Account Dumps</button>
              </div>
            </>
          ) : (
            <p className="muted">Select an account from the table to edit it.</p>
          )}
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Import</p>
              <h3>Add accounts</h3>
            </div>
          </div>
          <div className="form-grid">
            <div className="field-row">
              <label className="field">
                <span>Username</span>
                <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
              </label>
            </div>
            <div className="inline-actions">
              <button
                className="button-primary"
                onClick={() => void startAccountLogin('credentials')}
                disabled={isBusy('login-credentials')}
              >
                {isBusy('login-credentials') ? 'Opening...' : 'Add by User/Pass'}
              </button>
              <button
                className="button-secondary"
                onClick={() => void startAccountLogin('browser')}
                disabled={isBusy('login-browser')}
              >
                {isBusy('login-browser') ? 'Opening...' : 'Open Login Browser'}
              </button>
            </div>
            <label className="field">
              <span>.ROBLOSECURITY</span>
              <textarea
                rows={6}
                value={cookieInput}
                onChange={(event) => setCookieInput(event.target.value)}
                placeholder="Paste the cookie value here."
              />
            </label>
            <label className="field">
              <span>Optional saved password</span>
              <input value={cookiePassword} onChange={(event) => setCookiePassword(event.target.value)} />
            </label>
            <div className="inline-actions">
              <button className="button-primary" onClick={() => void importCookieAccount()} disabled={isBusy('import-cookie')}>
                {isBusy('import-cookie') ? 'Importing...' : 'Import Cookie'}
              </button>
            </div>
            <p className="muted">
              The browser flows import the account automatically after Roblox login finishes and the app reaches `/home`.
            </p>
          </div>

          <div className="surface-divider" />

          <div className="surface-header compact">
            <div>
              <p className="panel-kicker">Bulk Import</p>
              <h3>Cookie list</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>One .ROBLOSECURITY cookie per line</span>
              <textarea
                rows={8}
                value={bulkCookieInput}
                onChange={(event) => setBulkCookieInput(event.target.value)}
                placeholder="_|WARNING:-DO-NOT-SHARE-THIS...&#10;_|WARNING:-DO-NOT-SHARE-THIS..."
              />
            </label>
            <div className="inline-actions">
              <button className="button-secondary" onClick={() => void importBulkCookies()} disabled={isBusy('import-cookie-bulk')}>
                {isBusy('import-cookie-bulk') ? 'Importing...' : 'Bulk Import Cookies'}
              </button>
            </div>
          </div>
        </article>
      </section>
    )
  }

  function renderServerBrowser() {
    return (
      <section className="content-grid server-browser-layout">
        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Server Browser</p>
              <h3>Live server list, player search, and favorites</h3>
            </div>
            <div className="inline-actions">
              <button className="button-secondary" onClick={() => void refreshServers()} disabled={isBusy('load-servers')}>
                {isBusy('load-servers') ? 'Refreshing...' : 'Refresh Servers'}
              </button>
            </div>
          </div>

          <div className="form-grid server-controls">
            <label className="field">
              <span>Place ID</span>
              <input value={placeId} onChange={(event) => setPlaceId(event.target.value)} placeholder="920587237" />
            </label>
            <label className="field">
              <span>Search player by username</span>
              <input value={serverLookupUsername} onChange={(event) => setServerLookupUsername(event.target.value)} placeholder="Username" />
            </label>
            <div className="inline-actions">
              <button className="button-secondary" onClick={() => void locatePlayerServer()} disabled={isBusy('find-player-server')}>
                {isBusy('find-player-server') ? 'Scanning...' : 'Find Player Server'}
              </button>
            </div>
          </div>

          <div className="stack-list">
            {servers.length === 0 ? (
              <p className="muted">No servers loaded yet. Pick a place ID and refresh to pull live public and VIP servers.</p>
            ) : (
              servers.map((server) => (
                <div key={`${server.type}-${server.id}-${server.accessCode}`} className="stack-item stack-item-actions">
                  <div>
                    <strong>{server.type} server</strong>
                    <p>
                      {server.playing}/{server.maxPlayers} players
                      {server.ping > 0 ? ` | ${server.ping} ms` : ''}
                      {server.fps ? ` | ${server.fps} fps` : ''}
                    </p>
                    <p className="muted server-id">{server.type === 'VIP' ? server.accessCode || server.id : server.id}</p>
                  </div>
                  <div className="inline-actions">
                    <button className="text-button" onClick={() => setJobId(server.type === 'VIP' ? server.accessCode || server.id : server.id)}>
                      Copy to Launch
                    </button>
                    <button className="text-button" onClick={() => void copyText(server.type === 'VIP' ? server.accessCode || server.id : server.id, 'job ID')}>
                      Copy Job ID
                    </button>
                    <button className="text-button" onClick={() => void copyText(String(server.placeId || placeId), 'place ID')}>
                      Copy Place ID
                    </button>
                    <button className="button-secondary" onClick={() => void launchServer(server)}>
                      Join Server
                    </button>
                    {server.type === 'VIP' ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          void addFavoriteGame(
                            {
                              name: `VIP ${placeId}`,
                              placeId: Number(placeId),
                              imageUrl: '',
                            },
                            server.accessCode || server.id,
                          )
                        }
                      >
                        Save VIP
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Game Search</p>
              <h3>Discover places and favorite them</h3>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Search term</span>
              <input value={gameSearchTerm} onChange={(event) => setGameSearchTerm(event.target.value)} placeholder="brookhaven" />
            </label>
            <label className="field">
              <span>Page</span>
              <input value={gameSearchPage} onChange={(event) => setGameSearchPage(event.target.value)} placeholder="0" />
            </label>
            <div className="inline-actions">
              <button className="button-primary" onClick={() => void searchGameCatalog()} disabled={isBusy('search-games')}>
                {isBusy('search-games') ? 'Searching...' : 'Search Games'}
              </button>
            </div>
          </div>

          <div className="stack-list compact-stack">
            {searchGames.length === 0 ? (
              <p className="muted">No game results loaded yet.</p>
            ) : (
              searchGames.map((game) => (
                <div key={`${game.placeId}-${game.name}`} className="stack-item stack-item-actions">
                  <div>
                    <strong>{game.filteredName || game.name}</strong>
                    <p>
                      Place ID {game.placeId}
                      {game.playerCount > 0 ? ` | ${game.playerCount} playing` : ''}
                      {game.likeRatio !== null ? ` | ${game.likeRatio}% likes` : ''}
                    </p>
                    {game.creatorName ? <p>{game.creatorName}</p> : null}
                  </div>
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        setPlaceId(String(game.placeId))
                        setBrowserTarget(`https://www.roblox.com/games/${game.placeId}`)
                        setActiveView('Browser Actions')
                      }}
                    >
                      Open Browser
                    </button>
                    <button className="button-secondary" onClick={() => void launchSelected(game.placeId)}>
                      Launch
                    </button>
                    <button className="text-button" onClick={() => void addFavoriteGame(game)}>
                      Favorite
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Favorites</p>
              <h3>Persisted from FavoriteGames.json</h3>
            </div>
          </div>
          <div className="stack-list">
            {favoriteGames.length === 0 ? (
              <p className="muted">No favorites saved yet.</p>
            ) : (
              favoriteGames.map((favorite) => (
                <div key={`${favorite.placeId}-${favorite.privateServer}`} className="stack-item stack-item-actions">
                  <div>
                    <strong>{favorite.filteredName || favorite.name}</strong>
                    <p>
                      Place ID {favorite.placeId}
                      {favorite.privateServer ? ' | Private server saved' : ''}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        setPlaceId(String(favorite.placeId))
                        setJobId(favorite.privateServer)
                        setJoinVip(Boolean(favorite.privateServer))
                      }}
                    >
                      Load into Launch
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() =>
                        favorite.privateServer
                          ? void launchServer({
                              id: favorite.privateServer,
                              placeId: favorite.placeId,
                              playing: 0,
                              maxPlayers: 0,
                              ping: 0,
                              fps: '',
                              name: favorite.name,
                              vipServerId: 0,
                              accessCode: favorite.privateServer,
                              type: 'VIP',
                              playerTokens: [],
                            })
                          : void launchSelected(favorite.placeId)
                      }
                    >
                      Launch
                    </button>
                    <button className="text-button" onClick={() => void renameFavoriteGame(favorite)}>
                      Rename
                    </button>
                    <button className="text-button" onClick={() => void removeFavoriteGame(favorite)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    )
  }

  function renderAvatar() {
    return (
      <section className="content-grid avatar-layout">
        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Avatar</p>
              <h3>Browse and apply Roblox outfits</h3>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Roblox username</span>
              <input value={avatarUsername} onChange={(event) => setAvatarUsername(event.target.value)} placeholder="Builderman" />
            </label>
            <div className="inline-actions">
              <button className="button-primary" onClick={() => void loadOutfits()} disabled={isBusy('avatar-load')}>
                {isBusy('avatar-load') ? 'Loading...' : 'Load Outfits'}
              </button>
            </div>
            <p className="muted">
              Wearing an outfit uses the primary selected account. Copying avatar JSON works even if no account is selected.
            </p>
          </div>

          <div className="surface-divider" />

          <div className="surface-header compact">
            <div>
              <p className="panel-kicker">Manual Avatar JSON</p>
              <h3>Paste avatar data and apply it directly</h3>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Avatar JSON</span>
              <textarea
                rows={10}
                value={avatarJsonInput}
                onChange={(event) => setAvatarJsonInput(event.target.value)}
                placeholder='{"assets":[],"bodyColors":{},"scales":{}}'
              />
            </label>
            <div className="inline-actions">
              <button className="button-primary" onClick={() => void wearAvatarJson()} disabled={isBusy('wear-avatar-json')}>
                {isBusy('wear-avatar-json') ? 'Applying...' : 'Wear Avatar JSON'}
              </button>
              <button className="button-secondary" onClick={() => setAvatarJsonInput('')}>
                Clear JSON
              </button>
            </div>
          </div>

          <div className="card-grid">
            {outfits.length === 0 ? (
              <p className="muted">No outfits loaded yet. Search for a username to pull the first page of outfits.</p>
            ) : (
              outfits.map((outfit) => (
                <article key={outfit.id} className="mini-card">
                  <div className="mini-card-media">
                    {outfit.imageUrl ? <img src={outfit.imageUrl} alt={outfit.name} /> : <span>Outfit</span>}
                  </div>
                  <strong>{outfit.name}</strong>
                  <p className="muted">Outfit ID {outfit.id}</p>
                  <div className="inline-actions">
                    <button className="button-secondary" onClick={() => void wearOutfit(outfit)}>
                      Wear Outfit
                    </button>
                    <button className="text-button" onClick={() => void copyOutfitJson(outfit)}>
                      Copy Avatar JSON
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Target</p>
              <h3>{primaryAccount ? primaryAccount.username : 'No account selected'}</h3>
            </div>
          </div>
          {primaryAccount ? (
            <div className="stack-list compact-stack">
              <div className="stack-item">
                <strong>{primaryAccount.alias || primaryAccount.username}</strong>
                <p>User ID {primaryAccount.userId}</p>
              </div>
            </div>
          ) : (
            <p className="warning-text">Select an account in Accounts or Dashboard before using Wear Outfit.</p>
          )}
        </article>
      </section>
    )
  }

  function renderMissingAssets() {
    return (
      <section className="content-grid avatar-layout">
        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Missing Assets</p>
              <h3>Manual asset lookup and purchase</h3>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Asset ID</span>
              <input value={assetInput} onChange={(event) => setAssetInput(event.target.value)} placeholder="123456789" />
            </label>
            <div className="inline-actions">
              <button className="button-primary" onClick={() => void addAssetCard()} disabled={isBusy(`asset-load-${assetInput}`)}>
                Load Asset
              </button>
            </div>
            <p className="muted">
              Purchase uses the primary selected account only. If nothing is selected, the app will block the purchase and tell you why.
            </p>
          </div>

          <div className="card-grid">
            {assets.length === 0 ? (
              <p className="muted">No assets loaded yet. Add an asset ID to inspect it.</p>
            ) : (
              assets.map((asset) => (
                <article key={asset.assetId} className="mini-card">
                  <div className="mini-card-media">
                    {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} /> : <span>Asset</span>}
                  </div>
                  <strong>{asset.name}</strong>
                  <p className="muted">Asset ID {asset.assetId}</p>
                  <p className="muted">
                    {asset.isForSale ? `${asset.priceInRobux} Robux` : 'Not for sale'}
                    {asset.creatorName ? ` | ${asset.creatorName}` : ''}
                  </p>
                  <div className="inline-actions">
                    <button
                      className="button-secondary"
                      onClick={() => void purchaseAsset(asset)}
                      disabled={!asset.isForSale || !asset.productId || !asset.creatorId}
                    >
                      Purchase
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => setAssets((current) => current.filter((entry) => entry.assetId !== asset.assetId))}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Buyer</p>
              <h3>{primaryAccount ? primaryAccount.username : 'No account selected'}</h3>
            </div>
          </div>
          {primaryAccount ? (
            <p className="muted">Purchases will run through {primaryAccount.alias || primaryAccount.username}.</p>
          ) : (
            <p className="warning-text">Select an account first before attempting a purchase.</p>
          )}
        </article>
      </section>
    )
  }

  function renderControl() {
    return (
      <section className="content-grid control-layout">
        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Control</p>
              <h3>Nexus account control and relaunch settings</h3>
            </div>
            <div className="inline-actions">
              <button className="button-secondary" onClick={() => void loadControlState()}>
                Refresh
              </button>
              <button className="button-primary" onClick={() => void linkSelectedAccounts()} disabled={isBusy('control-link')}>
                Link Selected Accounts
              </button>
              <button className="button-danger" onClick={() => void removeControlledSelection()} disabled={isBusy('control-remove')}>
                Remove Linked
              </button>
            </div>
          </div>

          <div className="table">
            <div className="table-head control-table-head">
              <span>Use</span>
              <span>Account</span>
              <span>Status</span>
              <span>Place ID</span>
              <span>Job ID</span>
              <span>Auto Relaunch</span>
            </div>
            {controlledAccounts.length === 0 ? (
              <p className="muted">No controlled accounts linked yet. Select accounts elsewhere, then click Link Selected Accounts.</p>
            ) : (
              controlledAccounts.map((entry) => (
                <div key={entry.username} className="table-row control-table-row">
                  <span>
                    <input
                      type="checkbox"
                      checked={entry.isChecked}
                      onChange={(event) => void updateControlledAccount(entry.username, { isChecked: event.target.checked })}
                    />
                  </span>
                  <span>{entry.username}</span>
                  <span>{entry.status}</span>
                  <span>
                    <input
                      value={entry.placeId}
                      onChange={(event) => void updateControlledAccount(entry.username, { placeId: event.target.value })}
                    />
                  </span>
                  <span>
                    <input
                      value={entry.jobId}
                      onChange={(event) => void updateControlledAccount(entry.username, { jobId: event.target.value })}
                    />
                  </span>
                  <span>
                    <input
                      type="checkbox"
                      checked={entry.autoRelaunch}
                      onChange={(event) => void updateControlledAccount(entry.username, { autoRelaunch: event.target.checked })}
                    />
                  </span>
                  <span className="control-script-cell">
                    <textarea
                      rows={3}
                      value={entry.autoExecute}
                      onChange={(event) => void updateControlledAccount(entry.username, { autoExecute: event.target.value })}
                      placeholder="Auto execute script"
                    />
                  </span>
                  <span>
                    <input
                      value={String(entry.relaunchDelay)}
                      onChange={(event) =>
                        void updateControlledAccount(entry.username, {
                          relaunchDelay: Number.parseInt(event.target.value || '0', 10) || 0,
                        })
                      }
                    />
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Server</p>
              <h3>{nexusServer.running ? 'Running' : 'Stopped'}</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="toggle-row">
              <span>Allow external connections</span>
              <input
                className="toggle-input"
                type="checkbox"
                checked={nexusSettings.allowExternalConnections}
                onChange={(event) => {
                  const nextValue = event.target.checked
                  setNexusSettings((current) => ({ ...current, allowExternalConnections: nextValue }))
                  void saveNexusSetting('AllowExternalConnections', nextValue ? 'true' : 'false', 'Allow external connections')
                }}
              />
            </label>
            <label className="toggle-row">
              <span>Start on launch</span>
              <input
                className="toggle-input"
                type="checkbox"
                checked={nexusSettings.startOnLaunch}
                onChange={(event) => {
                  const nextValue = event.target.checked
                  setNexusSettings((current) => ({ ...current, startOnLaunch: nextValue }))
                  void saveNexusSetting('StartOnLaunch', nextValue ? 'true' : 'false', 'Start on launch')
                }}
              />
            </label>
            <label className="field">
              <span>Nexus port</span>
              <input
                value={String(nexusSettings.nexusPort)}
                onChange={(event) => setNexusSettings((current) => ({ ...current, nexusPort: Number.parseInt(event.target.value || '0', 10) || 0 }))}
                onBlur={(event) => void saveNexusSetting('NexusPort', event.target.value, 'Nexus port')}
              />
            </label>
            <label className="field">
              <span>Default relaunch delay</span>
              <input
                value={String(nexusSettings.relaunchDelay)}
                onChange={(event) =>
                  setNexusSettings((current) => ({ ...current, relaunchDelay: Number.parseInt(event.target.value || '0', 10) || 0 }))
                }
                onBlur={(event) => void saveNexusSetting('RelaunchDelay', event.target.value, 'Default relaunch delay')}
              />
            </label>
            <label className="field">
              <span>Launcher delay</span>
              <input
                value={String(nexusSettings.launcherDelay)}
                onChange={(event) =>
                  setNexusSettings((current) => ({ ...current, launcherDelay: Number.parseInt(event.target.value || '0', 10) || 0 }))
                }
                onBlur={(event) => void saveNexusSetting('LauncherDelayNumber', event.target.value, 'Launcher delay')}
              />
            </label>
            <div className="inline-actions">
              <button className="button-primary" onClick={() => void toggleNexusServer()}>
                {nexusServer.running ? 'Stop Server' : 'Start Server'}
              </button>
            </div>
            <p className="muted">
              {nexusServer.host}:{nexusServer.port} | {nexusServer.connectedCount} client{nexusServer.connectedCount === 1 ? '' : 's'} connected
            </p>
          </div>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Commands</p>
              <h3>Send to checked clients</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Command name</span>
              <input value={controlCommandName} onChange={(event) => setControlCommandName(event.target.value)} />
            </label>
            <label className="field">
              <span>Simple payload value</span>
              <input value={controlCommandPayload} onChange={(event) => setControlCommandPayload(event.target.value)} />
            </label>
            <div className="inline-actions">
              <button className="button-secondary" onClick={() => void sendControlCommand()} disabled={isBusy('control-command')}>
                Send Command
              </button>
            </div>
            <label className="field">
              <span>Execute script</span>
              <textarea rows={8} value={controlScript} onChange={(event) => setControlScript(event.target.value)} />
            </label>
            <div className="inline-actions">
              <button className="button-secondary" onClick={() => void sendControlScript()} disabled={isBusy('control-script')}>
                Send Script
              </button>
            </div>
          </div>
        </article>

        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Custom Executor Controls</p>
              <h3>Dynamic Nexus elements created by your executor</h3>
            </div>
          </div>
          <div className="dynamic-controls">
            {dynamicElements.length === 0 ? (
              <p className="muted">
                No dynamic elements yet. When your executor calls `Nexus:CreateButton`, `CreateTextBox`, `CreateNumeric`,
                `CreateLabel`, or `NewLine`, they will appear here.
              </p>
            ) : (
              dynamicElements.map((element) => {
                if (element.kind === 'newline') {
                  return <div key={element.id} className="dynamic-break" />
                }

                if (element.kind === 'label') {
                  return (
                    <label key={element.id} className="dynamic-label">
                      {element.content || element.name}
                    </label>
                  )
                }

                if (element.kind === 'button') {
                  return (
                    <button
                      key={element.id}
                      className="button-secondary"
                      onClick={() => void triggerDynamicButton(element.name)}
                      disabled={isBusy(`dynamic-button-${element.name}`)}
                    >
                      {element.content || element.name}
                    </button>
                  )
                }

                if (element.kind === 'textbox') {
                  return (
                    <label key={element.id} className="field dynamic-field">
                      <span>{element.name}</span>
                      <input
                        value={element.content ?? ''}
                        onChange={(event) => void updateDynamicElement(element.name, event.target.value)}
                      />
                    </label>
                  )
                }

                return (
                  <label key={element.id} className="field dynamic-field">
                    <span>{element.name}</span>
                    <input
                      type="number"
                      step={String(element.increment ?? 1)}
                      value={element.content ?? ''}
                      onChange={(event) => void updateDynamicElement(element.name, event.target.value)}
                    />
                  </label>
                )
              })
            )}
          </div>
          <p className="muted">
            Button clicks emit `ButtonClicked:&lt;Name&gt;` to the checked clients. `GetText` reads the current values from this panel.
          </p>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Log</p>
              <h3>Nexus server events</h3>
            </div>
          </div>
          <div className="debug-list control-log">
            {nexusServer.logEntries.length === 0 ? (
              <p className="muted">No Nexus events yet.</p>
            ) : (
              nexusServer.logEntries.map((entry, index) => (
                <p key={`${entry.at}-${entry.message}-${index}`} className="debug-line">
                  {new Date(entry.at).toLocaleTimeString()} {entry.message}
                  {entry.details ? ` ${JSON.stringify(entry.details)}` : ''}
                </p>
              ))
            )}
          </div>
        </article>

        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Executor Help</p>
              <h3>Nexus bootstrap and docs</h3>
            </div>
            <div className="inline-actions">
              <button className="button-secondary" onClick={() => void writeNexusLoader()}>
                Write `Nexus.lua`
              </button>
              <button
                className="text-button"
                onClick={() => {
                  void navigator.clipboard.writeText(nexusLoaderScript)
                  setToast('Copied Nexus loader script.')
                }}
              >
                Copy Loader
              </button>
              <button
                className="text-button"
                onClick={() => window.open('https://github.com/ic3w0lf22/Roblox-Account-Manager/blob/master/RBX%20Alt%20Manager/Nexus/NexusDocs.md', '_blank')}
              >
                Open Docs
              </button>
            </div>
          </div>
          <p className="muted">
            Drop the written `Nexus.lua` into your executor autoexec folder, or copy this loader manually and run it after attach.
          </p>
          <pre className="code-output">{nexusLoaderScript || 'Loading Nexus bootstrap script...'}</pre>
        </article>
      </section>
    )
  }

  function renderBrowserActions() {
    return (
      <section className="content-grid browser-grid">
        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Browser Actions</p>
              <h3>Open logged-in Roblox windows</h3>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Target URL</span>
              <input value={browserTarget} onChange={(event) => setBrowserTarget(event.target.value)} />
            </label>

            <label className="field">
              <span>Browser mode</span>
              <select className="select-input" value={browserMode} onChange={(event) => setBrowserMode(event.target.value as 'standard' | 'groupJoin')}>
                <option value="standard">Standard logged-in browser</option>
                <option value="groupJoin">Auto-join Roblox group</option>
              </select>
            </label>

            <label className="field">
              <span>Optional script</span>
              <textarea
                rows={8}
                value={browserScript}
                onChange={(event) => setBrowserScript(event.target.value)}
                placeholder="Executed after the page loads in each logged-in browser window."
              />
            </label>

            {browserMode === 'groupJoin' ? (
              <p className="warning-text">
                Group-join mode will keep trying to click the Roblox group join button for a few seconds after the page loads.
              </p>
            ) : null}

            <div className="inline-actions">
              <button className="button-primary" onClick={() => void runBrowserFlow()} disabled={isBusy('browser')}>
                {isBusy('browser') ? 'Opening...' : 'Open Browser Windows'}
              </button>
            </div>
          </div>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Selection</p>
              <h3>Accounts in this flow</h3>
            </div>
          </div>
          <div className="chip-list">
            {renderAccountChips('No accounts are loaded yet. Use the Accounts tab to import or log in first.')}
          </div>
        </article>
      </section>
    )
  }

  function renderRecentGames() {
    return (
      <section className="surface">
        <div className="surface-header">
          <div>
            <p className="panel-kicker">Recent Games</p>
            <h3>Real recent-game history</h3>
          </div>
        </div>
        <div className="stack-list">
          {recentGames.length === 0 ? (
            <p className="muted">No `RecentGames.json` entries were found.</p>
          ) : (
            recentGames.map((game) => (
              <div key={`${game.placeId}-${game.filteredName}`} className="stack-item stack-item-actions">
                <div>
                  <strong>{game.filteredName || game.name}</strong>
                  <p>Place ID {game.placeId}</p>
                </div>
                <div className="inline-actions">
                  <button
                    className="text-button"
                    onClick={() => {
                      setBrowserTarget(`https://www.roblox.com/games/${game.placeId}`)
                      setActiveView('Browser Actions')
                    }}
                  >
                    Browser
                  </button>
                  <button className="button-secondary" onClick={() => void launchSelected(game.placeId)}>
                    Launch
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    )
  }

  function renderUtilities() {
    return (
      <section className="content-grid utilities-layout">
        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Utilities</p>
              <h3>{primaryAccount ? `Tools for ${primaryAccount.username}` : 'Select an account'}</h3>
            </div>
          </div>

          {primaryAccount ? (
            <div className="form-grid">
              <div className="field-row">
                <label className="field">
                  <span>Display name</span>
                  <input value={displayNameInput} onChange={(event) => setDisplayNameInput(event.target.value)} />
                </label>
                <div className="inline-actions align-end">
                  <button
                    className="button-secondary"
                    onClick={() => void runAccountTool('set_display_name', displayNameInput)}
                    disabled={isBusy('tool-set_display_name')}
                  >
                    Set Display Name
                  </button>
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Friend username</span>
                  <input value={friendUsername} onChange={(event) => setFriendUsername(event.target.value)} />
                </label>
                <div className="inline-actions align-end">
                  <button
                    className="button-secondary"
                    onClick={() => void runAccountTool('send_friend_request', friendUsername)}
                    disabled={isBusy('tool-send_friend_request')}
                  >
                    Send Friend Request
                  </button>
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Username to block or unblock</span>
                  <input value={blockUsername} onChange={(event) => setBlockUsername(event.target.value)} />
                </label>
                <div className="inline-actions align-end">
                  <button
                    className="button-secondary"
                    onClick={() => void runAccountTool('toggle_block', blockUsername)}
                    disabled={isBusy('tool-toggle_block')}
                  >
                    Toggle Block
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void runAccountTool('get_blocked_list')}
                    disabled={isBusy('tool-get_blocked_list')}
                  >
                    Load Blocked List
                  </button>
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Pin code</span>
                  <input value={pinCode} onChange={(event) => setPinCode(event.target.value)} />
                </label>
                <label className="field">
                  <span>Follow privacy</span>
                  <select value={followPrivacy} onChange={(event) => setFollowPrivacy(event.target.value)} className="select-input">
                    <option value="0">All</option>
                    <option value="1">Followers</option>
                    <option value="2">Following</option>
                    <option value="3">Friends</option>
                    <option value="4">No one</option>
                  </select>
                </label>
              </div>

              <div className="inline-actions">
                <button
                  className="button-secondary"
                  onClick={() => void runAccountTool('unlock_pin', pinCode)}
                  disabled={isBusy('tool-unlock_pin')}
                >
                  Unlock Pin
                </button>
                <button
                  className="button-secondary"
                  onClick={() => void runAccountTool('set_follow_privacy', followPrivacy)}
                  disabled={isBusy('tool-set_follow_privacy')}
                >
                  Set Follow Privacy
                </button>
                <button
                  className="button-danger"
                  onClick={() => void runAccountTool('logout_other_sessions')}
                  disabled={isBusy('tool-logout_other_sessions')}
                >
                  Log Out Other Sessions
                </button>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Quick login code</span>
                  <input value={quickLoginCode} onChange={(event) => setQuickLoginCode(event.target.value)} />
                </label>
                <div className="inline-actions align-end">
                  <button
                    className="button-secondary"
                    onClick={() => void runAccountTool('quick_login', quickLoginCode)}
                    disabled={isBusy('tool-quick_login')}
                  >
                    Quick Login
                  </button>
                </div>
              </div>

              <div className="inline-actions">
                <button className="text-button" onClick={() => void runAccountTool('get_cookie')} disabled={isBusy('tool-get_cookie')}>
                  Get Cookie
                </button>
                <button className="text-button" onClick={() => void runAccountTool('get_csrf')} disabled={isBusy('tool-get_csrf')}>
                  Get CSRF
                </button>
                <button className="button-primary" onClick={() => void loadDiagnostics()} disabled={isBusy('diagnostics')}>
                  Load Diagnostics
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">Select an account in the Accounts tab first.</p>
          )}
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Output</p>
              <h3>Utility response</h3>
            </div>
          </div>
          <pre className="code-output">{utilityOutput || 'No utility output yet.'}</pre>
        </article>
      </section>
    )
  }

  function renderSettings() {
    return (
      <section className="content-grid browser-grid">
        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">General</p>
              <h3>Persisted to RAMSettings.ini</h3>
            </div>
          </div>
          <div className="settings-list">
            {generalToggleSettings.map(([key, label]) => {
              const enabled = general[key] === 'true'
              return (
                <label key={key} className="toggle-row">
                  <span>{label}</span>
                  <input
                    className="toggle-input"
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => {
                      const nextValue = event.target.checked ? 'true' : 'false'
                      addDebug('toggle.change', { section: 'General', key, nextValue })
                      applyLocalSetting('General', key, nextValue)
                      void persistSetting('General', key, nextValue, label)
                    }}
                  />
                </label>
              )
            })}
          </div>
          <div className="field-row">
            <label className="field">
              <span>Account join delay</span>
              <input
                value={general.AccountJoinDelay ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, General: { ...current.General, AccountJoinDelay: event.target.value } }))}
                onBlur={(event) => void persistSetting('General', 'AccountJoinDelay', event.target.value, 'Account join delay')}
              />
            </label>
            <label className="field">
              <span>Max recent games</span>
              <input
                value={general.MaxRecentGames ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, General: { ...current.General, MaxRecentGames: event.target.value } }))}
                onBlur={(event) => void persistSetting('General', 'MaxRecentGames', event.target.value, 'Max recent games')}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Presence update rate</span>
              <input
                value={general.PresenceUpdateRate ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, General: { ...current.General, PresenceUpdateRate: event.target.value } }))}
                onBlur={(event) => void persistSetting('General', 'PresenceUpdateRate', event.target.value, 'Presence update rate')}
              />
            </label>
            <label className="field">
              <span>Max FPS value</span>
              <input
                value={general.MaxFPSValue ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, General: { ...current.General, MaxFPSValue: event.target.value } }))}
                onBlur={(event) => void persistSetting('General', 'MaxFPSValue', event.target.value, 'Max FPS value')}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Server region format</span>
              <input
                value={general.ServerRegionFormat ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, General: { ...current.General, ServerRegionFormat: event.target.value } }))}
                onBlur={(event) => void persistSetting('General', 'ServerRegionFormat', event.target.value, 'Server region format')}
              />
            </label>
            <label className="field">
              <span>Shuffle page count</span>
              <input
                value={general.ShufflePageCount ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, General: { ...current.General, ShufflePageCount: event.target.value } }))}
                onBlur={(event) => void persistSetting('General', 'ShufflePageCount', event.target.value, 'Shuffle page count')}
              />
            </label>
          </div>
          <label className="field">
            <span>IP API format URL</span>
            <input
              value={general.IPApiLink ?? ''}
              onChange={(event) => setSettings((current) => ({ ...current, General: { ...current.General, IPApiLink: event.target.value } }))}
              onBlur={(event) => void persistSetting('General', 'IPApiLink', event.target.value, 'IP API URL')}
            />
          </label>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Runtime</p>
              <h3>Client behavior and maintenance</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <div>
                <strong>Custom ClientAppSettings.json</strong>
                <p>{general.CustomClientSettings ?? 'No override file is active.'}</p>
              </div>
              <div className="inline-actions">
                <button className="button-secondary" onClick={() => void pickCustomClientSettings()}>
                  Select JSON
                </button>
                <button className="text-button" onClick={() => void clearCustomClientSettings()}>
                  Clear Override
                </button>
              </div>
            </div>
            <div className="stack-item">
              <div>
                <strong>Update tools</strong>
                <p>Open the latest public release page if you need the legacy updater path or want to compare builds.</p>
              </div>
              <div className="inline-actions">
                <button className="button-secondary" onClick={() => void openReleasePage()}>
                  Open Release Page
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="surface surface-wide">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Theme</p>
              <h3>Legacy palette and shell styling</h3>
            </div>
          </div>

          <div className="field-row">
            {themeColorSettings.map(([key, label]) => (
              <label key={key} className="field">
                <span>{label}</span>
                <div className="color-input-row">
                  <input
                    className="color-input"
                    type="color"
                    value={theme[key] ?? '#000000'}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setTheme((current) => ({ ...current, [key]: nextValue }))
                      void saveThemePatch({ [key]: nextValue }, label)
                    }}
                  />
                  <input
                    value={theme[key] ?? ''}
                    onChange={(event) => setTheme((current) => ({ ...current, [key]: event.target.value }))}
                    onBlur={(event) => void saveThemePatch({ [key]: event.target.value }, label)}
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="settings-list">
            {themeToggleSettings.map(([key, label]) => {
              const enabled = String(theme[key] ?? 'True').toLowerCase() === 'true'
              return (
                <label key={key} className="toggle-row">
                  <span>{label}</span>
                  <input
                    className="toggle-input"
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => {
                      const nextValue = event.target.checked ? 'True' : 'False'
                      setTheme((current) => ({ ...current, [key]: nextValue }))
                      void saveThemePatch({ [key]: nextValue }, label)
                    }}
                  />
                </label>
              )
            })}
          </div>

          <div className="field-row">
            {themeSelectSettings.map(([key, options]) => (
              <label key={key} className="field">
                <span>{key}</span>
                <select
                  className="select-input"
                  value={theme[key] ?? options[0]}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setTheme((current) => ({ ...current, [key]: nextValue }))
                    void saveThemePatch({ [key]: nextValue }, key)
                  }}
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="preview-panel theme-preview-panel">
            <strong>Live Preview</strong>
            <p className="muted">
              Theme edits apply to the modern shell immediately and also save back to <code>RAMTheme.ini</code>.
            </p>
            <div className="chip-list">
              <button className="button-primary" type="button">
                Primary
              </button>
              <button className="button-secondary" type="button">
                Secondary
              </button>
              <button className="text-button" type="button">
                Text Button
              </button>
            </div>
          </div>
        </article>

        <article className="surface">
          <div className="surface-header">
            <div>
              <p className="panel-kicker">Web Server</p>
              <h3>Legacy local API controls</h3>
            </div>
          </div>
          <div className="settings-list">
            {webserverToggleSettings.map(([key, label, section]) => {
              const values = section === 'Developer' ? developer : webServer
              const enabled = values[key] === 'true'
              return (
                <label key={key} className="toggle-row">
                  <span>{label}</span>
                  <input
                    className="toggle-input"
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => {
                      const nextValue = event.target.checked ? 'true' : 'false'
                      addDebug('toggle.change', { section, key, nextValue })
                      applyLocalSetting(section, key, nextValue)
                      void persistSetting(section, key, nextValue, label)
                    }}
                  />
                </label>
              )
            })}
          </div>
          <div className="field-row">
            <label className="field">
              <span>Web server password</span>
              <input
                value={webServer.Password ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, WebServer: { ...current.WebServer, Password: event.target.value } }))}
                onBlur={(event) => void persistSetting('WebServer', 'Password', event.target.value, 'Web server password')}
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                value={webServer.WebServerPort ?? ''}
                onChange={(event) => setSettings((current) => ({ ...current, WebServer: { ...current.WebServer, WebServerPort: event.target.value } }))}
                onBlur={(event) => void persistSetting('WebServer', 'WebServerPort', event.target.value, 'Web server port')}
              />
            </label>
          </div>
          <div className="preview-panel">
            <strong>Legacy API status</strong>
            <p className="muted">
              {developer.EnableWebServer === 'true'
                ? `The legacy HTTP API should listen on http://${webServer.AllowExternalConnections === 'true' ? '0.0.0.0' : '127.0.0.1'}:${webServer.WebServerPort ?? '7963'}/`
                : 'Enable Web Server to expose the old local API endpoints again.'}
            </p>
            <p className="muted">
              Supported routes include <code>/Running</code>, <code>/GetAccounts</code>, <code>/GetAccountsJson</code>, <code>/ImportCookie</code>, <code>/LaunchAccount</code>, <code>/FollowUser</code>, <code>/GetCookie</code>, and the legacy account-editing routes.
            </p>
          </div>
        </article>
      </section>
    )
  }

  function renderDebug() {
    return (
      <section className="surface">
        <div className="surface-header">
          <div>
            <p className="panel-kicker">Debug</p>
            <h3>Renderer and backend event feed</h3>
          </div>
          <div className="inline-actions">
            <button className="button-secondary" onClick={() => void loadState()}>
              Reload State
            </button>
            <button className="text-button" onClick={() => setDebugEntries([])}>
              Clear
            </button>
          </div>
        </div>

        <div className="debug-list debug-list-page">
          {debugEntries.length === 0 ? (
            <p className="muted">No debug events yet.</p>
          ) : (
            debugEntries.map((entry, index) => (
              <p key={`${entry}-${index}`} className="debug-line">
                {entry}
              </p>
            ))
          )}
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <div className="shell">
        <main className="main">
          <section className="surface">
            <h3>Loading data...</h3>
            <p className="muted">Reading legacy files from the repo root.</p>
          </section>
        </main>
      </div>
    )
  }

  if (accountsLocked) {
    return (
      <div className="shell">
        <main className="main">
          <section className="surface lock-panel">
            <p className="panel-kicker">Account Store Locked</p>
            <h3>Enter the RAM account password</h3>
            <p className="muted">
              Your `AccountData.json` uses the newer password-based format. The React app can read and save it
              once you provide the password.
            </p>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <div className="inline-actions">
              <button className="button-primary" onClick={() => void unlockAccounts()} disabled={passwordBusy}>
                {passwordBusy ? 'Unlocking...' : 'Unlock Accounts'}
              </button>
              <button className="button-secondary" onClick={() => void loadState()}>
                Refresh State
              </button>
            </div>
            <p className="muted">{toast}</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div
      className={`shell ${showHeaders ? '' : 'shell-hide-headers'} ${labelsTransparent ? 'shell-transparent-labels' : ''} ${
        lightImages ? 'shell-light-images' : ''
      } ${darkTopBar ? 'shell-dark-topbar' : 'shell-light-topbar'} ${buttonStyle === 'Standard' ? 'shell-standard-buttons' : ''}`}
      style={themeStyle}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">RAM</div>
          <div>
            <p className="eyebrow">Revival Build</p>
            <h1>Account Manager</h1>
          </div>
        </div>

        <section className="sidebar-intro">
          <p className="sidebar-intro-title">Operations deck</p>
          <p className="sidebar-intro-copy">
            Real Roblox account management, browser control, outfit tools, server scanning, and Nexus orchestration in one workspace.
          </p>
        </section>

        <nav className="nav">
          {navSections.map((section) => (
            <div key={section.label} className="nav-section">
              <p className="nav-section-title">{section.label}</p>
              <div className="nav-section-list">
                {section.views.map((view) => (
                  <button
                    key={view}
                    className={`nav-item ${activeView === view ? 'nav-item-active' : ''}`}
                    onClick={() => {
                      addDebug('nav.click', { view })
                      setActiveView(view)
                    }}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <section className="sidebar-panel">
          <p className="panel-kicker">Live State</p>
          <h2>{activeView}</h2>
          <p>{toast}</p>
          {accounts.length === 0 && activeView !== 'Accounts' && (
            <p className="warning-text">No accounts are loaded yet. Use the Accounts tab to import or log in.</p>
          )}
        </section>
      </aside>

      <main className="main">
        <header className="workspace-header">
          <div>
            <p className="workspace-eyebrow">Workspace</p>
            <h2>{activeView}</h2>
            <p className="workspace-copy">{activeViewDescription}</p>
          </div>
          <div className="workspace-meta">
            <div className="workspace-pill">
              <span>Selection</span>
              <strong>{selectedRows.length || 0}</strong>
            </div>
            <div className="workspace-pill">
              <span>Primary</span>
              <strong>{primaryAccount ? primaryAccount.alias || primaryAccount.username : 'None'}</strong>
            </div>
            <div className="workspace-pill workspace-pill-wide">
              <span>Status</span>
              <strong>{toast}</strong>
            </div>
          </div>
        </header>
        {activeView === 'Dashboard' && renderDashboard()}
        {activeView === 'Accounts' && renderAccounts()}
        {activeView === 'Avatar' && renderAvatar()}
        {activeView === 'Missing Assets' && renderMissingAssets()}
        {activeView === 'Control' && renderControl()}
        {activeView === 'Server Browser' && renderServerBrowser()}
        {activeView === 'Browser Actions' && renderBrowserActions()}
        {activeView === 'Recent Games' && renderRecentGames()}
        {activeView === 'Utilities' && renderUtilities()}
        {activeView === 'Settings' && renderSettings()}
        {activeView === 'Debug' && renderDebug()}
      </main>
    </div>
  )
}

function AccountTable({
  accounts,
  selectedAccounts,
  toggleAccount,
  showGroups,
}: {
  accounts: AccountRow[]
  selectedAccounts: string[]
  toggleAccount: (name: string) => void
  showGroups: boolean
}) {
  if (accounts.length === 0) {
    return <p className="muted">No accounts loaded from the legacy store.</p>
  }

  const groupedAccounts: Array<[string, AccountRow[]]> = showGroups
    ? Object.entries(
        accounts.reduce<Record<string, AccountRow[]>>((groups, account) => {
          const key = account.group || 'Default'
          groups[key] = groups[key] ?? []
          groups[key].push(account)
          return groups
        }, {}),
      )
    : [['All Accounts', accounts]]

  return (
    <div className="table">
      <div className="table-head table-head-wide">
        <span>Select</span>
        <span>Account</span>
        <span>Group</span>
        <span>Last Use</span>
        <span>User ID</span>
        <span>Context</span>
      </div>
      {groupedAccounts.map(([groupName, rows]) => (
        <div key={groupName} className="table-group">
          {showGroups && <div className="table-group-title">{groupName}</div>}
          {rows.map((account) => (
            <button
              key={account.username}
              className={`table-row table-row-wide table-button ${selectedAccounts.includes(account.username) ? 'table-row-active' : ''}`}
              onClick={() => toggleAccount(account.username)}
            >
              <span className="checkbox-dot">{selectedAccounts.includes(account.username) ? '●' : '○'}</span>
              <span className="account-name">{account.alias || account.username}</span>
              <span>{account.group}</span>
              <span>{account.lastUse ? new Date(account.lastUse).toLocaleString() : 'Never'}</span>
              <span>{account.userId}</span>
              <span>{account.description || (account.hasSecurityToken ? 'Cookie loaded' : 'No token')}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
