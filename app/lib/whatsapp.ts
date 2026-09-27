// Shared WhatsApp Cloud API sender (same credentials as the OTP flow).

export function toWhatsAppNumber(input: string): string {
  const d = String(input || "").replace(/\D/g, "").replace(/^0+/, "")
  const national = d.slice(-10)
  if (national.length < 10) return ""
  // India numbers start 6-9; everything else treated as US, mirroring send-otp
  if (/^[6-9]\d{9}$/.test(national)) return "91" + national
  return "1" + national
}

export async function sendWhatsAppText(
  to: string,
  body: string
): Promise<{ sent: boolean; error?: string }> {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneId || !token) {
    return { sent: false, error: "WHATSAPP_PHONE_ID or WHATSAPP_TOKEN not set on the server" }
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      return { sent: false, error: data?.error?.message || `WhatsApp API returned ${res.status}` }
    }
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e?.message || "WhatsApp request failed" }
  }
}
