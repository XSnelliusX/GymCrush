const { getDefaultConfig } = require('expo/metro-config');
const {
  handleSyncRequest,
  ensureStandaloneRelayServer,
} = require('./scripts/sync-relay-server.cjs');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The unauthenticated LAN relay is an explicit development tool, not part of cloud setup.
if (process.env.GYMCRUSH_ENABLE_LOCAL_RELAY === '1') ensureStandaloneRelayServer(8787);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (process.env.GYMCRUSH_ENABLE_LOCAL_RELAY === '1' && req.url && req.url.startsWith('/__gymcrush_sync')) {
        handleSyncRequest(req, res);
        return;
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
