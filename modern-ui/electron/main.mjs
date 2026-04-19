import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import sodium from 'libsodium-wrappers-sumo'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { WebSocketServer } from 'ws'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const windowsPowerShellPath = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const ramHeader = Buffer.from([
  82, 111, 98, 108, 111, 120, 32, 65, 99, 99, 111, 117, 110, 116, 32, 77, 97, 110, 97, 103, 101, 114, 32,
  99, 114, 101, 97, 116, 101, 100, 32, 98, 121, 32, 105, 99, 51, 119, 48, 108, 102, 50, 50, 32, 64, 32,
  103, 105, 116, 104, 117, 98, 46, 99, 111, 109, 32, 46, 46, 46, 46, 46, 46, 46,
])
const entropy = [
  0x52, 0x4f, 0x42, 0x4c, 0x4f, 0x58, 0x20, 0x41, 0x43, 0x43, 0x4f, 0x55, 0x4e, 0x54, 0x20, 0x4d, 0x41,
  0x4e, 0x41, 0x47, 0x45, 0x52, 0x20, 0x7c, 0x20, 0x3a, 0x29, 0x20, 0x7c, 0x20, 0x42, 0x52, 0x4f, 0x55,
  0x47, 0x48, 0x54, 0x20, 0x54, 0x4f, 0x20, 0x59, 0x4f, 0x55, 0x20, 0x42, 0x55, 0x59, 0x20, 0x69, 0x63,
  0x33, 0x77, 0x30, 0x6c, 0x66,
]
const saveFilePath = path.join(repoRoot, 'AccountData.json')
const settingsFilePath = path.join(repoRoot, 'RAMSettings.ini')
const recentGamesFilePath = path.join(repoRoot, 'RecentGames.json')
const favoriteGamesFilePath = path.join(repoRoot, 'FavoriteGames.json')
const accountControlFilePath = path.join(repoRoot, 'AccountControlData.json')
const nexusBootstrapPath = path.join(repoRoot, 'Nexus.lua')
const debugLogPath = path.join(repoRoot, 'modern-ui', 'debug.log')

const accountStoreState = {
  mode: 'missing',
  password: null,
  rawAccounts: [],
}
const nexusState = {
  server: null,
  autoRelaunchTimer: null,
  clients: new Map(),
  logs: [],
  dynamicElements: [],
}
const auxiliaryWindows = new Set()
const nexusLoaderScript = `Nexus_Version = 104

local FileName, Success, Error, Function = 'ic3w0lf22.Nexus.lua'

if isfile and readfile and isfile(FileName) then -- Execute ASAP, update later.
\tFunction, Error = loadstring(readfile(FileName), 'Nexus')

\tif Function then
\t\tFunction()

\t\tif Nexus then Nexus:Connect() end
\tend
end

for i=1, 10 do
\tSuccess, Error = pcall(function()
\t\tlocal Response = (http_request or (syn and syn.request)) { Method = 'GET', Url = 'https://raw.githubusercontent.com/ic3w0lf22/Roblox-Account-Manager/master/RBX%20Alt%20Manager/Nexus/Nexus.lua' }

\t\tif not Response.Success then error(('HTTP Error %s'):format(Response.StatusCode)) end

\t\tFunction, Error = loadstring(Response.Body, 'Nexus')

\t\tif not Function then error(Error) end

\t\tif isfile and not isfile(FileName) then
\t\t\twritefile(FileName, Response.Body)
\t\tend
\t\t
\t\tif not Nexus then -- Nexus was already ran earlier, this will update the existing file to the latest version instead of re-creating Nexus
\t\t\tFunction()
\t\t\tNexus:Connect()
\t\tend
\tend)
\t
\tif Success then break else task.wait(1) end
end

if not Success and Error then
\t(messagebox or print)(('Nexus encountered an error while launching!\\n\\n%s'):format(Error), 'Roblox Account Manager', 0)
end`

function writeDebugLog(message, extra = undefined) {
  const line = `[${new Date().toISOString()}] ${message}${extra !== undefined ? ` ${JSON.stringify(extra)}` : ''}\n`
  try {
    fs.appendFileSync(debugLogPath, line, 'utf8')
  } catch {}
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#081120',
    title: 'Roblox Account Manager Modern',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    writeDebugLog('createWindow.loadURL', { devServerUrl })
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    writeDebugLog('createWindow.loadFile', { file: path.resolve(__dirname, '../dist/index.html') })
    mainWindow.loadFile(path.resolve(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    writeDebugLog('windowOpen', { url })
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    writeDebugLog('main.did-finish-load')
    void mainWindow.webContents
      .executeJavaScript('typeof window.desktopBridge', true)
      .then((result) => writeDebugLog('main.bridge-check', { result }))
      .catch((error) => writeDebugLog('main.bridge-check-error', { message: error?.message ?? String(error) }))
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
    writeDebugLog('main.did-fail-load', { code, description, validatedURL })
  })
}

function parseIni(content) {
  const data = {}
  let currentSection = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1)
      data[currentSection] = data[currentSection] ?? {}
      continue
    }

    if (!currentSection) continue
    const splitIndex = line.indexOf('=')
    if (splitIndex < 0) continue

    const key = line.slice(0, splitIndex).trim()
    const value = line.slice(splitIndex + 1).trim()
    data[currentSection][key] = value
  }

  return data
}

function serializeIni(data) {
  return Object.entries(data)
    .map(([section, values]) => {
      const body = Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')
      return `[${section}]\n${body}`
    })
    .join('\n\n')
}

function normalizeAccount(account) {
  return {
    username: account.Username,
    alias: account._Alias ?? account.Alias ?? '',
    description: account._Description ?? account.Description ?? '',
    group: account.Group ?? 'Default',
    userId: account.UserID ?? 0,
    lastUse: account.LastUse ?? null,
    lastAttemptedRefresh: account.LastAttemptedRefresh ?? null,
    hasPassword: !!account._Password,
    hasSecurityToken: !!account.SecurityToken,
    fields: account.Fields ?? {},
  }
}

function normalizeRecentGame(game) {
  return {
    placeId: game?.Details?.placeId ?? 0,
    name: game?.Details?.name ?? 'Unknown',
    filteredName: game?.Details?.filteredName ?? game?.Details?.name ?? 'Unknown',
    imageUrl: game?.ImageUrl ?? '',
  }
}

function sanitizeGameName(name) {
  return String(name ?? 'Unknown')
    .replace(/[\s]?\[[^\]]*\][\s]?/g, ' ')
    .replace(/[^a-zA-Z0-9% ._]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeFavoriteGame(game) {
  const placeId = Number(game?.Details?.placeId ?? game?.PlaceID ?? 0)
  const name = game?.Name ?? game?.Details?.name ?? 'Unknown'
  return {
    name,
    filteredName: game?.Details?.filteredName ?? sanitizeGameName(name),
    placeId,
    privateServer: game?.PrivateServer ?? '',
    imageUrl: game?.ImageUrl ?? '',
  }
}

function readFavoriteGames() {
  if (!fs.existsSync(favoriteGamesFilePath)) return []

  try {
    return JSON.parse(fs.readFileSync(favoriteGamesFilePath, 'utf8')).map(normalizeFavoriteGame)
  } catch {
    return []
  }
}

function saveFavoriteGames(favorites) {
  const legacyFavorites = favorites.map((favorite) => ({
    Name: favorite.name,
    PrivateServer: favorite.privateServer ?? '',
    PlaceID: favorite.placeId,
    ImageUrl: favorite.imageUrl ?? '',
    Details: {
      placeId: favorite.placeId,
      name: favorite.name,
      filteredName: favorite.filteredName ?? sanitizeGameName(favorite.name),
    },
  }))

  fs.writeFileSync(favoriteGamesFilePath, JSON.stringify(legacyFavorites, null, 2), 'utf8')
  return legacyFavorites.map(normalizeFavoriteGame)
}

function pushNexusLog(message, details = undefined) {
  const line = {
    at: new Date().toISOString(),
    message,
    details: details ?? null,
  }
  nexusState.logs = [line, ...nexusState.logs].slice(0, 80)
  writeDebugLog(`nexus.${message}`, details)
}

function normalizeControlledAccount(entry) {
  return {
    username: String(entry?.Username ?? entry?.username ?? ''),
    autoExecute: String(entry?.AutoExecute ?? entry?.autoExecute ?? ''),
    placeId: String(entry?.PlaceId ?? entry?.placeId ?? ''),
    jobId: String(entry?.JobId ?? entry?.jobId ?? ''),
    relaunchDelay: Number(entry?.RelaunchDelay ?? entry?.relaunchDelay ?? 60),
    autoRelaunch: Boolean(entry?.AutoRelaunch ?? entry?.autoRelaunch ?? false),
    isChecked: Boolean(entry?.IsChecked ?? entry?.isChecked ?? true),
    clientCanReceive: Boolean(entry?.ClientCanReceive ?? entry?.clientCanReceive ?? true),
    status: String(entry?.Status ?? entry?.status ?? 'Disconnected'),
    lastPing: entry?.LastPing ?? entry?.lastPing ?? null,
    inGameJobId: String(entry?.InGameJobId ?? entry?.inGameJobId ?? ''),
  }
}

function toLegacyControlledAccount(entry) {
  return {
    Username: entry.username,
    AutoExecute: entry.autoExecute ?? '',
    PlaceId: entry.placeId ?? '',
    JobId: entry.jobId ?? '',
    RelaunchDelay: Number(entry.relaunchDelay ?? 60),
    AutoRelaunch: Boolean(entry.autoRelaunch),
    IsChecked: Boolean(entry.isChecked),
    ClientCanReceive: Boolean(entry.clientCanReceive),
  }
}

function readControlledAccounts() {
  if (!fs.existsSync(accountControlFilePath)) return []

  try {
    const parsed = JSON.parse(fs.readFileSync(accountControlFilePath, 'utf8'))
    return Array.isArray(parsed) ? parsed.map(normalizeControlledAccount).filter((entry) => entry.username) : []
  } catch {
    return []
  }
}

function saveControlledAccounts(entries) {
  const normalized = entries.map(normalizeControlledAccount)
  fs.writeFileSync(
    accountControlFilePath,
    JSON.stringify(normalized.map(toLegacyControlledAccount), null, 2),
    'utf8',
  )
  return normalized
}

function readAccountControlSettings() {
  const settings = readSettings()
  const accountControl = settings.AccountControl ?? {}
  return {
    allowExternalConnections: accountControl.AllowExternalConnections === 'true',
    nexusPort: Number(accountControl.NexusPort ?? 5242),
    relaunchDelay: Number(accountControl.RelaunchDelay ?? 60),
    launcherDelay: Number(accountControl.LauncherDelayNumber ?? 9),
    startOnLaunch: accountControl.StartOnLaunch === 'true',
    usePresence: accountControl.UsePresence === 'true',
  }
}

function serializeControlState() {
  const settings = readAccountControlSettings()
  const connectedUsernames = new Set([...nexusState.clients.keys()])
  return {
    controlledAccounts: readControlledAccounts().map((entry) => ({
      ...entry,
      status: connectedUsernames.has(entry.username) ? 'Connected' : entry.status || 'Disconnected',
      lastPing: nexusState.clients.get(entry.username)?.lastPing ?? entry.lastPing ?? null,
      inGameJobId: nexusState.clients.get(entry.username)?.inGameJobId ?? entry.inGameJobId ?? '',
    })),
    nexusSettings: settings,
    server: {
      running: Boolean(nexusState.server),
      host: settings.allowExternalConnections ? '0.0.0.0' : '127.0.0.1',
      port: settings.nexusPort,
      connectedCount: nexusState.clients.size,
      logEntries: nexusState.logs,
    },
    dynamicElements: nexusState.dynamicElements,
  }
}

function parseMetrics(value, count) {
  const numbers = String(value ?? '')
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item))

  return numbers.length === count ? numbers : null
}

function addDynamicElement(element) {
  if (element.kind !== 'newline' && nexusState.dynamicElements.some((entry) => entry.name === element.name)) {
    return
  }

  nexusState.dynamicElements = [
    ...nexusState.dynamicElements,
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      margin: [3, 2, 3, 3],
      size: [75, 22],
      ...element,
    },
  ]
}

function getDynamicElementText(name) {
  const element = nexusState.dynamicElements.find((entry) => entry.name === name)
  return String(element?.content ?? '')
}

function setDynamicElementValue(name, content) {
  nexusState.dynamicElements = nexusState.dynamicElements.map((entry) =>
    entry.name === name ? { ...entry, content: String(content ?? '') } : entry,
  )
}

function readSettings() {
  if (!fs.existsSync(settingsFilePath)) return {}
  return parseIni(fs.readFileSync(settingsFilePath, 'utf8'))
}

function saveSetting(section, key, value) {
  const ini = readSettings()
  ini[section] = ini[section] ?? {}
  ini[section][key] = String(value)
  fs.writeFileSync(settingsFilePath, serializeIni(ini), 'utf8')
  return ini
}

function loadRecentGames() {
  if (!fs.existsSync(recentGamesFilePath)) return []
  try {
    return JSON.parse(fs.readFileSync(recentGamesFilePath, 'utf8')).map(normalizeRecentGame)
  } catch {
    return []
  }
}

async function fetchPlaceIcons(placeIds) {
  const ids = [...new Set(placeIds.map((placeId) => Number(placeId)).filter((placeId) => Number.isFinite(placeId) && placeId > 0))]
  if (ids.length === 0) return new Map()

  const { response, text } = await fetchRoblox(
    `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${ids.join(',')}&returnPolicy=PlaceHolder&size=256x256&format=Png&isCircular=false`,
  )

  if (!response.ok) {
    throw new Error(text || `Failed to load place icons (${response.status}).`)
  }

  const payload = JSON.parse(text)
  const icons = new Map()

  for (const item of payload?.data ?? []) {
    icons.set(Number(item.targetId), item.imageUrl ?? '')
  }

  return icons
}

async function fetchAssetThumbnail(assetId) {
  const { response, text } = await fetchRoblox(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${Number(assetId)}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`,
  )

  if (!response.ok) return ''

  try {
    return JSON.parse(text)?.data?.[0]?.imageUrl ?? ''
  } catch {
    return ''
  }
}

async function fetchOutfitThumbnails(outfitIds) {
  const ids = [...new Set(outfitIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))]
  if (ids.length === 0) return new Map()

  const { response, text } = await fetchRoblox(
    `https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${ids.join(',')}&size=420x420&format=Png&isCircular=false`,
  )

  if (!response.ok) return new Map()

  try {
    const payload = JSON.parse(text)
    return new Map((payload?.data ?? []).map((item) => [Number(item.targetId), item.imageUrl ?? '']))
  } catch {
    return new Map()
  }
}

async function loadUserOutfits(username) {
  const trimmedUsername = String(username ?? '').trim()
  if (!trimmedUsername) {
    throw new Error('Enter a Roblox username first.')
  }

  const userId = await resolveUserId(trimmedUsername)
  const { response, text } = await fetchRoblox(
    `https://avatar.roblox.com/v1/users/${userId}/outfits?page=1&itemsPerPage=50`,
    { headers: { Referer: 'https://www.roblox.com/' } },
  )

  if (!response.ok) {
    throw new Error(text || `Failed to load outfits for ${trimmedUsername}.`)
  }

  const payload = JSON.parse(text)
  const outfits = Array.isArray(payload?.data) ? payload.data : []
  const thumbnails = await fetchOutfitThumbnails(outfits.map((item) => item.id))

  return outfits.map((outfit) => ({
    id: Number(outfit.id ?? 0),
    name: String(outfit.name ?? `Outfit ${outfit.id ?? ''}`).trim(),
    imageUrl: thumbnails.get(Number(outfit.id ?? 0)) ?? '',
  }))
}

async function getOutfitDetails(outfitId) {
  const numericId = Number(outfitId)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('A valid outfit ID is required.')
  }

  const { response, text } = await fetchRoblox(`https://avatar.roblox.com/v1/outfits/${numericId}/details`, {
    headers: { Referer: 'https://www.roblox.com/' },
  })

  if (!response.ok) {
    throw new Error(text || `Failed to load outfit details (${response.status}).`)
  }

  return JSON.parse(text)
}

async function applyAvatarDetails(account, avatarDetails) {
  if (!account?.SecurityToken) {
    throw new Error(`${account?.Username ?? 'Selected account'} does not have a saved security token.`)
  }

  const csrfToken = await getCsrfToken(account.SecurityToken)

  if (avatarDetails?.playerAvatarType) {
    const response = await accountRequest(account, 'https://avatar.roblox.com/v1/avatar/set-player-avatar-type', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ playerAvatarType: avatarDetails.playerAvatarType }),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(text || 'Failed to set player avatar type.')
  }

  const scales = avatarDetails?.scales ?? avatarDetails?.scale ?? null
  if (scales) {
    const response = await accountRequest(account, 'https://avatar.roblox.com/v1/avatar/set-scales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify(scales),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(text || 'Failed to set avatar scales.')
  }

  if (avatarDetails?.bodyColors) {
    const response = await accountRequest(account, 'https://avatar.roblox.com/v1/avatar/set-body-colors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify(avatarDetails.bodyColors),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(text || 'Failed to set avatar body colors.')
  }

  if (Array.isArray(avatarDetails?.assets)) {
    const response = await accountRequest(account, 'https://avatar.roblox.com/v2/avatar/set-wearing-assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ assets: avatarDetails.assets }),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(text || 'Failed to set avatar assets.')
    return text ? JSON.parse(text) : {}
  }

  return {}
}

async function loadAssetDetails(assetId) {
  const numericId = Number(assetId)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('A valid asset ID is required.')
  }

  const { response, text } = await fetchRoblox(`https://economy.roblox.com/v2/assets/${numericId}/details`, {
    headers: { Referer: 'https://www.roblox.com/catalog/' },
  })

  if (!response.ok) {
    throw new Error(text || `Failed to load asset ${numericId}.`)
  }

  const details = JSON.parse(text)
  return {
    assetId: numericId,
    name: String(details?.Name ?? details?.name ?? `Asset ${numericId}`),
    description: String(details?.Description ?? details?.description ?? ''),
    imageUrl: await fetchAssetThumbnail(numericId),
    priceInRobux: Number(details?.PriceInRobux ?? details?.price ?? 0),
    isForSale: Boolean(details?.IsForSale ?? details?.isForSale ?? false),
    productId: Number(details?.ProductId ?? details?.productId ?? 0),
    creatorId: Number(details?.Creator?.Id ?? details?.creator?.id ?? details?.CreatorTargetId ?? 0),
    creatorName: String(details?.Creator?.Name ?? details?.creator?.name ?? ''),
  }
}

function normalizeGameSearchEntry(game) {
  const placeId = Number(game?.PlaceID ?? game?.placeId ?? game?.PlaceId ?? 0)
  const name = game?.Name ?? game?.name ?? 'Unknown'
  const upVotes = Number(game?.TotalUpVotes ?? game?.totalUpVotes ?? 0)
  const downVotes = Number(game?.TotalDownVotes ?? game?.totalDownVotes ?? 0)
  const totalVotes = upVotes + downVotes
  return {
    placeId,
    name,
    filteredName: sanitizeGameName(name),
    creatorName: game?.CreatorName ?? game?.creatorName ?? game?.creator?.name ?? '',
    playerCount: Number(game?.PlayerCount ?? game?.playerCount ?? game?.playing ?? 0),
    likeRatio: totalVotes > 0 ? Math.round((upVotes / totalVotes) * 100) : null,
    imageUrl: '',
  }
}

async function searchGames(query = '', page = 0) {
  const trimmedQuery = String(query ?? '').trim()
  if (!trimmedQuery) {
    return []
  }

  const requestedPage = Math.max(Number(page) || 0, 0)
  const sessionId = randomUUID()
  let pageToken = ''
  let payload = null

  for (let currentPage = 0; currentPage <= requestedPage; currentPage += 1) {
    const params = new URLSearchParams({
      searchQuery: trimmedQuery,
      pageToken,
      sessionId,
      pageType: 'SearchLanding',
    })

    const { response, text } = await fetchRoblox(`https://apis.roblox.com/search-api/omni-search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        Referer: `https://www.roblox.com/discover/?Keyword=${encodeURIComponent(trimmedQuery)}`,
      },
    })

    if (!response.ok) {
      writeDebugLog('searchGames.error', {
        query: trimmedQuery,
        page: requestedPage,
        status: response.status,
        bodyPreview: text.slice(0, 500),
      })
      throw new Error(`Roblox game search failed (${response.status}).`)
    }

    payload = JSON.parse(text)
    pageToken = String(payload?.nextPageToken ?? '')

    if (currentPage < requestedPage && !pageToken) {
      break
    }
  }

  const rawGames = Array.isArray(payload?.searchResults)
    ? payload.searchResults
        .filter((group) => String(group?.contentGroupType ?? '').toLowerCase() === 'game')
        .flatMap((group) => (Array.isArray(group?.contents) ? group.contents : []))
    : []

  const games = rawGames.map(normalizeGameSearchEntry).filter((game) => game.placeId > 0)
  const icons = await fetchPlaceIcons(games.map((game) => game.placeId))

  return games.map((game) => ({
    ...game,
    imageUrl: icons.get(game.placeId) ?? '',
  }))
}

function normalizeServerEntry(server) {
  return {
    id: server?.id ?? server?.name ?? '',
    playing: Number(server?.playing ?? 0),
    maxPlayers: Number(server?.maxPlayers ?? 0),
    ping: Number(server?.ping ?? 0),
    fps: server?.fps ? String(server.fps) : '',
    name: server?.name ?? '',
    vipServerId: Number(server?.vipServerId ?? 0),
    accessCode: server?.accessCode ?? '',
    type: server?.type ?? 'Public',
    playerTokens: Array.isArray(server?.playerTokens) ? server.playerTokens : [],
  }
}

async function fetchPublicServers(placeId) {
  const servers = []
  let cursor = ''
  let pageCount = 0

  while (pageCount < 40) {
    const cursorFragment = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    const { response, text } = await fetchRoblox(
      `https://games.roblox.com/v1/games/${placeId}/servers/public?sortOrder=Asc&limit=100${cursorFragment}`,
      { headers: { Accept: 'application/json' } },
    )

    if (!response.ok) {
      throw new Error(text || `Failed to load public servers (${response.status}).`)
    }

    const payload = JSON.parse(text)
    servers.push(...(payload?.data ?? []).map((server) => normalizeServerEntry({ ...server, type: 'Public' })))
    cursor = payload?.nextPageCursor ?? ''
    pageCount += 1

    if (!cursor) break
  }

  return servers
}

async function fetchVipServers(placeId, account) {
  if (!account?.SecurityToken) return []

  const servers = []
  let cursor = ''
  let pageCount = 0

  while (pageCount < 20) {
    const cursorFragment = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    const response = await accountRequest(account, `https://games.roblox.com/v1/games/${placeId}/servers/VIP?sortOrder=Asc&limit=25${cursorFragment}`, {
      headers: { Accept: 'application/json' },
    })
    const text = await response.text()

    if (!response.ok) {
      throw new Error(text || `Failed to load VIP servers (${response.status}).`)
    }

    const payload = JSON.parse(text)
    servers.push(
      ...(payload?.data ?? []).map((server) =>
        normalizeServerEntry({
          ...server,
          id: server?.name ?? server?.id ?? '',
          type: 'VIP',
        }),
      ),
    )
    cursor = payload?.nextPageCursor ?? ''
    pageCount += 1

    if (!cursor) break
  }

  return servers
}

async function loadServers(placeId, includeVip = true) {
  const numericPlaceId = Number(placeId)
  if (!Number.isFinite(numericPlaceId) || numericPlaceId <= 0) {
    throw new Error('A valid place ID is required.')
  }

  const { accounts } = await ensureAccountStoreLoaded()
  const primaryAccount = accounts.length > 0 ? findRawAccount(accounts[0].username) : null
  const [publicServers, vipServers] = await Promise.all([
    fetchPublicServers(numericPlaceId),
    includeVip ? fetchVipServers(numericPlaceId, primaryAccount) : Promise.resolve([]),
  ])

  return [...publicServers, ...vipServers]
}

async function findServerByPlayer(placeId, username) {
  const trimmedUsername = String(username ?? '').trim()
  if (!trimmedUsername) {
    throw new Error('Enter a username to search for.')
  }

  const userId = await resolveUserId(trimmedUsername)
  const avatarResponse = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?size=48x48&format=Png&userIds=${userId}`,
    { headers: { Referer: 'https://www.roblox.com/' } },
  )
  const avatarText = await avatarResponse.text()

  if (!avatarResponse.ok) {
    throw new Error(avatarText || `Failed to load avatar for ${trimmedUsername}.`)
  }

  const avatarPayload = JSON.parse(avatarText)
  const imageUrl = avatarPayload?.data?.[0]?.imageUrl
  if (!imageUrl) {
    throw new Error(`Failed to resolve avatar thumbnail for ${trimmedUsername}.`)
  }

  let cursor = ''
  let pageCount = 0

  while (pageCount < 40) {
    const cursorFragment = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    const { response, text } = await fetchRoblox(
      `https://games.roblox.com/v1/games/${placeId}/servers/public?sortOrder=Asc&limit=100${cursorFragment}`,
      { headers: { Accept: 'application/json' } },
    )

    if (!response.ok) {
      throw new Error(text || `Failed to scan servers (${response.status}).`)
    }

    const payload = JSON.parse(text)
    for (const server of payload?.data ?? []) {
      const tokens = Array.isArray(server?.playerTokens) ? server.playerTokens : []
      if (tokens.length === 0) continue

      const batchResponse = await fetch('https://thumbnails.roblox.com/v1/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'https://www.roblox.com/',
        },
        body: JSON.stringify(
          tokens.map((token) => ({
            requestId: `0:${token}:AvatarHeadshot:48x48:png:regular`,
            type: 'AvatarHeadShot',
            targetId: 0,
            token,
            format: 'png',
            size: '48x48',
          })),
        ),
      })
      const batchText = await batchResponse.text()
      if (!batchResponse.ok) continue

      const batchPayload = JSON.parse(batchText)
      if ((batchPayload?.data ?? []).some((avatar) => avatar.imageUrl === imageUrl)) {
        return normalizeServerEntry({ ...server, type: 'Public' })
      }
    }

    cursor = payload?.nextPageCursor ?? ''
    pageCount += 1
    if (!cursor) break
  }

  return null
}

async function decryptRamPayload(buffer, password) {
  await sodium.ready

  const salt = buffer.subarray(ramHeader.length, ramHeader.length + 16)
  const nonce = buffer.subarray(ramHeader.length + 16, ramHeader.length + 40)
  const cipherText = buffer.subarray(ramHeader.length + 40)
  const passwordHash = createHash('sha512').update(password, 'utf8').digest()
  const derivedKey = sodium.crypto_pwhash(
    32,
    passwordHash,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )

  const decrypted = sodium.crypto_secretbox_open_easy(cipherText, nonce, derivedKey)
  return Buffer.from(decrypted).toString('utf8')
}

async function encryptRamPayload(serialized, password) {
  await sodium.ready

  const salt = sodium.randombytes_buf(16)
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const passwordHash = createHash('sha512').update(password, 'utf8').digest()
  const derivedKey = sodium.crypto_pwhash(
    32,
    passwordHash,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )
  const cipherText = sodium.crypto_secretbox_easy(Buffer.from(serialized, 'utf8'), nonce, derivedKey)

  return Buffer.concat([
    ramHeader,
    Buffer.from(salt),
    Buffer.from(nonce),
    Buffer.from(cipherText),
  ])
}

async function dpapiTransform(buffer, mode, scope = 'CurrentUser') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ram-dpapi-'))
  const inputPath = path.join(tempDir, 'input.bin')
  const outputPath = path.join(tempDir, 'output.bin')
  const entropyLiteral = entropy.map((value) => `0x${value.toString(16).padStart(2, '0')}`).join(',')

  fs.writeFileSync(inputPath, Buffer.from(buffer))

  const script =
    mode === 'decrypt'
      ? [
          `$inputPath = '${inputPath.replace(/'/g, "''")}'`,
          `$outputPath = '${outputPath.replace(/'/g, "''")}'`,
          'Add-Type -AssemblyName System.Security',
          `$entropy = [byte[]](${entropyLiteral})`,
          '$bytes = [IO.File]::ReadAllBytes($inputPath)',
          `$decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, [System.Security.Cryptography.DataProtectionScope]::${scope})`,
          '[IO.File]::WriteAllBytes($outputPath, $decrypted)',
        ].join('; ')
      : [
          `$inputPath = '${inputPath.replace(/'/g, "''")}'`,
          `$outputPath = '${outputPath.replace(/'/g, "''")}'`,
          'Add-Type -AssemblyName System.Security',
          `$entropy = [byte[]](${entropyLiteral})`,
          '$bytes = [IO.File]::ReadAllBytes($inputPath)',
          `$encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, [System.Security.Cryptography.DataProtectionScope]::${scope})`,
          '[IO.File]::WriteAllBytes($outputPath, $encrypted)',
        ].join('; ')

  try {
    await execFileAsync(windowsPowerShellPath, ['-NoProfile', '-Command', script], { maxBuffer: 1024 * 1024 * 20 })
    return fs.readFileSync(outputPath)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

async function tryDpapiDecrypt(buffer) {
  try {
      return {
        decoded: (await dpapiTransform(buffer, 'decrypt', 'CurrentUser')).toString('utf8'),
        mode: 'dpapi-current-user',
      }
  } catch (currentUserError) {
    try {
      return {
        decoded: (await dpapiTransform(buffer, 'decrypt', 'LocalMachine')).toString('utf8'),
        mode: 'dpapi-local-machine',
      }
    } catch (localMachineError) {
      throw currentUserError ?? localMachineError
    }
  }
}

async function dpapiEncrypt(serialized, scope = 'LocalMachine') {
  return dpapiTransform(Buffer.from(serialized, 'utf8'), 'encrypt', scope)
}

async function readAccountStore(password = null) {
  if (!fs.existsSync(saveFilePath)) {
    return { mode: 'missing', locked: false, rawAccounts: [] }
  }

  const data = fs.readFileSync(saveFilePath)
  if (data.length === 0) {
    return { mode: 'empty', locked: false, rawAccounts: [] }
  }

  if (data.subarray(0, ramHeader.length).equals(ramHeader)) {
    const secret = password ?? accountStoreState.password
    if (!secret) {
      return { mode: 'password', locked: true, rawAccounts: [] }
    }

    const decoded = await decryptRamPayload(data, secret)
    return {
      mode: 'password',
      locked: false,
      rawAccounts: JSON.parse(decoded),
      password: secret,
    }
  }

  try {
    const dpapiResult = await tryDpapiDecrypt(data)
    return {
      mode: dpapiResult.mode,
      locked: false,
      rawAccounts: JSON.parse(dpapiResult.decoded),
    }
  } catch {
    return {
      mode: 'plain',
      locked: false,
      rawAccounts: JSON.parse(data.toString('utf8')),
    }
  }
}

async function loadAccountStore(password = null) {
  const result = await readAccountStore(password)
  accountStoreState.mode = result.mode
  accountStoreState.rawAccounts = result.rawAccounts
  accountStoreState.password = result.password ?? accountStoreState.password

  return {
    rawAccounts: result.rawAccounts,
    accounts: result.rawAccounts.map(normalizeAccount),
    locked: result.locked,
    source: result.mode,
  }
}

async function persistAccountStore(rawAccounts) {
  const serialized = JSON.stringify(rawAccounts, null, 2)
  if (accountStoreState.mode === 'missing' || accountStoreState.mode === 'empty') {
    accountStoreState.mode = 'plain'
  }
  let buffer = Buffer.from(serialized, 'utf8')

  if (accountStoreState.mode === 'password') {
    if (!accountStoreState.password) {
      throw new Error('Account store password is required before saving.')
    }
    buffer = await encryptRamPayload(serialized, accountStoreState.password)
  } else if (accountStoreState.mode === 'dpapi' || accountStoreState.mode === 'dpapi-local-machine') {
    buffer = await dpapiEncrypt(serialized, 'LocalMachine')
  } else if (accountStoreState.mode === 'dpapi-current-user') {
    buffer = await dpapiEncrypt(serialized, 'CurrentUser')
  }

  fs.writeFileSync(saveFilePath, buffer)
  accountStoreState.rawAccounts = rawAccounts

  return {
    accounts: rawAccounts.map(normalizeAccount),
    accountSource: accountStoreState.mode,
  }
}

async function ensureAccountStoreLoaded() {
  if (accountStoreState.mode === 'missing' || accountStoreState.mode === 'empty' || accountStoreState.rawAccounts.length > 0) {
    if (accountStoreState.mode === 'missing' || accountStoreState.mode === 'empty' || accountStoreState.rawAccounts.length > 0) {
      return {
        accounts: accountStoreState.rawAccounts.map(normalizeAccount),
        accountSource: accountStoreState.mode,
      }
    }
  }

  const result = await loadAccountStore()
  if (result.locked) {
    throw new Error('Account store is locked. Unlock it first.')
  }

  return {
    accounts: result.accounts,
    accountSource: result.source,
  }
}

function findRawAccount(username) {
  return accountStoreState.rawAccounts.find((account) => account.Username === username)
}

async function mutateAccounts(mutator) {
  await ensureAccountStoreLoaded()
  const next = structuredClone(accountStoreState.rawAccounts)
  const result = await mutator(next)
  const persisted = await persistAccountStore(next)

  return {
    ...persisted,
    result,
  }
}

async function fetchRoblox(endpoint, options = {}) {
  const response = await fetch(endpoint, options)
  const text = await response.text()
  return { response, text }
}

function getSetCookieValues(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie()
  }

  const value = response.headers.get('set-cookie')
  return value ? [value] : []
}

function extractCookieValue(response, name) {
  const match = getSetCookieValues(response)
    .join(';')
    .match(new RegExp(`${name}=([^;]+)`))
  return match?.[1] ?? null
}

async function resolveUserId(username) {
  const { response, text } = await fetchRoblox('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  })

  if (!response.ok) {
    throw new Error(text || `Failed to resolve username (${response.status}).`)
  }

  const payload = JSON.parse(text)
  const user = payload?.data?.[0]
  if (!user?.id) {
    throw new Error(`Failed to find Roblox user ${username}.`)
  }

  return user.id
}

async function accountRequest(account, url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Cookie: `.ROBLOSECURITY=${account.SecurityToken}`,
      Referer: 'https://www.roblox.com/',
      ...(options.headers ?? {}),
    },
  })
}

async function getCsrfToken(cookie) {
  const { response, text } = await fetchRoblox('https://auth.roblox.com/v1/authentication-ticket/', {
    method: 'POST',
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      Referer: 'https://www.roblox.com/games/4924922222/Brookhaven-RP',
    },
  })

  if (response.status !== 403) {
    throw new Error(text || `Failed to get X-CSRF token (${response.status}).`)
  }

  const token = response.headers.get('x-csrf-token')
  if (!token) {
    throw new Error('Roblox did not return an X-CSRF token.')
  }

  return token
}

async function getAuthenticationTicket(cookie) {
  const csrfToken = await getCsrfToken(cookie)
  const response = await fetch('https://auth.roblox.com/v1/authentication-ticket/', {
    method: 'POST',
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      Referer: 'https://www.roblox.com/games/4924922222/Brookhaven-RP',
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
      'X-CSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({}),
  })

  const ticket = response.headers.get('rbx-authentication-ticket')
  if (!ticket) {
    const text = await response.text()
    throw new Error(text || `Roblox did not return an authentication ticket (${response.status}).`)
  }

  return ticket
}

async function purchaseAssetForAccount(account, assetId) {
  if (!account?.SecurityToken) {
    throw new Error(`${account?.Username ?? 'Selected account'} does not have a saved security token.`)
  }

  const asset = await loadAssetDetails(assetId)
  if (!asset.isForSale || !asset.productId || !asset.creatorId) {
    throw new Error(`${asset.name} is not currently available to purchase.`)
  }

  const csrfToken = await getCsrfToken(account.SecurityToken)
  const response = await accountRequest(account, `https://economy.roblox.com/v1/purchases/products/${asset.productId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({
      expectedCurrency: 1,
      expectedPrice: asset.priceInRobux,
      expectedSellerId: asset.creatorId,
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(text || `Failed to purchase ${asset.name}.`)
  }

  const payload = text ? JSON.parse(text) : {}
  if (payload?.purchased === false) {
    throw new Error(payload?.reason || payload?.errorMsg || `Roblox rejected the purchase for ${asset.name}.`)
  }

  return {
    ok: true,
    message: `Purchased ${asset.name}.`,
    asset,
    payload,
  }
}

function sendNexusCommand(usernames, name, payload = {}) {
  const targets = usernames
    .map((username) => nexusState.clients.get(username))
    .filter(Boolean)

  if (targets.length === 0) {
    throw new Error('No linked Nexus clients are connected.')
  }

  const message = JSON.stringify({ Name: name, Payload: payload })
  for (const target of targets) {
    target.socket.send(message)
  }
  pushNexusLog('command.sent', { name, count: targets.length })
  return targets.length
}

function sendNexusRawMessage(usernames, message, options = {}) {
  const targets = options.toAll
    ? [...nexusState.clients.values()]
    : usernames
        .map((username) => nexusState.clients.get(username))
        .filter(Boolean)

  if (targets.length === 0) {
    throw new Error('No linked Nexus clients are connected.')
  }

  for (const target of targets) {
    target.socket.send(String(message))
  }

  pushNexusLog('raw.sent', { message: String(message).slice(0, 120), count: targets.length, toAll: Boolean(options.toAll) })
  return targets.length
}

async function relaunchControlledAccountsIfNeeded() {
  const controlledAccounts = readControlledAccounts()
  if (controlledAccounts.length === 0) return

  await ensureAccountStoreLoaded()
  const settings = readAccountControlSettings()
  const launcherDelay = Math.max((Number.isFinite(settings.launcherDelay) ? settings.launcherDelay : 9) * 1000, 1000)

  for (const controlledAccount of controlledAccounts) {
    if (!controlledAccount.autoRelaunch || !controlledAccount.placeId) continue

    const clientState = nexusState.clients.get(controlledAccount.username)
    const lastPing = clientState?.lastPing ?? controlledAccount.lastPing
    const relaunchDelay = Math.max(Number(controlledAccount.relaunchDelay || settings.relaunchDelay || 60), 5)
    const stale = !lastPing || Date.now() - new Date(lastPing).getTime() > relaunchDelay * 1000
    if (!stale) continue

    const account = findRawAccount(controlledAccount.username)
    if (!account?.SecurityToken) continue

    pushNexusLog('auto-relaunch.start', { username: controlledAccount.username, placeId: controlledAccount.placeId })
    try {
      await launchAccount(account, {
        placeId: controlledAccount.placeId,
        jobId: controlledAccount.jobId ?? '',
        joinVip: false,
        followUser: false,
      })
      const nextControlledAccounts = readControlledAccounts().map((entry) =>
        entry.username === controlledAccount.username ? { ...entry, lastPing: new Date().toISOString() } : entry,
      )
      saveControlledAccounts(nextControlledAccounts)
      pushNexusLog('auto-relaunch.success', { username: controlledAccount.username })
      await delay(launcherDelay)
    } catch (error) {
      pushNexusLog('auto-relaunch.error', {
        username: controlledAccount.username,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

function ensureAutoRelaunchTimer() {
  if (nexusState.autoRelaunchTimer) return

  nexusState.autoRelaunchTimer = setInterval(() => {
    void relaunchControlledAccountsIfNeeded().catch((error) =>
      pushNexusLog('auto-relaunch.tick-error', { message: error instanceof Error ? error.message : String(error) }),
    )
  }, 9000)
}

async function startNexusServer() {
  if (nexusState.server) {
    return serializeControlState().server
  }

  const settings = readAccountControlSettings()
  const port = Number.isFinite(settings.nexusPort) && settings.nexusPort > 0 ? settings.nexusPort : 5242
  const host = settings.allowExternalConnections ? '0.0.0.0' : '127.0.0.1'

  const server = new WebSocketServer({ host, port, path: '/Nexus' })
  nexusState.server = server
  ensureAutoRelaunchTimer()

  server.on('connection', (socket, request) => {
    const url = new URL(request.url ?? '/Nexus', `ws://${request.headers.host ?? `${host}:${port}`}`)
    const username = url.searchParams.get('name') ?? ''
    const socketState = {
      socket,
      username,
      clientId: url.searchParams.get('id') ?? '',
      lastPing: new Date().toISOString(),
      inGameJobId: url.searchParams.get('jobId') ?? '',
      autoExecuteSent: false,
    }

    if (username) {
      nexusState.clients.set(username, socketState)
    }
    pushNexusLog('client.connected', { username, clientId: socketState.clientId })

    const syncAccounts = () => {
      const nextAccounts = readControlledAccounts().map((entry) =>
        entry.username === username
          ? {
              ...entry,
              status: 'Connected',
              lastPing: socketState.lastPing,
              inGameJobId: socketState.inGameJobId,
            }
          : entry,
      )
      saveControlledAccounts(nextAccounts)
    }

    if (username) {
      syncAccounts()
    }

    socket.on('message', (rawMessage) => {
      const messageText = rawMessage.toString()
      socketState.lastPing = new Date().toISOString()

      try {
        const payload = JSON.parse(messageText)
        const commandName = payload?.Name ?? payload?.name ?? 'message'
        const body = payload?.Payload ?? payload?.payload ?? {}

        if (String(commandName).toLowerCase() === 'ping') {
          socketState.inGameJobId = String(body?.JobId ?? body?.jobId ?? socketState.inGameJobId ?? '')
          const controlled = readControlledAccounts().find((entry) => entry.username === username)
          if (controlled?.autoExecute && !socketState.autoExecuteSent) {
            socket.send(`execute ${controlled.autoExecute}`)
            socketState.autoExecuteSent = true
            pushNexusLog('autoexecute.sent', { username })
          }
        } else if (commandName === 'Log') {
          pushNexusLog('client.log', { username, content: body?.Content ?? '' })
        } else if (commandName === 'GetText') {
          socket.send(`ElementText:${getDynamicElementText(String(body?.Name ?? ''))}`)
        } else if (commandName === 'SetRelaunch') {
          const nextAccounts = readControlledAccounts().map((entry) =>
            entry.username === username
              ? { ...entry, relaunchDelay: Number.parseFloat(String(body?.Seconds ?? entry.relaunchDelay)) || entry.relaunchDelay }
              : entry,
          )
          saveControlledAccounts(nextAccounts)
        } else if (commandName === 'SetAutoRelaunch') {
          const nextAccounts = readControlledAccounts().map((entry) =>
            entry.username === username ? { ...entry, autoRelaunch: String(body?.Content ?? 'false') === 'true' } : entry,
          )
          saveControlledAccounts(nextAccounts)
        } else if (commandName === 'SetPlaceId') {
          const nextAccounts = readControlledAccounts().map((entry) =>
            entry.username === username ? { ...entry, placeId: String(body?.Content ?? entry.placeId ?? '') } : entry,
          )
          saveControlledAccounts(nextAccounts)
        } else if (commandName === 'SetJobId') {
          const nextAccounts = readControlledAccounts().map((entry) =>
            entry.username === username ? { ...entry, jobId: String(body?.Content ?? entry.jobId ?? '') } : entry,
          )
          saveControlledAccounts(nextAccounts)
        } else if (commandName === 'Echo' && body?.Content) {
          sendNexusRawMessage([], String(body.Content), { toAll: true })
        } else if (
          ['CreateButton', 'CreateTextBox', 'CreateNumeric', 'CreateLabel', 'NewLine'].includes(String(commandName))
        ) {
          const margin = parseMetrics(body?.Margin, 4) ?? [3, 2, 3, 3]
          const size = parseMetrics(body?.Size, 2) ?? [75, 22]

          if (commandName === 'NewLine') {
            addDynamicElement({ kind: 'newline', name: `newline-${Date.now()}` })
          } else if (body?.Name && body?.Content !== undefined) {
            addDynamicElement({
              kind:
                commandName === 'CreateButton'
                  ? 'button'
                  : commandName === 'CreateTextBox'
                    ? 'textbox'
                    : commandName === 'CreateNumeric'
                      ? 'numeric'
                      : 'label',
              name: String(body.Name),
              content: String(body.Content),
              margin,
              size,
              decimalPlaces: Number.parseInt(String(body?.DecimalPlaces ?? '0'), 10) || 0,
              increment: Number.parseFloat(String(body?.Increment ?? '1')) || 1,
            })
          }
        }

        if (username) {
          const nextAccounts = readControlledAccounts().map((entry) =>
            entry.username === username
              ? {
                  ...entry,
                  status: 'Connected',
                  lastPing: socketState.lastPing,
                  inGameJobId: socketState.inGameJobId,
                }
              : entry,
          )
          saveControlledAccounts(nextAccounts)
        }

        pushNexusLog('client.message', { username, commandName })
      } catch {
        pushNexusLog('client.message.raw', { username, messageText })
      }
    })

    socket.on('close', () => {
      if (username) {
        nexusState.clients.delete(username)
        const nextAccounts = readControlledAccounts().map((entry) =>
          entry.username === username ? { ...entry, status: 'Disconnected' } : entry,
        )
        saveControlledAccounts(nextAccounts)
      }
      pushNexusLog('client.closed', { username })
    })

    socket.on('error', (error) => {
      pushNexusLog('client.error', { username, message: error?.message ?? String(error) })
    })
  })

  server.on('listening', () => {
    pushNexusLog('server.started', { host, port })
  })

  server.on('error', (error) => {
    pushNexusLog('server.error', { message: error?.message ?? String(error) })
  })

  return await new Promise((resolve, reject) => {
    server.once('listening', () => resolve(serializeControlState().server))
    server.once('error', reject)
  })
}

async function stopNexusServer() {
  if (!nexusState.server) {
    return serializeControlState().server
  }

  const server = nexusState.server
  nexusState.server = null
  for (const client of nexusState.clients.values()) {
    client.socket.close()
  }
  nexusState.clients.clear()

  await new Promise((resolve) => server.close(() => resolve()))
  pushNexusLog('server.stopped')
  return serializeControlState().server
}

function buildPlaceLauncherUrl({ placeId, jobId = '', followUser = false, joinVip = false, browserTrackerId }) {
  if (joinVip) {
    return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestPrivateGame&placeId=${placeId}&accessCode=${encodeURIComponent(jobId)}&linkCode=`
  }

  if (followUser) {
    return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestFollowUser&userId=${placeId}`
  }

  const jobFragment = jobId ? `Job&browserTrackerId=${browserTrackerId}&placeId=${placeId}&gameId=${encodeURIComponent(jobId)}` : `&browserTrackerId=${browserTrackerId}&placeId=${placeId}`
  return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame${jobFragment}&isPlayTogetherGame=false`
}

function buildLaunchUri(ticket, launcherUrl, browserTrackerId) {
  const launchTime = Math.floor(Date.now())
  return `roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${launchTime}+placelauncherurl:${encodeURIComponent(
    launcherUrl,
  )}+browsertrackerid:${browserTrackerId}+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp`
}

async function launchAccount(account, payload) {
  if (!account?.SecurityToken) {
    throw new Error(`${account?.Username ?? 'Selected account'} does not have a saved security token.`)
  }

  const placeId = Number(payload.placeId)
  if (!Number.isFinite(placeId) || placeId <= 0) {
    throw new Error('A valid place ID is required.')
  }

  const browserTrackerId = `${randomInt(100000, 175000)}${randomInt(100000, 900000)}`
  const ticket = await getAuthenticationTicket(account.SecurityToken)
  const launcherUrl = buildPlaceLauncherUrl({
    placeId,
    jobId: payload.jobId ?? '',
    followUser: payload.followUser === true,
    joinVip: payload.joinVip === true,
    browserTrackerId,
  })

  await shell.openExternal(buildLaunchUri(ticket, launcherUrl, browserTrackerId))
}

async function openBrowserForAccount(account, payload) {
  if (!account?.SecurityToken) {
    throw new Error(`${account?.Username ?? 'Selected account'} does not have a saved security token.`)
  }

  const browserPartition = `persist:ram-${account.Username.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${randomInt(1000, 9999)}`
  const browserWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    title: `${account._Alias || account.Username} Browser`,
    backgroundColor: '#0d1528',
    autoHideMenuBar: true,
    webPreferences: {
      partition: browserPartition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const browserSession = session.fromPartition(browserPartition)
  await browserSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb'] })
  await browserSession.cookies.set({
    url: 'https://www.roblox.com/',
    domain: '.roblox.com',
    path: '/',
    name: '.ROBLOSECURITY',
    value: account.SecurityToken,
    secure: true,
    httpOnly: true,
    sameSite: 'no_restriction',
  })

  const targetUrl = payload.url?.trim() || 'https://www.roblox.com/home'
  if (payload.script?.trim()) {
    browserWindow.webContents.on('did-finish-load', () => {
      void browserWindow.webContents.executeJavaScript(payload.script, true).catch(() => {})
    })
  }

  await browserWindow.loadURL(targetUrl)
}

async function importCookieAccount(cookie, password = '') {
  const trimmed = cookie.trim()
  if (!trimmed) {
    throw new Error('A cookie is required.')
  }

  const { response, text } = await fetchRoblox('https://www.roblox.com/my/account/json', {
    headers: {
      Cookie: `.ROBLOSECURITY=${trimmed}`,
      Referer: 'https://www.roblox.com/',
    },
  })

  if (!response.ok) {
    throw new Error(text || `Failed to validate cookie (${response.status}).`)
  }

  const accountJson = JSON.parse(text)
  if (!accountJson?.Name || !accountJson?.UserId) {
    throw new Error('Roblox returned an unexpected account payload.')
  }

  return mutateAccounts((accounts) => {
    if (accounts.some((account) => account.Username === accountJson.Name || account.UserID === accountJson.UserId)) {
      throw new Error(`${accountJson.Name} is already in the account list.`)
    }

    accounts.push({
      Valid: true,
      SecurityToken: trimmed,
      Username: accountJson.Name,
      LastUse: new Date().toISOString(),
      _Alias: '',
      _Description: '',
      _Password: password,
      Group: 'Default',
      UserID: accountJson.UserId,
      Fields: {},
      LastAttemptedRefresh: new Date(0).toISOString(),
    })

    accounts.sort((left, right) => `${left.Group ?? 'Default'}:${left.Username}`.localeCompare(`${right.Group ?? 'Default'}:${right.Username}`))
  })
}

async function importCookieAndReload(cookie, password = '') {
  await importCookieAccount(cookie, password)
  const loaded = await ensureAccountStoreLoaded()
  return {
    ok: true,
    message: 'Account imported successfully.',
    accounts: loaded.accounts,
    accountSource: loaded.accountSource,
  }
}

async function startInteractiveAccountLogin({ mode, username = '', password = '' }) {
  writeDebugLog('login.start', { mode, hasUsername: Boolean(username), hasPassword: Boolean(password) })
  const loginPartition = `persist:ram-login-${Date.now()}-${randomInt(1000, 9999)}`
  const loginWindow = new BrowserWindow({
    width: 1120,
    height: 860,
    title: mode === 'credentials' ? 'Add Account (User/Pass)' : 'Add Account (Browser Login)',
    backgroundColor: '#0d1528',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      partition: loginPartition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  auxiliaryWindows.add(loginWindow)
  writeDebugLog('login.window-created', { partition: loginPartition })
  loginWindow.show()
  loginWindow.focus()

  const loginSession = session.fromPartition(loginPartition)
  await loginSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb'] })
  writeDebugLog('login.storage-cleared', { partition: loginPartition })

  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (callback) => {
      if (settled) return
      settled = true
      callback()
    }

    const cleanup = () => {
      loginWindow.webContents.removeListener('did-finish-load', handleDidFinishLoad)
      loginWindow.webContents.removeListener('did-navigate', handleNavigation)
      loginWindow.removeListener('closed', handleClosed)
      auxiliaryWindows.delete(loginWindow)
      writeDebugLog('login.cleanup')
    }

    const tryImportFromCookies = async () => {
      const cookies = await loginSession.cookies.get({ domain: '.roblox.com', name: '.ROBLOSECURITY' })
      const cookie = cookies[0]?.value
      if (!cookie) return false

      try {
        const result = await importCookieAndReload(cookie, password)
        finish(() => {
          cleanup()
          resolve(result)
        })
        if (!loginWindow.isDestroyed()) loginWindow.close()
        return true
      } catch (error) {
        finish(() => {
          cleanup()
          reject(error)
        })
        if (!loginWindow.isDestroyed()) loginWindow.close()
        return true
      }
    }

    const handleDidFinishLoad = () => {
      writeDebugLog('login.did-finish-load', { mode })
      if (mode !== 'credentials') return
      const safeUsername = JSON.stringify(username)
      const safePassword = JSON.stringify(password)
      void loginWindow.webContents
        .executeJavaScript(
          `
          (() => {
            const user = document.querySelector('#login-username');
            const pass = document.querySelector('#login-password');
            if (user) {
              user.focus();
              user.value = ${safeUsername};
              user.dispatchEvent(new Event('input', { bubbles: true }));
              user.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (pass) {
              pass.value = ${safePassword};
              pass.dispatchEvent(new Event('input', { bubbles: true }));
              pass.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const button = document.querySelector('#login-button');
            if (button) {
              button.click();
            }
          })();
          `,
          true,
        )
        .catch(() => {})
    }

    const handleNavigation = async (_event, url) => {
      writeDebugLog('login.navigation', { mode, url })
      if (url.includes('/home') || url.includes('/my/account')) {
        await tryImportFromCookies()
      }
    }

    const handleClosed = () => {
      writeDebugLog('login.closed')
      finish(() => {
        cleanup()
        resolve({
          ok: false,
          message: 'Account login window was closed before an account was imported.',
        })
      })
    }

    loginWindow.webContents.on('did-finish-load', handleDidFinishLoad)
    loginWindow.webContents.on('did-navigate', handleNavigation)
    loginWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
      writeDebugLog('login.did-fail-load', { code, description, validatedURL })
    })
    loginWindow.once('ready-to-show', () => {
      writeDebugLog('login.ready-to-show')
      loginWindow.show()
      loginWindow.focus()
    })
    loginWindow.on('closed', handleClosed)

    writeDebugLog('login.load-url', { url: 'https://www.roblox.com/login' })
    void loginWindow.loadURL('https://www.roblox.com/login').then(() => {
      writeDebugLog('login.load-url-resolved')
      loginWindow.show()
      loginWindow.focus()
    }).catch((error) => {
      writeDebugLog('login.load-url-error', { message: error?.message ?? String(error) })
      finish(() => {
        cleanup()
        reject(error)
      })
    })
  })
}

async function getAccountDiagnostics(account) {
  const [accountJsonRes, userInfoRes, mobileInfoRes, emailInfoRes, csrfToken] = await Promise.all([
    fetchRoblox('https://www.roblox.com/my/account/json', {
      headers: {
        Cookie: `.ROBLOSECURITY=${account.SecurityToken}`,
        Referer: 'https://www.roblox.com/',
      },
    }),
    fetchRoblox(`https://users.roblox.com/v1/users/${account.UserID}`, {
      headers: {
        Cookie: `.ROBLOSECURITY=${account.SecurityToken}`,
        Referer: 'https://www.roblox.com/',
      },
    }),
    fetchRoblox('https://www.roblox.com/mobileapi/userinfo', {
      headers: {
        Cookie: `.ROBLOSECURITY=${account.SecurityToken}`,
        Referer: 'https://www.roblox.com/',
      },
    }),
    fetchRoblox('https://accountsettings.roblox.com/v1/email', {
      headers: {
        Cookie: `.ROBLOSECURITY=${account.SecurityToken}`,
        Referer: 'https://www.roblox.com/',
      },
    }),
    getCsrfToken(account.SecurityToken),
  ])

  const accountJson = accountJsonRes.text ? JSON.parse(accountJsonRes.text) : null
  const userInfo = userInfoRes.text ? JSON.parse(userInfoRes.text) : null
  const mobileInfo = mobileInfoRes.text ? JSON.parse(mobileInfoRes.text) : null
  const emailInfo = emailInfoRes.text ? JSON.parse(emailInfoRes.text) : null

  return {
    accountJson,
    userInfo,
    mobileInfo,
    emailInfo,
    robux: mobileInfo?.RobuxBalance ?? 0,
    csrfToken,
  }
}

async function runAccountTool(account, payload) {
  switch (payload.action) {
    case 'get_cookie':
      return { ok: true, message: 'Cookie retrieved.', data: { cookie: account.SecurityToken } }
    case 'get_csrf': {
      const token = await getCsrfToken(account.SecurityToken)
      return { ok: true, message: 'CSRF token retrieved.', data: { csrfToken: token } }
    }
    case 'send_friend_request': {
      const userId = await resolveUserId(String(payload.value ?? '').trim())
      const token = await getCsrfToken(account.SecurityToken)
      const response = await accountRequest(account, `https://friends.roblox.com/v1/users/${userId}/request-friendship`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
        },
      })
      if (!response.ok) throw new Error(await response.text())
      return { ok: true, message: `Friend request sent to ${payload.value}.` }
    }
    case 'set_display_name': {
      const token = await getCsrfToken(account.SecurityToken)
      const response = await accountRequest(account, `https://users.roblox.com/v1/users/${account.UserID}/display-names`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
        },
        body: JSON.stringify({ newDisplayName: payload.value ?? '' }),
      })
      const text = await response.text()
      if (!response.ok) throw new Error(text || 'Failed to set display name.')
      return { ok: true, message: `Display name updated to ${payload.value}.`, data: text ? JSON.parse(text) : undefined }
    }
    case 'set_follow_privacy': {
      const map = ['All', 'Followers', 'Following', 'Friends', 'NoOne']
      const privacyValue = map[Number(payload.value ?? 0)] ?? 'All'
      const token = await getCsrfToken(account.SecurityToken)
      const response = await accountRequest(account, 'https://www.roblox.com/account/settings/follow-me-privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-TOKEN': token,
          Referer: 'https://www.roblox.com/my/account',
        },
        body: `FollowMePrivacy=${encodeURIComponent(privacyValue)}`,
      })
      if (!response.ok) throw new Error(await response.text())
      return { ok: true, message: `Follow privacy set to ${privacyValue}.` }
    }
    case 'unlock_pin': {
      const token = await getCsrfToken(account.SecurityToken)
      const response = await accountRequest(account, 'https://auth.roblox.com/v1/account/pin/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-TOKEN': token,
          Referer: 'https://www.roblox.com/',
        },
        body: `pin=${encodeURIComponent(payload.value ?? '')}`,
      })
      const text = await response.text()
      if (!response.ok) throw new Error(text || 'Failed to unlock pin.')
      return { ok: true, message: 'Pin unlock attempted.', data: text ? JSON.parse(text) : undefined }
    }
    case 'logout_other_sessions': {
      const token = await getCsrfToken(account.SecurityToken)
      const response = await accountRequest(account, 'https://www.roblox.com/authentication/signoutfromallsessionsandreauthenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-TOKEN': token,
        },
      })
      const text = await response.text()
      if (!response.ok) throw new Error(text || 'Failed to log out of other sessions.')
      const nextCookie = extractCookieValue(response, '.ROBLOSECURITY')
      if (nextCookie) {
        account.SecurityToken = nextCookie
      }
      return { ok: true, message: 'Logged out of other sessions.' }
    }
    case 'toggle_block': {
      const userId = await resolveUserId(String(payload.value ?? '').trim())
      const token = await getCsrfToken(account.SecurityToken)
      const blockedListResponse = await accountRequest(account, 'https://accountsettings.roblox.com/v1/users/get-detailed-blocked-users')
      const blockedText = await blockedListResponse.text()
      if (!blockedListResponse.ok) throw new Error(blockedText || 'Failed to obtain blocked users list.')
      const blockedData = blockedText ? JSON.parse(blockedText) : {}
      const isBlocked = Boolean(blockedData?.blockedUsers?.some((user) => Number(user.userId) === Number(userId)))
      const action = isBlocked ? 'unblock' : 'block'
      const response = await accountRequest(account, `https://accountsettings.roblox.com/v1/users/${userId}/${action}`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': token },
      })
      const text = await response.text()
      if (!response.ok) throw new Error(text || `Failed to ${action} user.`)
      return { ok: true, message: `${isBlocked ? 'Unblocked' : 'Blocked'} ${payload.value}.`, data: text ? JSON.parse(text) : undefined }
    }
    case 'get_blocked_list': {
      const response = await accountRequest(account, 'https://accountsettings.roblox.com/v1/users/get-detailed-blocked-users')
      const text = await response.text()
      if (!response.ok) throw new Error(text || 'Failed to load blocked list.')
      return { ok: true, message: 'Blocked list loaded.', data: text ? JSON.parse(text) : undefined }
    }
    case 'quick_login': {
      const token = await getCsrfToken(account.SecurityToken)
      const enterResponse = await accountRequest(account, 'https://apis.roblox.com/auth-token-service/v1/login/enterCode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
        },
        body: JSON.stringify({ code: payload.value ?? '' }),
      })
      const enterText = await enterResponse.text()
      if (!enterResponse.ok) throw new Error(enterText || 'Failed to submit quick login code.')
      const validateResponse = await accountRequest(account, 'https://apis.roblox.com/auth-token-service/v1/login/validateCode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
        },
        body: JSON.stringify({ code: payload.value ?? '' }),
      })
      const validateText = await validateResponse.text()
      if (!validateResponse.ok) throw new Error(validateText || 'Failed to validate quick login code.')
      return {
        ok: true,
        message: 'Quick login code validated.',
        data: {
          enter: enterText ? JSON.parse(enterText) : undefined,
          validate: validateText ? JSON.parse(validateText) : undefined,
        },
      }
    }
    default:
      throw new Error(`Unsupported account tool action: ${payload.action}`)
  }
}

ipcMain.handle('ram:load-state', async () => {
  writeDebugLog('ipc.load-state')
  const accountsResult = await loadAccountStore()
  return {
    accounts: accountsResult.accounts,
    accountsLocked: accountsResult.locked,
    accountSource: accountsResult.source,
    settings: readSettings(),
    recentGames: loadRecentGames(),
    favoriteGames: readFavoriteGames(),
  }
})

ipcMain.handle('ram:unlock-accounts', async (_event, password) => {
  writeDebugLog('ipc.unlock-accounts', { hasPassword: Boolean(password) })
  const accountsResult = await loadAccountStore(password)
  return {
    accounts: accountsResult.accounts,
    accountsLocked: accountsResult.locked,
    accountSource: accountsResult.source,
  }
})

ipcMain.handle('ram:save-setting', async (_event, payload) => {
  writeDebugLog('ipc.save-setting', payload)
  return saveSetting(payload.section, payload.key, payload.value)
})

ipcMain.handle('ram:update-account', async (_event, payload) => {
  writeDebugLog('ipc.update-account', payload)
  return mutateAccounts((accounts) => {
    const account = accounts.find((item) => item.Username === payload.username)
    if (!account) throw new Error('Account not found.')

    if (typeof payload.alias === 'string') {
      account._Alias = payload.alias
      account.Alias = payload.alias
    }

    if (typeof payload.description === 'string') {
      account._Description = payload.description
      account.Description = payload.description
    }

    if (typeof payload.group === 'string' && payload.group.trim()) {
      account.Group = payload.group.trim()
    }
  })
})

ipcMain.handle('ram:set-account-field', async (_event, payload) => {
  writeDebugLog('ipc.set-account-field', payload)
  return mutateAccounts((accounts) => {
    const account = accounts.find((item) => item.Username === payload.username)
    if (!account) throw new Error('Account not found.')
    account.Fields = account.Fields ?? {}
    account.Fields[payload.field] = payload.value
  })
})

ipcMain.handle('ram:remove-account-field', async (_event, payload) => {
  writeDebugLog('ipc.remove-account-field', payload)
  return mutateAccounts((accounts) => {
    const account = accounts.find((item) => item.Username === payload.username)
    if (!account) throw new Error('Account not found.')
    if (account.Fields) delete account.Fields[payload.field]
  })
})

ipcMain.handle('ram:remove-accounts', async (_event, usernames) => {
  writeDebugLog('ipc.remove-accounts', { usernames })
  return mutateAccounts((accounts) => {
    const targetNames = new Set(usernames)
    for (let index = accounts.length - 1; index >= 0; index -= 1) {
      if (targetNames.has(accounts[index].Username)) {
        accounts.splice(index, 1)
      }
    }
  })
})

ipcMain.handle('ram:import-cookie', async (_event, payload) => {
  writeDebugLog('ipc.import-cookie', { hasCookie: Boolean(payload.cookie), hasPassword: Boolean(payload.password) })
  return importCookieAccount(payload.cookie, payload.password ?? '')
})

ipcMain.handle('ram:import-cookies-bulk', async (_event, payload) => {
  writeDebugLog('ipc.import-cookies-bulk', { count: Array.isArray(payload?.cookies) ? payload.cookies.length : 0 })
  const cookies = Array.isArray(payload?.cookies) ? payload.cookies.map((value) => String(value).trim()).filter(Boolean) : []
  const results = []

  for (const cookie of cookies) {
    try {
      const result = await importCookieAccount(cookie, payload?.password ?? '')
      results.push({ ok: true, cookie: `${cookie.slice(0, 10)}...`, username: result.accounts.at(-1)?.username ?? '' })
    } catch (error) {
      results.push({
        ok: false,
        cookie: `${cookie.slice(0, 10)}...`,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    ok: true,
    results,
    ...(await ensureAccountStoreLoaded()),
  }
})

ipcMain.handle('ram:start-account-login', async (_event, payload) => {
  writeDebugLog('ipc.start-account-login', { mode: payload.mode, hasUsername: Boolean(payload.username), hasPassword: Boolean(payload.password) })
  return startInteractiveAccountLogin(payload)
})

ipcMain.handle('ram:search-games', async (_event, payload) => {
  writeDebugLog('ipc.search-games', payload)
  return {
    ok: true,
    games: await searchGames(payload?.query ?? '', payload?.page ?? 0),
  }
})

ipcMain.handle('ram:get-servers', async (_event, payload) => {
  writeDebugLog('ipc.get-servers', payload)
  return {
    ok: true,
    servers: await loadServers(payload?.placeId, payload?.includeVip !== false),
  }
})

ipcMain.handle('ram:find-player-server', async (_event, payload) => {
  writeDebugLog('ipc.find-player-server', payload)
  return {
    ok: true,
    server: await findServerByPlayer(payload?.placeId, payload?.username),
  }
})

ipcMain.handle('ram:add-favorite-game', async (_event, payload) => {
  writeDebugLog('ipc.add-favorite-game', payload)
  const favorites = readFavoriteGames()
  const placeId = Number(payload?.placeId)
  const privateServer = String(payload?.privateServer ?? '')

  if (!Number.isFinite(placeId) || placeId <= 0) {
    throw new Error('A valid place ID is required.')
  }

  if (favorites.some((favorite) => favorite.placeId === placeId && (favorite.privateServer ?? '') === privateServer)) {
    return { ok: true, favoriteGames: favorites }
  }

  const nextFavorites = saveFavoriteGames([
    ...favorites,
    {
      name: String(payload?.name ?? 'Unknown'),
      filteredName: sanitizeGameName(String(payload?.name ?? 'Unknown')),
      placeId,
      privateServer,
      imageUrl: String(payload?.imageUrl ?? ''),
    },
  ])

  return { ok: true, favoriteGames: nextFavorites }
})

ipcMain.handle('ram:rename-favorite-game', async (_event, payload) => {
  writeDebugLog('ipc.rename-favorite-game', payload)
  const favorites = readFavoriteGames()
  const placeId = Number(payload?.placeId)
  const privateServer = String(payload?.privateServer ?? '')
  const name = String(payload?.name ?? '').trim()

  if (!name) {
    throw new Error('A favorite name is required.')
  }

  const nextFavorites = favorites.map((favorite) =>
    favorite.placeId === placeId && (favorite.privateServer ?? '') === privateServer
      ? { ...favorite, name, filteredName: sanitizeGameName(name) }
      : favorite,
  )

  return { ok: true, favoriteGames: saveFavoriteGames(nextFavorites) }
})

ipcMain.handle('ram:remove-favorite-game', async (_event, payload) => {
  writeDebugLog('ipc.remove-favorite-game', payload)
  const placeId = Number(payload?.placeId)
  const privateServer = String(payload?.privateServer ?? '')
  const nextFavorites = readFavoriteGames().filter(
    (favorite) => !(favorite.placeId === placeId && (favorite.privateServer ?? '') === privateServer),
  )

  return { ok: true, favoriteGames: saveFavoriteGames(nextFavorites) }
})

ipcMain.handle('ram:get-outfits', async (_event, payload) => {
  writeDebugLog('ipc.get-outfits', payload)
  return {
    ok: true,
    items: await loadUserOutfits(payload?.username),
  }
})

ipcMain.handle('ram:get-outfit-details', async (_event, payload) => {
  writeDebugLog('ipc.get-outfit-details', payload)
  const details = await getOutfitDetails(payload?.outfitId)
  return {
    ok: true,
    details,
    json: JSON.stringify(details, null, 2),
  }
})

ipcMain.handle('ram:wear-outfit', async (_event, payload) => {
  writeDebugLog('ipc.wear-outfit', payload)
  await ensureAccountStoreLoaded()
  const account = findRawAccount(payload?.username)
  if (!account) {
    throw new Error('Select an account first.')
  }

  const details = await getOutfitDetails(payload?.outfitId)
  const result = await applyAvatarDetails(account, details)
  return {
    ok: true,
    message: `Applied ${details?.name ?? `outfit ${payload?.outfitId}`} to ${account.Username}.`,
    invalidAssetIds: Array.isArray(result?.invalidAssetIds) ? result.invalidAssetIds : [],
  }
})

ipcMain.handle('ram:get-asset-details', async (_event, payload) => {
  writeDebugLog('ipc.get-asset-details', payload)
  return {
    ok: true,
    asset: await loadAssetDetails(payload?.assetId),
  }
})

ipcMain.handle('ram:purchase-asset', async (_event, payload) => {
  writeDebugLog('ipc.purchase-asset', payload)
  await ensureAccountStoreLoaded()
  const account = findRawAccount(payload?.username)
  if (!account) {
    throw new Error('Select an account first.')
  }

  return await purchaseAssetForAccount(account, payload?.assetId)
})

ipcMain.handle('ram:load-control-state', async () => {
  writeDebugLog('ipc.load-control-state')
  return {
    ok: true,
    ...serializeControlState(),
  }
})

ipcMain.handle('ram:add-controlled-accounts', async (_event, payload) => {
  writeDebugLog('ipc.add-controlled-accounts', payload)
  const usernames = Array.isArray(payload?.usernames) ? payload.usernames.map((value) => String(value)) : []
  const existing = readControlledAccounts()
  const known = new Set(existing.map((entry) => entry.username))
  const nextAccounts = [
    ...existing,
    ...usernames
      .filter((username) => username && !known.has(username))
      .map((username) => ({
        username,
        autoExecute: '',
        placeId: '',
        jobId: '',
        relaunchDelay: readAccountControlSettings().relaunchDelay,
        autoRelaunch: false,
        isChecked: true,
        clientCanReceive: true,
        status: 'Disconnected',
        lastPing: null,
        inGameJobId: '',
      })),
  ]

  saveControlledAccounts(nextAccounts)
  return { ok: true, message: 'Linked controlled accounts updated.', ...serializeControlState() }
})

ipcMain.handle('ram:remove-controlled-accounts', async (_event, payload) => {
  writeDebugLog('ipc.remove-controlled-accounts', payload)
  const targetNames = new Set(Array.isArray(payload?.usernames) ? payload.usernames.map((value) => String(value)) : [])
  const nextAccounts = readControlledAccounts().filter((entry) => !targetNames.has(entry.username))
  saveControlledAccounts(nextAccounts)
  return { ok: true, message: 'Removed selected controlled accounts.', ...serializeControlState() }
})

ipcMain.handle('ram:update-controlled-account', async (_event, payload) => {
  writeDebugLog('ipc.update-controlled-account', payload)
  const username = String(payload?.username ?? '')
  if (!username) throw new Error('A controlled account username is required.')

  const nextAccounts = readControlledAccounts().map((entry) =>
    entry.username === username
      ? normalizeControlledAccount({
          ...entry,
          ...payload,
          username,
        })
      : entry,
  )
  saveControlledAccounts(nextAccounts)
  return { ok: true, message: `Saved control settings for ${username}.`, ...serializeControlState() }
})

ipcMain.handle('ram:save-account-control-setting', async (_event, payload) => {
  writeDebugLog('ipc.save-account-control-setting', payload)
  saveSetting('AccountControl', payload?.key, payload?.value)
  return { ok: true, message: 'Saved Nexus setting.', ...serializeControlState() }
})

ipcMain.handle('ram:get-nexus-loader', async () => {
  writeDebugLog('ipc.get-nexus-loader')
  return {
    ok: true,
    script: nexusLoaderScript,
    docsUrl: 'https://github.com/ic3w0lf22/Roblox-Account-Manager/blob/master/RBX%20Alt%20Manager/Nexus/NexusDocs.md',
    rawUrl: 'https://raw.githubusercontent.com/ic3w0lf22/Roblox-Account-Manager/master/RBX%20Alt%20Manager/Nexus/Nexus.lua',
  }
})

ipcMain.handle('ram:write-nexus-loader', async () => {
  writeDebugLog('ipc.write-nexus-loader')
  fs.writeFileSync(nexusBootstrapPath, nexusLoaderScript, 'utf8')
  return {
    ok: true,
    message: `Wrote Nexus.lua to ${nexusBootstrapPath}.`,
    path: nexusBootstrapPath,
  }
})

ipcMain.handle('ram:update-dynamic-control', async (_event, payload) => {
  writeDebugLog('ipc.update-dynamic-control', payload)
  setDynamicElementValue(String(payload?.name ?? ''), String(payload?.content ?? ''))
  return { ok: true, ...serializeControlState() }
})

ipcMain.handle('ram:trigger-dynamic-button', async (_event, payload) => {
  writeDebugLog('ipc.trigger-dynamic-button', payload)
  const usernames = Array.isArray(payload?.usernames) ? payload.usernames.map((value) => String(value)) : []
  const count = sendNexusRawMessage(usernames, `ButtonClicked:${String(payload?.name ?? '')}`)
  return { ok: true, message: `Sent button click to ${count} Nexus client${count === 1 ? '' : 's'}.` }
})

ipcMain.handle('ram:start-nexus-server', async () => {
  writeDebugLog('ipc.start-nexus-server')
  return {
    ok: true,
    message: 'Nexus server started.',
    server: await startNexusServer(),
  }
})

ipcMain.handle('ram:stop-nexus-server', async () => {
  writeDebugLog('ipc.stop-nexus-server')
  return {
    ok: true,
    message: 'Nexus server stopped.',
    server: await stopNexusServer(),
  }
})

ipcMain.handle('ram:send-control-command', async (_event, payload) => {
  writeDebugLog('ipc.send-control-command', payload)
  const targetUsernames = Array.isArray(payload?.usernames) && payload.usernames.length > 0
    ? payload.usernames.map((value) => String(value))
    : readControlledAccounts()
        .filter((entry) => entry.isChecked)
        .map((entry) => entry.username)

  const count = sendNexusCommand(targetUsernames, String(payload?.name ?? 'Command'), payload?.payload ?? {})
  return { ok: true, message: `Sent ${payload?.name ?? 'command'} to ${count} Nexus client${count === 1 ? '' : 's'}.` }
})

ipcMain.handle('ram:send-control-script', async (_event, payload) => {
  writeDebugLog('ipc.send-control-script', payload)
  const targetUsernames = Array.isArray(payload?.usernames) && payload.usernames.length > 0
    ? payload.usernames.map((value) => String(value))
    : readControlledAccounts()
        .filter((entry) => entry.isChecked)
        .map((entry) => entry.username)

  const count = sendNexusRawMessage(targetUsernames, `execute ${String(payload?.script ?? '')}`)
  return { ok: true, message: `Sent script to ${count} Nexus client${count === 1 ? '' : 's'}.` }
})

ipcMain.handle('ram:account-tool', async (_event, payload) => {
  writeDebugLog('ipc.account-tool', payload)
  await ensureAccountStoreLoaded()
  const account = findRawAccount(payload.username)
  if (!account) {
    throw new Error('Account not found.')
  }

  const result = await runAccountTool(account, payload)
  if (payload.action === 'logout_other_sessions') {
    await persistAccountStore(accountStoreState.rawAccounts)
  }
  return result
})

ipcMain.handle('ram:get-account-diagnostics', async (_event, payload) => {
  writeDebugLog('ipc.get-account-diagnostics', payload)
  await ensureAccountStoreLoaded()
  const account = findRawAccount(payload.username)
  if (!account) {
    throw new Error('Account not found.')
  }

  return {
    ok: true,
    message: 'Diagnostics loaded.',
    data: await getAccountDiagnostics(account),
  }
})

ipcMain.handle('ram:perform-action', async (_event, payload) => {
  writeDebugLog('ipc.perform-action', payload)
  await ensureAccountStoreLoaded()
  const selected = (payload.accounts ?? [])
    .map((username) => findRawAccount(username))
    .filter(Boolean)

  if (selected.length === 0) {
    return { ok: false, message: 'Select at least one account first.' }
  }

  if (payload.type === 'launch') {
    for (let index = 0; index < selected.length; index += 1) {
      await launchAccount(selected[index], payload)

      if (index < selected.length - 1) {
        const settings = readSettings()
        const joinDelay = Number(settings.General?.AccountJoinDelay ?? '8')
        await delay(Math.max(Number.isFinite(joinDelay) ? joinDelay * 1000 : 2000, 500))
      }
    }

    return {
      ok: true,
      message: `Launched ${selected.length} account${selected.length === 1 ? '' : 's'} into place ${payload.placeId}.`,
    }
  }

  if (payload.type === 'browser') {
    await Promise.all(selected.map((account) => openBrowserForAccount(account, payload)))
    return {
      ok: true,
      message: `Opened ${selected.length} logged-in browser window${selected.length === 1 ? '' : 's'}.`,
    }
  }

  return { ok: false, message: 'Unknown action.' }
})

ipcMain.handle('ram:debug-log', async (_event, payload) => {
  writeDebugLog(`renderer.${payload?.scope ?? 'unknown'}`, payload)
  return true
})

app.whenReady().then(() => {
  createWindow()
  if (readAccountControlSettings().startOnLaunch) {
    void startNexusServer().catch((error) =>
      pushNexusLog('server.start-on-launch-error', { message: error instanceof Error ? error.message : String(error) }),
    )
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  if (nexusState.autoRelaunchTimer) {
    clearInterval(nexusState.autoRelaunchTimer)
    nexusState.autoRelaunchTimer = null
  }

  if (nexusState.server) {
    for (const client of nexusState.clients.values()) {
      client.socket.close()
    }
    nexusState.server.close()
    nexusState.server = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
