// Mongo connection helper. Cached on globalThis so dev hot-reload and
// serverless invocations reuse one connection instead of opening a new one
// per request (Atlas M0 has a low connection cap).

import dns from 'node:dns';
import mongoose from 'mongoose';

// On some Windows setups (IPv6-only DNS from the router) Node cannot read the
// system resolvers and falls back to 127.0.0.1, where nothing is listening, so
// the mongodb+srv:// lookup dies with "querySrv ECONNREFUSED". Only in that
// broken state, point Node at public resolvers. No effect on Vercel.
//
// The callback and promise APIs are checked separately: the driver resolves
// through dns.promises, which dns.setServers() does not always update (it
// did not under `next start`).
function fixLoopbackDns() {
  for (const api of [dns, dns.promises]) {
    const servers = api.getServers();
    if (servers.length > 0 && servers.every((s) => s === '127.0.0.1' || s === '::1')) {
      api.setServers(['8.8.8.8', '1.1.1.1']);
    }
  }
}

let cached = globalThis._mongoose;
if (!cached) cached = globalThis._mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set — add it to .env.local');

  if (!cached.promise) {
    fixLoopbackDns();
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,  // fail fast instead of hanging 30s
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;  // let the next request retry
    throw err;
  }
  return cached.conn;
}
