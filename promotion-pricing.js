const promotionPricing = {
  replacedCartKeys: new Map([
    ['promo-gel-pack-0', 'detergente-2'],
    ['promo-gel-0', 'detergente-0'],
    ['detergente-mayorista-0', 'detergente-1'],
    ['detergente-mayorista-1', 'detergente-0'],
    ['promo-pisos-0', 'pisos-0'],
    ['p-610-0', 'pisos-1'],
    ['p-610-1', 'pisos-0'],
    ['promo-tapiz-0', 'tapiz-0'],
    ['p-593-0', 'tapiz-1'],
    ['p-593-1', 'tapiz-2'],
    ['promo-polvo-0', 'polvo-0']
  ]),

  hasOffer(product) {
    return product.packFormat != null || Object.values(product.tiersByFormat ?? {}).some(tiers => tiers.length > 0);
  },

  tiers(product, formatIndex) {
    return product.tiersByFormat?.[formatIndex] ?? [];
  },

  unitPrice(product, formatIndex, quantity) {
    const tier = this.tiers(product, formatIndex).findLast(([minimum]) => quantity >= minimum);
    return tier?.[1] ?? product.formats[formatIndex][1];
  },

  quantityPrices(product, formatIndex) {
    return [[1, product.formats[formatIndex][1]], ...this.tiers(product, formatIndex)];
  }
};
