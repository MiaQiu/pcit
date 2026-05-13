export const REVENUECAT_CONFIG = {
  // API Keys (from RevenueCat dashboard → API Keys)
  apiKey: {
    ios: 'appl_QQAcyXsMzXOOruYGuWSgZyzbumW',
    android: 'goog_DKOHGTQTyMoZWiriILmLnJOfimp',
  },

  // Entitlement identifier (from RevenueCat dashboard → Entitlements)
  entitlements: {
    premium: 'Nora Premium',
  },

  // Offering identifier (from RevenueCat dashboard → Offerings)
  offerings: {
    default: 'default',
  },

  // Product identifiers — Android uses 'om.nora.premium.1m', iOS uses 'com.nora.premium.1m'
  products: {
    oneMonth: {
      ios: 'com.nora.premium.1m',
      android: 'om.nora.premium.1m',
    },
  },
};
