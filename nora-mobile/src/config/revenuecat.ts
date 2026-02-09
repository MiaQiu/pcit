export const REVENUECAT_CONFIG = {
  // API Keys (from RevenueCat dashboard → API Keys)
  apiKey: {
    ios: 'appl_QQAcyXsMzXOOruYGuWSgZyzbumW',
    // android: 'goog_xxx' // Add when you implement Android
  },

  // Entitlement identifier (from RevenueCat dashboard → Entitlements)
  entitlements: {
    premium: 'Nora Premium',
  },

  // Offering identifier (from RevenueCat dashboard → Offerings)
  offerings: {
    default: 'default',
  },

  // Product identifiers
  products: {
    threeMonth: 'com.nora.premium.3m',
    oneYear: 'com.nora.premium.1y',
  },
};
