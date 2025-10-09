export default async function handler(req: any, res: any) {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).send("missing store_id");

  const clientId = process.env.TN_CLIENT_ID!;
  const redirectUri = `${process.env.APP_BASE_URL}/oauth/callback`;
  const state = Math.random().toString(36).slice(2); // opcional: guardalo en cookie/session

  const authorizeUrl = `https://www.tiendanube.com/apps/authorize?client_id=${encodeURIComponent(
    clientId
  )}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${state}&store_id=${encodeURIComponent(String(store_id))}`;

  res.redirect(authorizeUrl);
}
