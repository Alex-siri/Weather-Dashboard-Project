'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_CITIES = ['Addis Ababa', 'London', 'Dubai', 'Tokyo'];
const RECENT_KEY = 'weather-dashboard:recent-searches';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';

function firstValue(value, fallback = '') {
  return value && value.trim() ? value : fallback;
}

function resolveTheme(description, isDay) {
  const text = description.toLowerCase();
  if (text.includes('thunder') || text.includes('storm')) return 'storm';
  if (text.includes('rain') || text.includes('drizzle')) return 'rainy';
  if (text.includes('snow') || text.includes('sleet')) return 'snow';
  if (text.includes('cloud') || text.includes('fog') || text.includes('mist') || text.includes('haze')) return 'cloudy';
  return isDay ? 'sunny' : 'night';
}

function asTemp(value, unit) {
  return `${Math.round(value)}°${unit === 'celsius' ? 'C' : 'F'}`;
}

function buildUrl(path, params) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function fetchJson(path, params) {
  const response = await fetch(buildUrl(path, params), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

function normalizeSnapshot(weatherPayload, forecastPayload, city, country) {
  const root = weatherPayload?.data || weatherPayload || {};
  const current = root.current || root.weather || root;
  const location = root.location || root;
  const isOpenWeatherShape = Array.isArray(root.weather) || root.main || root.sys;
  const forecastRoot = forecastPayload?.data || forecastPayload || {};
  const forecastSource = forecastRoot.forecast || forecastRoot.forecastday || forecastRoot.days || forecastRoot.daily || [];
  const entries = Array.isArray(forecastSource)
    ? forecastSource
    : Array.isArray(forecastSource?.forecastday)
      ? forecastSource.forecastday
      : Array.isArray(forecastSource?.days)
        ? forecastSource.days
        : [];

  if (isOpenWeatherShape) {
    const weatherInfo = Array.isArray(root.weather) ? root.weather[0] || {} : root.weather || {};
    return {
      location: {
        city: String(root.name || city),
        country: String(root.sys?.country || country),
        timezone: 'Local time unavailable',
        localTime: root.dt ? new Date(root.dt * 1000).toLocaleString() : '',
      },
      current: {
        temperatureC: Number(root.main?.temp || 0),
        temperatureF: Number(((root.main?.temp || 0) * 9) / 5 + 32),
        feelsLikeC: Number(root.main?.feels_like || 0),
        feelsLikeF: Number(((root.main?.feels_like || 0) * 9) / 5 + 32),
        humidity: Number(root.main?.humidity || 0),
        windSpeed: Number(root.wind?.speed || 0),
        pressure: Number(root.main?.pressure || 0),
        visibility: Number(root.visibility ? root.visibility / 1000 : 0),
        description: String(weatherInfo.description || 'Weather unavailable'),
        isDay: Boolean(root.sys?.sunrise && root.sys?.sunset && root.dt ? root.dt > root.sys.sunrise && root.dt < root.sys.sunset : true),
        sunrise: root.sys?.sunrise ? new Date(root.sys.sunrise * 1000).toLocaleTimeString() : 'Unavailable',
        sunset: root.sys?.sunset ? new Date(root.sys.sunset * 1000).toLocaleTimeString() : 'Unavailable',
      },
      forecast: [],
    };
  }

  return {
    location: {
      city: String(location.city || location.name || city),
      country: String(location.country || country),
      timezone: String(location.timezone || 'Local time unavailable'),
      localTime: String(location.localTime || location.time || ''),
    },
    current: {
      temperatureC: Number(current.temperatureC || current.temp_c || current.temperature || 0),
      temperatureF: Number(current.temperatureF || current.temp_f || 0),
      feelsLikeC: Number(current.feelsLikeC || current.feels_like_c || 0),
      feelsLikeF: Number(current.feelsLikeF || current.feels_like_f || 0),
      humidity: Number(current.humidity || 0),
      windSpeed: Number(current.windSpeed || current.wind_kph || 0),
      pressure: Number(current.pressure || current.pressure_mb || 0),
      visibility: Number(current.visibility || current.vis_km || 0),
      description: String(current.description || current.condition?.text || 'Weather unavailable'),
      isDay: Boolean(current.isDay || current.is_day || true),
      sunrise: String(current.sunrise || 'Unavailable'),
      sunset: String(current.sunset || 'Unavailable'),
    },
    forecast: entries.slice(0, 5).map((entry, index) => {
      const day = entry.day || entry;
      return {
        date: String(entry.date || new Date(Date.now() + index * 86_400_000).toISOString().slice(0, 10)),
        description: String(day.description || day.condition?.text || 'Forecast unavailable'),
        minTempC: Number(day.minTempC || day.mintemp_c || 0),
        maxTempC: Number(day.maxTempC || day.maxtemp_c || 0),
        minTempF: Number(day.minTempF || day.mintemp_f || 0),
        maxTempF: Number(day.maxTempF || day.maxtemp_f || 0),
      };
    }),
  };
}

export default function Page() {
  const [city, setCity] = useState('London');
  const [country, setCountry] = useState('');
  const [unit, setUnit] = useState('celsius');
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);
  const [data,setData] = useState(null);


  useEffect(() => {
    try {
      setRecentSearches(JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]'));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCity(firstValue(params.get('city'), 'London'));
    setCountry(firstValue(params.get('country'), ''));
    setUnit(params.get('units') === 'fahrenheit' ? 'fahrenheit' : 'celsius');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setLoading(true);
      setError('');
      try {
        const [weatherPayload, forecastPayload] = await Promise.all([
          fetchJson('/', { city: city.trim().toLowerCase() }),
          Promise.resolve(null),
        ]);

        if (cancelled) return;

        const normalized = normalizeSnapshot(weatherPayload, forecastPayload, city, country);
        setSnapshot(normalized);
        const nextRecent = [normalized.location.city, ...recentSearches.filter((item) => item !== normalized.location.city)].slice(0, 6);
        setRecentSearches(nextRecent);
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent));
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load weather data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWeather();
    return () => {
      cancelled = true;
    };
  }, [city, country, unit]);

  const theme = useMemo(() => (snapshot ? resolveTheme(snapshot.current.description, snapshot.current.isDay) : 'sunny'), [snapshot]);
  const currentTemperature = snapshot ? (unit === 'celsius' ? snapshot.current.temperatureC : snapshot.current.temperatureF) : 0;
  const feelsLike = snapshot ? (unit === 'celsius' ? snapshot.current.feelsLikeC : snapshot.current.feelsLikeF) : 0;
  const localClock = snapshot?.location.localTime || new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());

  async function submitSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set('city', city.trim().toLowerCase());
    window.history.replaceState(null, '', `?${params.toString()}`);
    console.log(`Searching weather for ${city}...`);
    const data = await fetchJson('http://localhost:3002/', { city: city.trim().toLowerCase() });
    setData(data);
  }

  return (
    <main className={`app theme-${theme}`}>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Next.js frontend</span>
          <h1>Weather dashboard as a plain Next.js app.</h1>
          <p>Search city weather, toggle units, and show a 5-day forecast from your Express backend.</p>

          <form className="search-form" onSubmit={submitSearch}>
            <label>
              <span>City</span>
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Search a city" />
            </label>
            <label>
              <span>Country</span>
              <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>Unit</span>
              <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option value="celsius">Celsius</option>
                <option value="fahrenheit">Fahrenheit</option>
              </select>
            </label>
            <button type="submit">Search Weather</button>
          </form>

          <div className="chip-row">
            {DEFAULT_CITIES.map((item) => (
              <button key={item} type="button" className="chip" onClick={() => setCity(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <aside className="hero-status">
          <div>
            <span>Theme</span>
            <strong>{theme}</strong>
          </div>
         
          <div>
            <span>Recent</span>
            <strong>{recentSearches[0] || 'None yet'}</strong>
          </div>
        </aside>
      </section>

      {error ? <section className="feedback">{error}</section> : null}

      <section className="dashboard-grid">
        <article className="current-card">
          {loading ? (
            <div className="empty-state">Loading weather...</div>
          ) : data ? (
            <>
              <div className="current-header">
                <div>
                  <p className="eyebrow">Current weather</p>
                  <h2>
                    {data.city}
                    {data.sys.country ? <span>, {data.sys.country}</span> : null}
                  </h2>
                  <p>{data.timezone}</p>
                </div>
              </div>

              <div className="temperature-block">
                <strong>{Math.round(currentTemperature)}°{unit === 'celsius' ? 'C' : 'F'}</strong>
                <span>{data.weather[0].description}</span>
              </div>

              <div className="metrics-grid">
                <div><span>Feels like</span><strong>{asTemp(data.main.feels_like, unit)}</strong></div>
                <div><span>Humidity</span><strong>{Math.round(data.main.humidity)}%</strong></div>
                <div><span>Wind</span><strong>{Math.round(data.main.windSpeed)} km/h</strong></div>
                <div><span>Pressure</span><strong>{Math.round(data.main.pressure)} mb</strong></div>
                <div><span>Visibility</span><strong>{Math.round(data.main.visibility)} km</strong></div>
                <div><span>Sunrise / Sunset</span><strong>{data.sys.sunrise} / {snapshot.current.sunset}</strong></div>
              </div>
            </>
          ) : null}
        </article>

        <aside className="api-card">
          <h3>Next.js structure</h3>
          <p>This frontend uses the Next.js App Router with plain `.js` files.</p>
          <ul>
            <li>One app directory</li>
            <li>One stylesheet</li>
            <li>Browser-based API fetch</li>
          </ul>
        </aside>
      </section>

      <section className="forecast-section">
        <div className="section-header">
          <h3>5-day forecast</h3>
        </div>
        <div className="forecast-grid">
          {snapshot?.forecast?.length ? (
            snapshot.forecast.map((day) => {
              const min = unit === 'celsius' ? day.minTempC : day.minTempF;
              const max = unit === 'celsius' ? day.maxTempC : day.maxTempF;
              return (
                <article className="forecast-card" key={`${day.date}-${day.description}`}>
                  <span>{day.date}</span>
                  <strong>{day.description}</strong>
                  <p>{Math.round(min)}°{unit === 'celsius' ? 'C' : 'F'} / {Math.round(max)}°{unit === 'celsius' ? 'C' : 'F'}</p>
                </article>
              );
            })
          ) : (
            <p className="forecast-empty">Forecast will appear after the backend returns data.</p>
          )}
        </div>
      </section>
    </main>
  );
}