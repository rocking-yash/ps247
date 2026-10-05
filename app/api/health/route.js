// TEMPORARY — verifies the Atlas setup. Delete before deploying.

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export async function GET() {
  try {
    await connectDB();
    const started = Date.now();
    await mongoose.connection.db.admin().ping();

    return Response.json({
      ok: true,
      state: STATES[mongoose.connection.readyState],
      database: mongoose.connection.name,
      pingMs: Date.now() - started,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      state: STATES[mongoose.connection.readyState] ?? 'unknown',
      error: err.name,
      message: err.message,
    }, { status: 503 });
  }
}
