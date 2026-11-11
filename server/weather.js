import { AppError } from "./gemini.js";

export async function getWeather(city, units = "fahrenheit", fetchFn = fetch) {
  const geo = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geo.search = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json",
  });
  const geoResponse = await fetchFn(geo, { signal: AbortSignal.timeout(8000) });
  if (!geoResponse.ok)
    throw new AppError(
      "The location service is unavailable. Try again shortly.",
      502,
    );
  const location = (await geoResponse.json()).results?.[0];
  if (!location)
    throw new AppError(
      `No location found for “${city}”. Try a nearby city or a more specific name.`,
      404,
    );
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: units,
    wind_speed_unit: units === "fahrenheit" ? "mph" : "kmh",
    timezone: "auto",
    forecast_days: "5",
  });
  const response = await fetchFn(forecast, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new AppError(
      "The weather service is unavailable. Try again shortly.",
      502,
    );
  const data = await response.json();
  if (!data.current || !data.daily?.time)
    throw new AppError("The weather service returned incomplete data.", 502);
  return {
    location: [location.name, location.admin1, location.country]
      .filter(Boolean)
      .join(", "),
    timezone: data.timezone,
    units,
    current: data.current,
    daily: data.daily,
    source: "https://open-meteo.com/",
    fetchedAt: new Date().toISOString(),
  };
}
