import { useState } from 'react';
import MapView from './MapView';
import { googleDirectionsUrl, osmDirectionsUrl } from '../../utils/format';
import { t } from '../../i18n';

/** Asks the browser for the user's position (returns a Promise). */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Your browser does not support location access'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Location permission was denied')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

/**
 * Map with one destination (market / stall / pickup point) and a
 * "show route" button. The driving route is calculated by the free OSRM
 * service on OpenStreetMap data; external links open Google Maps / OSM.
 */
export default function DirectionsMap({ destination, extraMarkers = [], height = 320 }) {
  const [userLocation, setUserLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function showRoute() {
    setStatus('loading');
    setError('');
    try {
      const me = await getCurrentPosition();
      setUserLocation(me);
      const url = `https://router.project-osrm.org/route/v1/driving/${me.lng},${me.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      const best = data.routes?.[0];
      if (!best) throw new Error('No route found');
      setRoute(best.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
      setSummary({ km: (best.distance / 1000).toFixed(1), min: Math.round(best.duration / 60) });
      setStatus('done');
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? t('Could not load the route. Use the Google Maps link instead.') : err.message);
      setStatus('error');
    }
  }

  const markers = [{ id: 'dest', type: 'market', ...destination }, ...extraMarkers];

  return (
    <div>
      <MapView markers={markers} userLocation={userLocation} route={route} height={height} />
      <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
        <button type="button" className="btn btn-primary btn-sm" onClick={showRoute} disabled={status === 'loading'}>
          {status === 'loading' ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-signpost-split" />} {t('Route from my location')}
        </button>
        <a className="btn btn-white btn-sm" href={googleDirectionsUrl(destination.lat, destination.lng)} target="_blank" rel="noreferrer">
          <i className="bi bi-google" /> {t('Google Maps')}
        </a>
        <a className="btn btn-white btn-sm" href={osmDirectionsUrl(destination.lat, destination.lng)} target="_blank" rel="noreferrer">
          <i className="bi bi-map" /> {t('OpenStreetMap')}
        </a>
        {summary && (
          <span className="chip chip-lime">
            <i className="bi bi-car-front" /> {summary.km} {t('km · about')} {summary.min} {t('min')}
          </span>
        )}
      </div>
      {error && <div className="small text-danger mt-2">{error}</div>}
    </div>
  );
}
