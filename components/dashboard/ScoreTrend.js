'use client';

import { useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { LEVEL_DOWN_AT, LEVEL_UP_AT } from '@/lib/constants';

const INK = 'var(--color-ink)';
const TICK = { fill: INK, fillOpacity: 0.7, fontSize: 12 };

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="border border-ink bg-paper px-3 py-2 text-xs">
      <p className="font-semibold">Session {point.number}</p>
      <p>{point.date}</p>
      <p className="mt-1">
        Composite <span className="font-semibold">{point.composite}</span>
      </p>
      <p>
        Level {point.level}, {point.lighting}
      </p>
    </div>
  );
}

// Threshold labels sit in the right margin, clear of the data.
function thresholdLabel(value, color) {
  return { value, position: 'right', fill: color, fontSize: 12 };
}

// points: [{ number, date, composite, level, lighting }], oldest first
export default function ScoreTrend({ points }) {
  // The line draws in once when the chart first appears, unless the reader
  // has asked for reduced motion. Decided once, on the client.
  const [animate] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={points} margin={{ top: 8, right: 96, bottom: 4, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--color-rule)" />
        <XAxis
          dataKey="number"
          type="number"
          domain={['dataMin', 'dataMax']}
          allowDecimals={false}
          tickCount={Math.min(points.length, 10)}
          padding={{ left: 24, right: 24 }}
          tick={TICK}
          tickLine={false}
          axisLine={{ stroke: INK }}
        />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={TICK} tickLine={false} axisLine={false} />
        <ReferenceLine
          y={LEVEL_UP_AT}
          stroke="var(--color-pass)"
          strokeDasharray="6 4"
          label={thresholdLabel(`${LEVEL_UP_AT}, raise level`, 'var(--color-pass)')}
        />
        <ReferenceLine
          y={LEVEL_DOWN_AT}
          stroke="var(--color-fail)"
          strokeDasharray="6 4"
          label={thresholdLabel(`${LEVEL_DOWN_AT}, lower level`, 'var(--color-fail)')}
        />
        <Tooltip content={<TrendTooltip />} cursor={{ stroke: INK, strokeOpacity: 0.4 }} isAnimationActive={false} />
        <Line
          dataKey="composite"
          type="linear"
          stroke={INK}
          strokeWidth={2}
          dot={{ r: 4, fill: INK, stroke: 'var(--color-paper)', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: INK, stroke: 'var(--color-paper)', strokeWidth: 2 }}
          isAnimationActive={animate}
          animationDuration={240}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
