export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  // Ejemplo de payload: { store_id: 12345, customer: { id: 9999, email: "..." } }
  const event = req.body || {};
  // TODO: si guardás datos propios, prepará el export y enviáselo al merchant;
  // por ahora solo acusamos recibo.
  return res.status(200).json({ ok: true });
}
