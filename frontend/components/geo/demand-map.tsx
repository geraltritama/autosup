"use client";

import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import type { RegionData } from "@/hooks/useGeoDemand";
import "leaflet/dist/leaflet.css";

const CITY_COORDS: Record<string, [number, number]> = {
  Jakarta: [-6.2088, 106.8456],
  Bandung: [-6.9175, 107.6191],
  Bekasi: [-6.2383, 106.9756],
  Tangerang: [-6.1781, 106.63],
  Bogor: [-6.5971, 106.806],
  Depok: [-6.4025, 106.7942],
  Semarang: [-6.9666, 110.4196],
  Yogyakarta: [-7.7956, 110.3695],
  Surabaya: [-7.2575, 112.7521],
  Malang: [-7.9666, 112.6326],
  Solo: [-7.5755, 110.8243],
  Medan: [3.5952, 98.6722],
  Makassar: [-5.1477, 119.4327],
  Denpasar: [-8.6705, 115.2126],
  Bali: [-8.6705, 115.2126],
  Palembang: [-2.9761, 104.7754],
  Batam: [1.0456, 104.0305],
  Pekanbaru: [0.5071, 101.4478],
  Balikpapan: [-1.2654, 116.8312],
  Manado: [1.4748, 124.8421],
  Samarinda: [-0.4948, 117.1436],
  Padang: [-0.9471, 100.4172],
  Banjarmasin: [-3.3186, 114.5944],
  Jambi: [-1.6101, 103.6131],
};

type Props = {
  regions: RegionData[];
  selectedRegion?: string;
  onSelectRegion: (region: string | undefined) => void;
};

export function DemandMap({ regions, selectedRegion, onSelectRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  const maxScore = useMemo(
    () => Math.max(...regions.map((r) => r.demand_score), 1),
    [regions],
  );

  function getRadius(score: number) {
    return Math.max(12, (score / maxScore) * 40);
  }

  function getColor(score: number) {
    const ratio = score / maxScore;
    if (ratio >= 0.7) return "#dc2626";
    if (ratio >= 0.4) return "#f97316";
    return "#3b82f6";
  }

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-6.2088, 106.8456],
      zoom: 6,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when regions/selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds: L.LatLngExpression[] = [];

    regions.forEach((r) => {
      const coords = CITY_COORDS[r.region];
      if (!coords) return;
      bounds.push(coords);

      const isSelected = selectedRegion === r.region;
      const color = getColor(r.demand_score);

      const marker = L.circleMarker(coords, {
        radius: getRadius(r.demand_score),
        fillColor: color,
        fillOpacity: isSelected ? 0.8 : 0.5,
        color: isSelected ? "#0f172a" : color,
        weight: isSelected ? 3 : 1.5,
      }).addTo(map);

      marker.bindPopup(
        `<div style="text-align:center">
          <b>${r.region}</b><br/>
          Demand: ${r.demand_score.toLocaleString()}<br/>
          Growth: ${r.growth_pct >= 0 ? "+" : ""}${r.growth_pct}%
        </div>`,
      );

      marker.on("click", () => {
        onSelectRegion(isSelected ? undefined : r.region);
      });

      markersRef.current.push(marker);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 10 });
    }
  }, [regions, selectedRegion, maxScore]);

  return <div ref={containerRef} className="h-[450px] w-full rounded-2xl" />;
}
