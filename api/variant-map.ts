// De inicio vacío; lo llenaremos cuando implementes el sync de variantes-sombra
export default function handler(_req: any, res: any) {
  const VARIANT_MAP: Record<string, { x2?: number; x3?: number; x4?: number }> = {};
  res.status(200).json(VARIANT_MAP);
}
