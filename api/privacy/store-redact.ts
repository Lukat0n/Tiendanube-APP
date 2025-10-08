export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  // Ejemplo de payload: { store_id: 12345 }
  const event = req.body || {};
  // TODO: borrar/anonymizar datos de esa tienda en tu DB si guardás algo.

  return res.status(200).json({ ok: true });
}
