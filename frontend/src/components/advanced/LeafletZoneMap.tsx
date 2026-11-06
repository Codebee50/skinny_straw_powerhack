"use client";

// Loaded only in the browser via next/dynamic({ ssr: false }); Leaflet touches `window` on import.
import "leaflet/dist/leaflet.css";
import "./zone-map.css";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { MapResponse } from "@/lib/types-advanced";
import { NY_BOUNDS, NY_CENTER, describeValue, drawOrder, makeScale } from "./mapScale";

/** Keep the map sized to its card (cards resize when the page reflows) and framed on New York. */
function FitAndResize() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(NY_BOUNDS, { padding: [12, 12] });
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function LeafletZoneMap({
  data,
  height,
  onTilesFailed,
}: {
  data: MapResponse;
  height: number;
  onTilesFailed?: () => void;
}) {
  const scale = makeScale(data);
  const [tileErrors, setTileErrors] = useState(0);

  useEffect(() => {
    if (tileErrors >= 3) onTilesFailed?.();
  }, [tileErrors, onTilesFailed]);

  return (
    <MapContainer
      center={NY_CENTER}
      zoom={6}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      attributionControl
      style={{ height, width: "100%", background: "var(--surface-2)" }}
      className="rounded-lg"
    >
      <FitAndResize />
      {/* If tiles can't load (no internet), Leaflet leaves the plain background and the circles still draw. */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        opacity={0.75}
        eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1) }}
      />
      {drawOrder(data.zones, scale).map((z) => {
        const s = scale.style(z.value);
        return (
          <CircleMarker
            key={`${data.metric}-${z.zone}`}
            center={[z.latitude, z.longitude]}
            radius={s.radius}
            pathOptions={{ color: "#18181a", weight: 1, opacity: 0.55, fillColor: s.fill, fillOpacity: 0.92 }}
          >
            <Tooltip permanent direction="center" className="zone-letter" opacity={1}>
              <span style={{ color: s.text }}>{z.zone_letter}</span>
            </Tooltip>
            <Popup>
              <strong>{z.label}</strong>
              <br />
              {z.representative_city} ({z.region})
              <br />
              {describeValue(z, data.metric)}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
