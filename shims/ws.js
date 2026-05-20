// React Native provides a global WebSocket implementation.
// This shim satisfies `ws` imports without pulling in Node.js dependencies.
module.exports = WebSocket;
