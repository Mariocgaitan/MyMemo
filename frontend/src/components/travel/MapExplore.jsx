import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapExplore({ clusters = [], center, onSelectPlace }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [center?.lat || 19.4326, center?.lng || -99.1332],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerLayerRef.current) return;
    const layer = markerLayerRef.current;
    layer.clearLayers();

    clusters.forEach((cluster) => {
      const marker = L.marker([cluster.latitude, cluster.longitude]);
      const preview = cluster.preview;
      const previewLine = preview?.context_badge ? `<br/><small>${preview.context_badge}</small>` : '';
      marker.bindPopup(`<strong>${cluster.place_name}</strong><br/>${cluster.memory_count} memorias${previewLine}`);
      marker.on('click', () => onSelectPlace?.(cluster.place_id, preview?.id || null));
      layer.addLayer(marker);
    });

    if (clusters.length > 0) {
      const bounds = clusters.map((cluster) => [cluster.latitude, cluster.longitude]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }, [clusters, onSelectPlace]);

  return <div ref={mapRef} className="h-[420px] w-full rounded-2xl overflow-hidden border border-border-light dark:border-border-dark" />;
}
