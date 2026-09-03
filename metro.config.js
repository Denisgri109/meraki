// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * Three dependencies are native-only: they import react-native's codegen helpers, which
 * Metro will not bundle for web, so `npm run web` failed to produce a bundle at all. Point
 * the web platform at local shims instead. iOS and Android resolve normally — the swap is
 * gated on `platform === 'web'` — so this cannot change what ships to a phone.
 */
const WEB_SHIMS = {
  '@stripe/stripe-react-native': path.resolve(__dirname, 'src/web-shims/stripe-react-native.js'),
  'react-native-nfc-manager': path.resolve(__dirname, 'src/web-shims/nfc-manager.js'),
  'react-native-pager-view': path.resolve(__dirname, 'src/web-shims/pager-view.js'),
};

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_SHIMS[moduleName] };
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
