export {}

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

type AppState = {
  accounts: AccountRow[]
  accountsLocked: boolean
  accountSource: string
  settings: Record<string, Record<string, string>>
  theme: Record<string, string>
  recentGames: RecentGame[]
  favoriteGames: FavoriteGame[]
}

type AccountMutationResult = {
  accounts: AccountRow[]
  accountSource: string
}

declare global {
  interface Window {
    desktopBridge: {
      platform: string
      versions: {
        chrome: string
        electron: string
        node: string
      }
      loadState: () => Promise<AppState>
      unlockAccounts: (password: string) => Promise<Pick<AppState, 'accounts' | 'accountsLocked' | 'accountSource'>>
      saveSetting: (payload: { section: string; key: string; value: string | boolean | number }) => Promise<Record<string, Record<string, string>>>
      saveTheme: (payload: Record<string, string>) => Promise<Record<string, string>>
      pickCustomClientSettings: () => Promise<{
        ok: boolean
        canceled?: boolean
        message: string
        settings: Record<string, Record<string, string>>
        path?: string
      }>
      clearCustomClientSettings: () => Promise<{
        ok: boolean
        message: string
        settings: Record<string, Record<string, string>>
      }>
      openReleasePage: () => Promise<{ ok: boolean; message: string; url: string }>
      updateAccount: (payload: { username: string; alias?: string; description?: string; group?: string }) => Promise<AccountMutationResult>
      setAccountField: (payload: { username: string; field: string; value: string }) => Promise<AccountMutationResult>
      removeAccountField: (payload: { username: string; field: string }) => Promise<AccountMutationResult>
      removeAccounts: (usernames: string[]) => Promise<AccountMutationResult>
      sortAccounts: () => Promise<AccountMutationResult>
      saveLaunchForAccounts: (payload: {
        usernames: string[]
        placeId?: string | number
        jobId?: string
        clear?: boolean
      }) => Promise<AccountMutationResult>
      copyAccountData: (payload: {
        usernames: string[]
        kind: 'username' | 'password' | 'combo' | 'userId' | 'securityToken' | 'profile' | 'group' | 'authTicket'
      }) => Promise<{ ok: boolean; message: string }>
      dumpAccountDetails: (payload: { usernames: string[] }) => Promise<{ ok: boolean; message: string; path: string }>
      importCookie: (payload: { cookie: string; password?: string }) => Promise<AccountMutationResult>
      importCookiesBulk: (payload: { cookies: string[]; password?: string }) => Promise<{
        ok: boolean
        results: Array<{ ok: boolean; cookie: string; username?: string; message?: string }>
        accounts: AccountRow[]
        accountSource: string
      }>
      startAccountLogin: (payload: {
        mode: 'browser' | 'credentials'
        username?: string
        password?: string
      }) => Promise<{ ok: boolean; message: string }>
      searchGames: (payload: { query?: string; page?: number }) => Promise<{ ok: boolean; games: SearchGame[] }>
      getServers: (payload: { placeId: string | number; includeVip?: boolean }) => Promise<{ ok: boolean; servers: ServerEntry[] }>
      findPlayerServer: (payload: { placeId: string | number; username: string }) => Promise<{ ok: boolean; server: ServerEntry | null }>
      addFavoriteGame: (payload: {
        name: string
        placeId: string | number
        privateServer?: string
        imageUrl?: string
      }) => Promise<{ ok: boolean; favoriteGames: FavoriteGame[] }>
      renameFavoriteGame: (payload: {
        placeId: string | number
        privateServer?: string
        name: string
      }) => Promise<{ ok: boolean; favoriteGames: FavoriteGame[] }>
      removeFavoriteGame: (payload: {
        placeId: string | number
        privateServer?: string
      }) => Promise<{ ok: boolean; favoriteGames: FavoriteGame[] }>
      getOutfits: (payload: { username: string }) => Promise<{ ok: boolean; items: OutfitEntry[] }>
      getOutfitDetails: (payload: { outfitId: string | number }) => Promise<{ ok: boolean; details: unknown; json: string }>
      wearAvatarJson: (payload: { username: string; json: string }) => Promise<{
        ok: boolean
        message: string
        invalidAssetIds?: number[]
      }>
      wearOutfit: (payload: { username: string; outfitId: string | number }) => Promise<{
        ok: boolean
        message: string
        invalidAssetIds?: number[]
      }>
      getAssetDetails: (payload: { assetId: string | number }) => Promise<{ ok: boolean; asset: AssetEntry }>
      purchaseAsset: (payload: { username: string; assetId: string | number }) => Promise<{ ok: boolean; message: string }>
      loadControlState: () => Promise<{
        ok: boolean
        controlledAccounts: ControlledAccountEntry[]
        nexusSettings: NexusSettingsState
        server: NexusServerState
        dynamicElements: DynamicControlElement[]
      }>
      addControlledAccounts: (payload: { usernames: string[] }) => Promise<{
        ok: boolean
        message: string
        controlledAccounts: ControlledAccountEntry[]
        nexusSettings: NexusSettingsState
        server: NexusServerState
        dynamicElements: DynamicControlElement[]
      }>
      removeControlledAccounts: (payload: { usernames: string[] }) => Promise<{
        ok: boolean
        message: string
        controlledAccounts: ControlledAccountEntry[]
        nexusSettings: NexusSettingsState
        server: NexusServerState
        dynamicElements: DynamicControlElement[]
      }>
      updateControlledAccount: (payload: Partial<ControlledAccountEntry> & { username: string }) => Promise<{
        ok: boolean
        message: string
        controlledAccounts: ControlledAccountEntry[]
        nexusSettings: NexusSettingsState
        server: NexusServerState
        dynamicElements: DynamicControlElement[]
      }>
      saveAccountControlSetting: (payload: { key: string; value: string | boolean | number }) => Promise<{
        ok: boolean
        message: string
        controlledAccounts: ControlledAccountEntry[]
        nexusSettings: NexusSettingsState
        server: NexusServerState
        dynamicElements: DynamicControlElement[]
      }>
      getNexusLoader: () => Promise<{ ok: boolean; script: string; docsUrl: string; rawUrl: string }>
      writeNexusLoader: () => Promise<{ ok: boolean; message: string; path: string }>
      updateDynamicControl: (payload: { name: string; content: string }) => Promise<{
        ok: boolean
        controlledAccounts: ControlledAccountEntry[]
        nexusSettings: NexusSettingsState
        server: NexusServerState
        dynamicElements: DynamicControlElement[]
      }>
      triggerDynamicButton: (payload: { usernames?: string[]; name: string }) => Promise<{ ok: boolean; message: string }>
      startNexusServer: () => Promise<{ ok: boolean; message: string; server: NexusServerState }>
      stopNexusServer: () => Promise<{ ok: boolean; message: string; server: NexusServerState }>
      sendControlCommand: (payload: {
        usernames?: string[]
        name: string
        payload?: Record<string, string>
      }) => Promise<{ ok: boolean; message: string }>
      sendControlScript: (payload: { usernames?: string[]; script: string }) => Promise<{ ok: boolean; message: string }>
      accountTool: (payload: {
        username: string
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
          | 'quick_login'
        value?: string
      }) => Promise<{ ok: boolean; message: string; data?: unknown }>
      getAccountDiagnostics: (payload: { username: string }) => Promise<{
        ok: boolean
        message: string
        data?: {
          accountJson?: unknown
          userInfo?: unknown
          mobileInfo?: unknown
          emailInfo?: unknown
          robux?: number
          csrfToken?: string
        }
      }>
      debugLog: (payload: Record<string, unknown>) => Promise<boolean>
      performAction: (payload: {
        type: string
        accounts?: string[]
        url?: string
        script?: string
        placeId?: string | number
        jobId?: string
        followUser?: boolean
        followUserId?: string | number
        joinVip?: boolean
        browserMode?: 'standard' | 'groupJoin'
        useOldJoin?: boolean
        isTeleport?: boolean
        currentVersion?: string
      }) => Promise<{ ok: boolean; message: string }>
      copyText: (payload: { text: string; label?: string }) => Promise<{ ok: boolean; message: string }>
    }
  }
}
