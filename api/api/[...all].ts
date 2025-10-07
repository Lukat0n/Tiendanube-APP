import express from "express";
import fetch from "node-fetch";
import serverless from "serverless-http";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const stores = new Map<number, { store_id: number; access_token: string }>();
const VARIANT_MAP: Record<string, { x2?: number; x3?: number; x4?: number }> = {};

const CONFIG = {
  themeColor: "#ff3b7f",
  currency: "ARS",
  visibleSizes: [1, 2, 3, 4] as number[],
  discountBySize: { 1: 0, 2: 15, 3: 20, 4: 30 } as Record<number, number>,
  bundlePool: [
    { productId: 1111111, title: "Gorro GÉLICA 360", variants: [
      { id: 22222221, title: "Talle S" },
      { id: 22222222, title: "Talle M" },
      { id: 22222223, title: "Talle L" },
    ]},
    { productId: 1111112, title: "Rodillera GÉLICA", variants: [
      { id: 33333331, title: "Único" },
    ]},
  ],
  complementary: [
    { productId: 4444444, title: "Botella EcomClub", variantId: 55555551, price: 9990_0, discountPct: 0 },
    { productId: 4444445, title: "Hoodie EcomClub",   variantId: 55555552, price: 29990_0, discountPct: 0 },
  ],
};

const TND_CLIENT_ID = process.env.TND_CLIENT_ID || "";
const TND_CLIENT_SECRET = process.env.TND_CLIENT_SECRET || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://tu-app.vercel.app";
const REDIRECT_URI = `${APP_BASE_URL}/oauth/callback`;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";

function signState(payload: any) {
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", SESSION_SECRET).update(raw).digest("base64url");
  return `${raw}.${mac}`;
}
function verifyState(token: string) {
  const [raw, mac] = token.split(".");
  const calc = crypto.createHmac("sha256", SESSION_SECRET).update(raw).digest("base64url");
  if (calc !== mac) return null;
  return JSON.parse(Buffer.from(raw, "base64url").toString());
}
async function tndFetch(storeId: number, pathUrl: string, init?: import('node-fetch').RequestInit) {
  const auth = stores.get(storeId);
  if (!auth) throw new Error("store not installed");

  const url = `https://api.tiendanube.com/v1/${storeId}${pathUrl}`;

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "bundle-app (contact@example.com)",
    Authorization: `bearer ${auth.access_token}`,
  };

  const merged = new (fetch as any).Headers(baseHeaders);
  if (init?.headers) {
    const extra = new (fetch as any).Headers(init.headers as any);
    extra.forEach((value: string, key: string) => merged.set(key, value));
  }

  const resp = await fetch(url, { ...(init || {}), headers: merged as any });
  if (!resp.ok) throw new Error(`tnd ${resp.status}`);
  return resp.json();
}

function calcDiscounted(priceCents: number, pct: number) {
  const v = Math.round(priceCents * (1 - pct / 100));
  return Math.max(v, 0);
}

/* OAuth */
app.get("/install", (req, res) => {
  const { store_id } = req.query as any;
  if (!store_id) return res.status(400).send("missing store_id");
  const state = signState({ store_id: Number(store_id), ts: Date.now() });
  const url = new URL(`https://www.tiendanube.com/apps/authorize`);
  url.searchParams.set("client_id", TND_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", [
    "read_products","write_products",
    "read_orders","read_customers",
    "write_scripts","read_scripts"
  ].join(","));
  res.redirect(url.toString());
});
app.get("/oauth/callback", async (req, res) => {
  try {
    const { code, store_id, state } = req.query as any;
    if (!code || !store_id || !state) return res.status(400).send("missing params");
    const st = verifyState(state);
    if (!st || Number(st.store_id) !== Number(store_id)) return res.status(400).send("bad state");

    const tokenResp = await fetch("https://www.tiendanube.com/apps/authorize/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: TND_CLIENT_ID, client_secret: TND_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: REDIRECT_URI }),
    }).then((r: any) => r.json() as any);


    if (!tokenResp?.access_token) return res.status(400).send("no token");

    stores.set(Number(store_id), { store_id: Number(store_id), access_token: tokenResp.access_token });

    try { await registerScript(Number(store_id)); } catch {}

    res.send("Instalación completa. Ya podés cerrar esta pestaña.");
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

/* Script URL (estático via /public) -> /scripts/bundle.js */

/* Config APIs */
app.get("/api/bundle-config", (req, res) => {
  res.json({
    themeColor: CONFIG.themeColor,
    currency: CONFIG.currency,
    tiers: CONFIG.visibleSizes.map(s => ({ size: s, label: s===1?"Por unidad":`Pack X${s}`, discountPct: CONFIG.discountBySize[s] || 0 })),
    bundlePool: CONFIG.bundlePool,
    complementary: CONFIG.complementary,
    visibleSizes: CONFIG.visibleSizes,
    discountBySize: CONFIG.discountBySize
  });
});
app.post("/admin/config", (req, res) => {
  const { visibleSizes, discountBySize } = req.body || {};
  if (Array.isArray(visibleSizes) && visibleSizes.length) CONFIG.visibleSizes = visibleSizes.map(Number).sort((a,b)=>a-b);
  if (discountBySize && typeof discountBySize === "object") CONFIG.discountBySize = discountBySize;
  res.json({ ok: true, CONFIG });
});
app.get("/api/variant-map", (req, res) => {
  res.json(VARIANT_MAP);
});

/* Sync variantes sombra (simplificado de ejemplo) */
app.post("/admin/sync-variants", async (req, res) => {
  try {
    const { store_id, tiers } = req.body || {};
    const sid = Number(store_id);
    if (!sid) return res.status(400).json({ error: "missing store_id" });
    if (!stores.get(sid)) return res.status(400).json({ error: "store not installed" });

    const tierPcts: Record<number, number> = tiers || CONFIG.discountBySize;

    for (const group of CONFIG.bundlePool) {
      for (const v of group.variants) {
        const baseVariantId = v.id;
        const mapEntry = VARIANT_MAP[String(baseVariantId)] || {};
        for (const size of [2,3,4]) {
          const pct = tierPcts[size] || 0;
          if (!pct) { delete (mapEntry as any)[`x${size}`]; continue; }
          const shadowId = await ensureShadowVariant(sid, baseVariantId, size, pct);
          (mapEntry as any)[`x${size}`] = shadowId;
        }
        VARIANT_MAP[String(baseVariantId)] = mapEntry;
      }
    }
    res.json({ ok: true, VARIANT_MAP });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function registerScript(storeId: number) {
  const scriptUrl = `${APP_BASE_URL}/scripts/bundle.js`;
  await tndFetch(storeId, "/scripts", {
    method: "POST",
    body: JSON.stringify({ src: scriptUrl, event: "onload", where: "product" })
  });
}
async function ensureShadowVariant(storeId: number, baseVariantId: number, size: number, pct: number) {
  const baseProduct = await findProductByVariant(storeId, baseVariantId);
  const baseVar = baseProduct?.variants?.find((x: any) => x.id === baseVariantId);
  if (!baseVar) throw new Error("base variant not found");
  const basePriceCents = Math.round(Number(baseVar.price) * 100) || 0;
  const netCents = calcDiscounted(basePriceCents, pct);
  const desiredSku = `${baseVar.sku || baseVariantId}-B${size}-${pct}`;
  const shadowName = `${baseVar.name || "Var"} (Bundle X${size} -${pct}%)`;
  let shadow = baseProduct.variants.find((x: any) => x.sku === desiredSku);
  if (!shadow) {
    const created = await tndFetch(storeId, `/products/${baseProduct.id}/variants`, {
      method: "POST",
      body: JSON.stringify({ name: shadowName, price: (netCents/100).toFixed(2), sku: desiredSku, stock_management: false, visible: false })
    });
    shadow = created;
  } else {
    await tndFetch(storeId, `/products/${baseProduct.id}/variants/${shadow.id}`, {
      method: "PUT",
      body: JSON.stringify({ price: (netCents/100).toFixed(2) })
    });
  }
  return shadow.id;
}
async function findProductByVariant(storeId: number, variantId: number) {
  const products = await tndFetch(storeId, "/products");
  for (const p of products) {
    if (p?.variants?.some((v: any) => v.id === variantId)) return p;
  }
  return null;
}

export default serverless(app);
