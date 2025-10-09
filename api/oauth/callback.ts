export default async function handler(req: any, res: any) {
  const { code, store_id } = req.query;
  if (!code || !store_id) return res.status(400).send("missing code/store_id");

  const tokenResp = await fetch("https://www.tiendanube.com/apps/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.TN_CLIENT_ID,
      client_secret: process.env.TN_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!tokenResp.ok) {
    const txt = await tokenResp.text();
    return res.status(500).send(`token exchange failed: ${txt}`);
  }

  const tokenJson = await tokenResp.json();
  // tokenJson = { access_token, token_type, scope, user_id, ... }

  // TODO: guardá access_token por store_id en tu DB. Por ahora, lo mostramos:
  res.status(200).json({ installed: true, store_id, token: tokenJson });
}
