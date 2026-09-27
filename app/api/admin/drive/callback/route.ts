import { NextResponse } from "next/server"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { exchangeCodeForRefreshToken } from "@/app/lib/driveBackup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function getCookie(req: Request, name: string): string | null {
  const h = req.headers.get("cookie") || ""
  const m = h.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"))
  return m ? decodeURIComponent(m[1]) : null
}

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{font-family:system-ui,-apple-system,sans-serif;background:#f5f6f8;margin:0;padding:24px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h1{font-size:18px;margin:0 0 12px}p{font-size:14px;color:#444;line-height:1.5}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:12px;margin:8px 0}
button{background:#000;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:700;font-size:14px;width:100%;cursor:pointer}
ol{font-size:14px;color:#444;line-height:1.7;padding-left:20px}
code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:12px}
.err{color:#b00;font-weight:700}
</style></head><body><div class="card">${body}</div>
<script>function copyTok(){var i=document.getElementById('tok');i.select();i.setSelectionRange(0,99999);document.execCommand('copy');var b=document.getElementById('cp');b.textContent='Copied ✓';}</script>
</body></html>`
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } })
}

// GET /api/admin/drive/callback -> Google redirects here after consent.
// Exchanges the code for a refresh token and shows it once so the admin can
// paste it into Vercel env vars. Nothing is stored server-side.
export async function GET(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  if (url.searchParams.get("error")) {
    return page(
      "Drive connect failed",
      `<h1 class="err">Google sign-in was not completed</h1><p>You declined or closed the Google consent screen. <a href="/api/admin/drive/connect">Try again</a>.</p>`
    )
  }
  const state = url.searchParams.get("state")
  const expected = getCookie(req, "drive_oauth_state")
  const code = url.searchParams.get("code")
  if (!state || !expected || state !== expected || !code) {
    return page(
      "Drive connect failed",
      `<h1 class="err">Invalid or expired request</h1><p>Please <a href="/api/admin/drive/connect">start again</a>.</p>`
    )
  }

  try {
    const refreshToken = await exchangeCodeForRefreshToken(req, code)
    if (!refreshToken) {
      return page(
        "Drive connect failed",
        `<h1 class="err">Google did not return a refresh token</h1><p>Please <a href="/api/admin/drive/connect">try again</a> — make sure to tick the Drive permission checkbox on the consent screen.</p>`
      )
    }
    const res = page(
      "Google Drive connected",
      `<h1>✓ Google Drive connected</h1>
<p>Copy this refresh token and save it in Vercel as <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> (type <b>Secret</b>, Production), then redeploy:</p>
<input id="tok" readonly value="${refreshToken.replace(/"/g, "&quot;")}" onclick="this.select()">
<button id="cp" onclick="copyTok()">Copy token</button>
<ol>
<li>Vercel → your project → Settings → Environment Variables</li>
<li>Add <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> = the token above (Secret, Production)</li>
<li>Redeploy — weekly Drive backups start automatically</li>
</ol>
<p>You can close this tab and return to the <a href="/manager/backup">Backup page</a>.</p>`
    )
    res.cookies.set("drive_oauth_state", "", { maxAge: 0, path: "/" })
    return res
  } catch {
    return page(
      "Drive connect failed",
      `<h1 class="err">Could not complete the Google handshake</h1><p>Check that the redirect URI in your Google OAuth client exactly matches this page's address, then <a href="/api/admin/drive/connect">try again</a>.</p>`
    )
  }
}
