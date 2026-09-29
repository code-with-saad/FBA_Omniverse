import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '../../config';
import BaseTiles from './BaseTiles';
import { pinIcon, userIcon } from './leafletIcons';
import { t } from '../../i18n';

function FitBounds({ points, disabled, refitOnResize }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (disabled || !points.length) return undefined;
    const fitAll = () => {
      if (points.length === 1) map.setView(points[0], 15);
      else map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    };
    map.invalidateSize(); // the box may have changed since Leaflet measured it
    fitAll();
    // Flex / grid layouts can change the map box after the first paint: redraw the tiles and,
    // for static previews, centre the markers again.
    const el = map.getContainer();
    let size = `${el.clientWidth}x${el.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const next = `${el.clientWidth}x${el.clientHeight}`;
      if (next === size) return;
      size = next;
      map.invalidateSize();
      if (refitOnResize) fitAll();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, disabled, map, refitOnResize]);
  return null;
}

function FlyToSelected({ marker, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!marker) return;
    map.flyTo([marker.lat, marker.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    const ref = markerRefs.current[marker.id];
    if (ref) setTimeout(() => ref.openPopup(), 850);
  }, [marker, map, markerRefs]);
  return null;
}

/**
 * Leaflet + OpenStreetMap map used across the app.
 * markers: [{ id, lat, lng, type: 'market'|'farmer', image, title, subtitle, link, linkLabel }]
 */
export default function MapView({
  markers = [],
  height = 360,
  selectedId,
  onSelect,
  userLocation,
  route,
  fit = true,
  zoom = 12,
  center,
  className = '',
  scrollWheelZoom = false,
  interactive = true, // false = a static preview (no zoom / drag)
  children,
}) {
  const markerRefs = useRef({});
  const [tilesFailed, setTilesFailed] = useState(false);
  const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  const points = valid.map((m) => [m.lat, m.lng]);
  if (userLocation) points.push([userLocation.lat, userLocation.lng]);
  if (route?.length) points.push(...route);
  const selected = valid.find((m) => m.id === selectedId);

  return (
    <div className={`map-frame ${className}`} style={{ height }}>
      <MapContainer
        center={center || points[0] || DEFAULT_CENTER}
        zoom={zoom}
        scrollWheelZoom={interactive && scrollWheelZoom}
        zoomControl={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        style={{ height: '100%', width: '100%' }}
      >
        <BaseTiles onUnavailable={() => setTilesFailed(true)} />
        {fit && <FitBounds points={points} disabled={Boolean(selected)} refitOnResize={!interactive} />}
        <FlyToSelected marker={selected} markerRefs={markerRefs} />
        {valid.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={pinIcon({ type: m.type, image: m.image, selected: m.id === selectedId })}
            ref={(ref) => {
              markerRefs.current[m.id] = ref;
            }}
            eventHandlers={{ click: () => onSelect?.(m.id) }}
          >
            <Popup>
              <h6>{m.title}</h6>
              {m.subtitle && <div className="text-muted-2 mb-2">{m.subtitle}</div>}
              <div className="d-flex gap-2 flex-wrap">
                {m.link && (
                  <Link to={m.link} className="btn btn-sm btn-primary py-1">
                    {m.linkLabel || t('View')}
                  </Link>
                )}
                <a className="btn btn-sm btn-white py-1" href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`} target="_blank" rel="noreferrer">
                  <i className="bi bi-sign-turn-right" /> {t('Directions')}
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />}
        {route?.length > 1 && <Polyline positions={route} pathOptions={{ color: '#2e7d4f', weight: 5, opacity: 0.85 }} />}
        {children}
      </MapContainer>
      {tilesFailed && (
        <span className="chip map-offline-note">
          <i className="bi bi-wifi-off" /> {t('Map tiles need an internet connection')}
        </span>
      )}
    </div>
  );
}
