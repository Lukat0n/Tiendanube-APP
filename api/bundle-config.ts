export default function handler(_req: any, res: any) {
  res.status(200).json({
    themeColor: "#ff3b7f",
    currency: "ARS",
    visibleSizes: [1, 2, 3, 4],
    discountBySize: { 1: 0, 2: 15, 3: 20, 4: 30 },
    bundlePool: [
      {
        productId: 1111111,
        title: "Gorro GÉLICA 360",
        variants: [
          { id: 22222221, title: "Talle S", price: 4999900 },
          { id: 22222222, title: "Talle M", price: 4999900 },
          { id: 22222223, title: "Talle L", price: 4999900 }
        ]
      },
      {
        productId: 1111112,
        title: "Rodillera GÉLICA",
        variants: [{ id: 33333331, title: "Único", price: 3999900 }]
      }
    ],
    complementary: [
      { productId: 4444444, title: "Botella EcomClub", variantId: 55555551, price: 999000, discountPct: 0 },
      { productId: 4444445, title: "Hoodie EcomClub",   variantId: 55555552, price: 2999900, discountPct: 0 }
    ]
  });
}
