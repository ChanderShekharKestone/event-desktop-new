import { useState } from 'react';
import { Box, Typography } from '@mui/material';

/**
 * The two lead capture report charts as plain SVG (the source uses recharts, which the
 * desktop build doesn't include): booth visits per hour (bars) and room occupancy over time
 * (step area, with an optional shaded session window). Hover shows the value.
 */

const BRAND = '#201751';
const INK_MUTED = '#6b7280';
const GRID = '#e5e7eb';
const W = 720;
const H = 240;
const PAD = { top: 10, right: 12, bottom: 26, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** "Nice" y ticks from 0 to at least max: 0, step, 2·step… */
const yTicks = (max) => {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw));
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
};

const Frame = ({ ticks, yOf, xLabels, children, tip }) => (
  <Box sx={{ position: 'relative', width: '100%' }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: H }} role="img">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke={GRID} strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={yOf(v) + 4} fontSize="11" fill={INK_MUTED} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {xLabels.map(({ x, label }) => (
        <text key={`${x}-${label}`} x={x} y={H - 8} fontSize="11" fill={INK_MUTED} textAnchor="middle">
          {label}
        </text>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} stroke={GRID} />
      {children}
    </svg>
    {tip && (
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          right: 8,
          background: '#fff',
          border: `1px solid ${GRID}`,
          borderRadius: 1.5,
          px: 1.25,
          py: 0.5,
          boxShadow: 1,
          pointerEvents: 'none',
        }}
      >
        <Typography sx={{ fontSize: 12, color: INK_MUTED }}>{tip.label}</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{tip.value}</Typography>
      </Box>
    )}
  </Box>
);

/** About 6 evenly spaced x labels */
const spacedLabels = (n, xOf, labelOf) => {
  const every = Math.max(1, Math.ceil(n / 6));
  const out = [];
  for (let i = 0; i < n; i += every) out.push({ x: xOf(i), label: labelOf(i) });
  return out;
};

/** Booth: data [{ time, visits }] — one bar per hour */
export const BoothChart = ({ data, fmt }) => {
  const [hover, setHover] = useState(null);
  const ticks = yTicks(Math.max(...data.map((d) => d.visits)));
  const top = ticks.at(-1);
  const yOf = (v) => PAD.top + PLOT_H - (v / top) * PLOT_H;
  const slot = PLOT_W / data.length;
  const barW = Math.min(36, Math.max(2, slot - 2));
  const xOf = (i) => PAD.left + slot * i + slot / 2;
  const d = hover !== null ? data[hover] : null;

  return (
    <Frame
      ticks={ticks}
      yOf={yOf}
      xLabels={spacedLabels(data.length, xOf, (i) => fmt(data[i].time))}
      tip={d && { label: fmt(d.time), value: `${d.visits} visits` }}
    >
      {data.map((p, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={PLOT_H} fill={hover === i ? 'rgba(32,23,81,0.06)' : 'transparent'} />
          <rect x={xOf(i) - barW / 2} y={yOf(p.visits)} width={barW} height={PAD.top + PLOT_H - yOf(p.visits)} rx="3" fill={BRAND} />
        </g>
      ))}
    </Frame>
  );
};

/** Room: data [{ t (ms), count }] as a step line; highlight { startTime, endTime } is shaded */
export const RoomChart = ({ data, highlight, fmt }) => {
  const [hover, setHover] = useState(null);
  const ticks = yTicks(Math.max(...data.map((d) => d.count)));
  const top = ticks.at(-1);
  const t0 = data[0].t;
  const t1 = data.length > 1 ? data.at(-1).t : t0 + 1;
  const xOfT = (t) => PAD.left + ((t - t0) / (t1 - t0)) * PLOT_W;
  const yOf = (v) => PAD.top + PLOT_H - (v / top) * PLOT_H;

  let path = `M ${xOfT(data[0].t)} ${yOf(data[0].count)}`;
  for (let i = 1; i < data.length; i++) path += ` H ${xOfT(data[i].t)} V ${yOf(data[i].count)}`;
  const area = `${path} V ${yOf(0)} H ${xOfT(t0)} Z`;

  const band =
    highlight &&
    [new Date(highlight.startTime).getTime(), new Date(highlight.endTime).getTime()].map((t) =>
      Math.min(Math.max(xOfT(t), PAD.left), W - PAD.right),
    );
  const d = hover !== null ? data[hover] : null;
  const slot = PLOT_W / data.length;

  return (
    <Frame
      ticks={ticks}
      yOf={yOf}
      xLabels={spacedLabels(data.length, (i) => xOfT(data[i].t), (i) => fmt(data[i].t))}
      tip={d && { label: fmt(d.t), value: `${d.count} in room` }}
    >
      {band && band[1] > band[0] && (
        <rect x={band[0]} y={PAD.top} width={band[1] - band[0]} height={PLOT_H} fill={BRAND} fillOpacity="0.07" />
      )}
      <path d={area} fill={BRAND} fillOpacity="0.1" />
      <path d={path} fill="none" stroke={BRAND} strokeWidth="2" />
      {d && <circle cx={xOfT(d.t)} cy={yOf(d.count)} r="4" fill={BRAND} stroke="#fff" strokeWidth="2" />}
      {data.map((p, i) => (
        <rect
          key={i}
          x={xOfT(p.t) - slot / 2}
          y={PAD.top}
          width={slot}
          height={PLOT_H}
          fill="transparent"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        />
      ))}
    </Frame>
  );
};
