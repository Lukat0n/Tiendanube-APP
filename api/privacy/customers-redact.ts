export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  // Ejemplo de payload: { store_id: 12345, customer: { id: 9999, email: "..." } }
  const event = req.body || {};
  // TODO: borrar/anonymizar datos de ese cliente en tu DB si guardás algo.

  return res.status(200).json({ ok: true });
}
