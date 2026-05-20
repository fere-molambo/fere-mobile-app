const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const emptyShim = path.resolve(__dirname, 'shims/empty.js');
const wsShim = path.resolve(__dirname, 'shims/ws.js');

config.resolver.extraNodeModules = {
  // WebSocket: use native implementation instead of Node.js `ws`
  ws: wsShim,
  // Node.js built-ins not available in React Native
  stream: emptyShim,
  zlib: emptyShim,
  crypto: emptyShim,
  http: emptyShim,
  https: emptyShim,
  net: emptyShim,
  tls: emptyShim,
  fs: emptyShim,
  events: emptyShim,
  url: emptyShim,
  assert: emptyShim,
  util: emptyShim,
  os: emptyShim,
  path: emptyShim,
  child_process: emptyShim,
  // Optional native WebSocket extensions
  bufferutil: emptyShim,
  'utf-8-validate': emptyShim,
};

module.exports = config;
