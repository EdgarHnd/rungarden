export type MetricSystem = 'metric' | 'imperial';

/**
 * Format distance based on metric system preference
 * @param meters - Distance in meters
 * @param metricSystem - User's preferred metric system
 * @returns Formatted distance string with unit
 */
export const formatDistance = (meters: number, metricSystem: MetricSystem = 'metric'): string => {
  if (!meters || meters === 0) return '0 km';

  if (metricSystem === 'imperial') {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(0)} mi`;
  } else {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(0)} km`;
  }
};

/**
 * Format distance value only (without unit)
 * @param meters - Distance in meters
 * @param metricSystem - User's preferred metric system
 * @returns Formatted distance value as string
 */
export const formatDistanceValue = (meters: number, metricSystem: MetricSystem = 'metric'): string => {
  if (!meters || meters === 0) return '0';

  if (metricSystem === 'imperial') {
    const miles = meters * 0.000621371;
    return miles.toFixed(1);
  } else {
    const kilometers = meters / 1000;
    return kilometers.toFixed(1);
  }
};

/**
 * Get distance unit based on metric system
 * @param metricSystem - User's preferred metric system
 * @returns Distance unit string
 */
export const getDistanceUnit = (metricSystem: MetricSystem = 'metric'): string => {
  return metricSystem === 'imperial' ? 'mi' : 'km';
};

/**
 * Format pace based on metric system preference
 * @param durationMinutes - Duration in minutes
 * @param distanceMeters - Distance in meters
 * @param metricSystem - User's preferred metric system
 * @returns Formatted pace string
 */
export const formatPace = (durationMinutes: number, distanceMeters: number, metricSystem: MetricSystem = 'metric'): string => {
  if (!durationMinutes || !distanceMeters || distanceMeters === 0) return '--:--';

  if (metricSystem === 'imperial') {
    // Convert to pace per mile
    const miles = distanceMeters * 0.000621371;
    const paceMinPerMile = durationMinutes / miles;
    const minutes = Math.floor(paceMinPerMile);
    const seconds = Math.round((paceMinPerMile - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
  } else {
    // Pace per kilometer
    const kilometers = distanceMeters / 1000;
    const paceMinPerKm = durationMinutes / kilometers;
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }
};

/**
 * Format duration from minutes to readable format
 * @param minutes - Duration in minutes
 * @returns Formatted duration string
 */
export const formatDuration = (minutes: number): string => {
  if (!minutes || minutes === 0) return '0 min';

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
};

/**
 * Format date for activity display
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format detailed date for activity detail view
 * @param dateString - ISO date string
 * @returns Formatted detailed date string
 */
export const formatDetailedDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Convert kilometers to meters
 * @param kilometers - Distance in kilometers
 * @returns Distance in meters
 */
export const kilometersToMeters = (kilometers: number): number => {
  return kilometers * 1000;
};

/**
 * Convert meters to kilometers
 * @param meters - Distance in meters
 * @returns Distance in kilometers
 */
export const metersToKilometers = (meters: number): number => {
  return meters / 1000;
};

/**
 * Convert miles to meters
 * @param miles - Distance in miles
 * @returns Distance in meters
 */
export const milesToMeters = (miles: number): number => {
  return miles / 0.000621371;
};

/**
 * Convert meters to miles
 * @param meters - Distance in meters
 * @returns Distance in miles
 */
export const metersToMiles = (meters: number): number => {
  return meters * 0.000621371;
}; 