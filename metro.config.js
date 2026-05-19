const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const emptyShim = path.resolve(__dirname, 'shims/empty.js');

config.resolver.extraNodeModules = {
  stream: emptyShim,
  zlib: emptyShim,
  crypto: emptyShim,
  http: emptyShim,
  https: emptyShim,
  net: emptyShim,
  tls: emptyShim,
  fs: emptyShim,
  bufferutil: emptyShim,
  'utf-8-validate': emptyShim,
};

module.exports = config;
