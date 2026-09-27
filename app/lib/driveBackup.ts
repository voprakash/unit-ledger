import { google } from "googleapis"

// User-OAuth mode: the app acts as YOU (stored refresh token), so backups land
// in your own Drive under your own quota. (The service-account approach was
// retired: Google gives new service accounts zero Drive quota, so they cannot
// own files at all.)
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

export function driveRedirectUri(req: Request): string {
  return new URL(req.url).origin + "/api/admin/drive/callback"
}

/** OAuth client id+secret are present (prerequisite for the Connect button). */
export function hasDriveClient(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
}

/** Fully ready: client + refresh token + folder. Weekly uploads are active. */
export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID
  )
}

export function driveAuthUrl(req: Request, state: string): string {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    driveRedirectUri(req)
  )
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // guarantees a refresh token on every grant
    scope: [DRIVE_SCOPE],
    state,
  })
}

export async function exchangeCodeForRefreshToken(req: Request, code: string): Promise<string | null> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    driveRedirectUri(req)
  )
  const { tokens } = await oauth2.getToken(code)
  return tokens.refresh_token || null
}

function getDrive() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (!id || !secret || !refresh) return null
  const oauth2 = new google.auth.OAuth2(id, secret)
  oauth2.setCredentials({ refresh_token: refresh })
  return google.drive({ version: "v3", auth: oauth2 })
}

/** Upload the backup JSON into your Drive folder. Returns the file's id/name/link. */
export async function uploadBackupToDrive(fileName: string, json: string) {
  const drive = getDrive()
  if (!drive) throw new Error("Google Drive is not configured")
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID!
  const res: any = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId], mimeType: "application/json" },
    media: { mimeType: "application/json", body: json },
    fields: "id,name,webViewLink,createdTime",
  })
  return res.data as { id: string; name: string; webViewLink?: string; createdTime?: string }
}

/** Keep the newest `keep` backups in the Drive folder, delete the rest. */
export async function pruneDriveBackups(keep = 8) {
  const drive = getDrive()
  if (!drive) throw new Error("Google Drive is not configured")
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID!
  const res: any = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and name contains 'ledger-backup-'`,
    orderBy: "createdTime desc",
    pageSize: 100,
    fields: "files(id,name,createdTime)",
  })
  const files: any[] = res.data.files || []
  const toDelete = files.slice(keep)
  for (const f of toDelete) {
    try {
      await drive.files.delete({ fileId: f.id })
    } catch {
      /* keep going */
    }
  }
  return { total: files.length, deleted: toDelete.length, kept: files.length - toDelete.length }
}
