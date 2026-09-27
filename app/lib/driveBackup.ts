import { google } from "googleapis"

// Least-privilege scope: the service account can only see/manage files
// IT created. Even if the key leaked, it cannot read the rest of your Drive.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

export function isDriveConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID)
}

function getDrive() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  let creds: any
  try {
    creds = JSON.parse(raw)
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON")
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email / private_key")
  }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [DRIVE_SCOPE],
  })
  return google.drive({ version: "v3", auth })
}

/** Upload the backup JSON into the shared Drive folder. Returns the file's id/name/link. */
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

/** Keep the newest `keep` backups in the Drive folder, trash-delete the rest. */
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
