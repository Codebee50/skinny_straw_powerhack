import type { MapResponse } from "@/lib/types-advanced";
import { NY_BOUNDS, describeValue, drawOrder, makeScale } from "./mapScale";

const W = 640;
const PAD = 28;

/**
 * Dependency-free fallback: projects lat/long to x/y (equirectangular, longitude scaled by
 * cos(latitude) so shapes aren't stretched). Used when Leaflet can't load, or on request.
 */
export function SvgZoneMap({ data, height }: { data: MapResponse; height: number }) {
  const [[south, west], [north, east]] = NY_BOUNDS;
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const spanX = (east - west) * k;
  const spanY = north - south;
  const H = Math.round(((W - 2 * PAD) * spanY) / spanX + 2 * PAD);
  const x = (lon: number) => PAD + (((lon - west) * k) / spanX) * (W - 2 * PAD);
  const y = (lat: number) => PAD + ((north - lat) / spanY) * (H - 2 * PAD);
  const scale = makeScale(data);
  // Circles are sized in screen px; convert to viewBox units for the rendered height.
  const px = H / height;

  const lats = [41, 42, 43, 44, 45];
  const lons = [-79, -77, -75, -73];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Simple map of New York zones: ${data.zones.map((z) => `${z.label} ${describeValue(z, data.metric)}`).join("; ")}`}
      className="w-full rounded-lg bg-surface-2"
      style={{ height }}
      preserveAspectRatio="xMidYMid meet"
    >
      {lats.map((lat) => (
        <g key={`lat${lat}`}>
          <line x1={PAD} x2={W - PAD} y1={y(lat)} y2={y(lat)} stroke="#d6d5cf" strokeDasharray="2 4" />
          <text x={PAD - 4} y={y(lat) + 4} textAnchor="end" fontSize={10} fill="#75756e">
            {lat}°N
          </text>
        </g>
      ))}
      {lons.map((lon) => (
        <g key={`lon${lon}`}>
          <line x1={x(lon)} x2={x(lon)} y1={PAD} y2={H - PAD} stroke="#d6d5cf" strokeDasharray="2 4" />
          <text x={x(lon)} y={H - PAD + 14} textAnchor="middle" fontSize={10} fill="#75756e">
            {Math.abs(lon)}°W
          </text>
        </g>
      ))}
      {drawOrder(data.zones, scale).map((z) => {
        const s = scale.style(z.value);
        const r = s.radius * px;
        return (
          <g key={z.zone}>
            <title>{`${z.label}, ${z.representative_city}: ${describeValue(z, data.metric)}`}</title>
            <circle
              cx={x(z.longitude)}
              cy={y(z.latitude)}
              r={r}
              fill={s.fill}
              fillOpacity={0.92}
              stroke="#18181a"
              strokeOpacity={0.55}
              strokeWidth={px}
            />
            <text
              x={x(z.longitude)}
              y={y(z.latitude)}
              dy="0.35em"
              textAnchor="middle"
              fontSize={13 * px}
              fontWeight={700}
              fill={s.text}
            >
              {z.zone_letter}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
