import React, { useEffect, useState, useCallback, useContext } from 'react';
import { View, StyleSheet, Platform, Linking, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import * as Location from 'expo-location';
import axios from 'axios';
import { EmployeeContext } from '../context/EmployeeContext';
import { buildApiUrl, withClientId } from '../lib/api';
import LocationMap from '../components/LocationMap';

type LocationDto = {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  radius: number;
};

type Props = {
  onStatusChange?: (status: 'Active' | 'Inactive' | 'Unknown') => void;
  onAddressChange?: (address: string | null) => void;
  onCoordsChange?: (coords: { latitude: number; longitude: number } | null) => void;
  inModal?: boolean;
  showOnlyStatus?: boolean;
  watchMode?: 'continuous' | 'once';
};

const LocationTest = ({
  onStatusChange,
  onAddressChange,
  onCoordsChange,
  inModal = false,
  showOnlyStatus = false,
  watchMode = 'continuous',
}: Props) => {
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [userLocation, setUserLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [status, setStatus] = useState<'Unknown' | 'Active' | 'Inactive'>('Unknown');
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [nearestLocation, setNearestLocation] = useState<LocationDto | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>('Detecting current location...');
  const [retryKey, setRetryKey] = useState(0);

  const { employee } = useContext(EmployeeContext);
  const clientId = employee?.clientId;

  useEffect(() => {
    const fetchLocations = async () => {
      if (!clientId) {
        setLocations([]);
        return;
      }

      try {
        const res = await axios.get(
          buildApiUrl('/api/locations'),
          { params: withClientId({}, clientId) }
        );
        setLocations(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.warn('Branch location lookup failed:', (error as any)?.message || error);
        setLocations([]);
        setLocationMessage('Branch locations are unavailable. Attendance location cannot be verified now.');
      }
    };

    fetchLocations();
  }, [clientId]);

  const getDistanceInMeters = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const toRad = (x: number) => (x * Math.PI) / 180;
      const earthRadius = 6371e3;
      const phi1 = toRad(lat1);
      const phi2 = toRad(lat2);
      const deltaPhi = toRad(lat2 - lat1);
      const deltaLambda = toRad(lon2 - lon1);

      const a =
        Math.sin(deltaPhi / 2) ** 2 +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadius * c;
    },
    []
  );

  const evaluateLocation = useCallback(
    async (coords: Pick<Location.LocationObjectCoords, 'latitude' | 'longitude'>) => {
      setUserLocation(coords as Location.LocationObjectCoords);
      onCoordsChange?.({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      let insideAnyZone = false;
      let matchedZone: LocationDto | null = null;

      for (const zone of locations) {
        const distance = getDistanceInMeters(
          coords.latitude,
          coords.longitude,
          zone.latitude,
          zone.longitude
        );
        if (distance <= zone.radius) {
          insideAnyZone = true;
          matchedZone = zone;
          break;
        }
      }

      const nextStatus: 'Active' | 'Inactive' = insideAnyZone ? 'Active' : 'Inactive';
      setStatus(nextStatus);
      setNearestLocation(matchedZone);
      onStatusChange?.(nextStatus);

      if (insideAnyZone && matchedZone) {
        setUserAddress(matchedZone.address);
        onAddressChange?.(matchedZone.address);
        setLocationMessage('You are inside your assigned location.');
        return;
      }

      try {
        const reverseResult = await Location.reverseGeocodeAsync(coords);
        if (reverseResult.length > 0) {
          const address = reverseResult[0];
          const formatted = [
            address.name,
            address.street,
            address.city,
            address.region,
            address.postalCode,
          ]
            .filter(Boolean)
            .join(', ');
          setUserAddress(formatted || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
          onAddressChange?.(formatted || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
        }
      } catch {
        const fallback = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
        setUserAddress(fallback);
        onAddressChange?.(fallback);
      }

      if (locations.length === 0) {
        setLocationMessage('No branch zone configured for your account. Submit location request to continue.');
      } else {
        setLocationMessage('You are outside assigned branch location.');
      }
    },
    [getDistanceInMeters, locations, onAddressChange, onCoordsChange, onStatusChange]
  );

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      try {
        setLocationMessage('Detecting current location...');

        const existingPermission = await Location.getForegroundPermissionsAsync();
        const permission =
          existingPermission.status === 'granted'
            ? existingPermission
            : await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          if (cancelled) return;
          setStatus('Unknown');
          setNearestLocation(null);
          setUserLocation(null);
          setLocationMessage('Location permission denied. Please allow browser location access.');
          onStatusChange?.('Unknown');
          onCoordsChange?.(null);
          onAddressChange?.(null);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!cancelled) {
          await evaluateLocation(current.coords);
        }

        if (watchMode === 'continuous') {
          if (Platform.OS === 'web') {
            // expo-location has a web unsubscribe bug in some versions; poll manually instead.
            intervalId = setInterval(async () => {
              if (cancelled) return;
              try {
                const next = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                if (!cancelled) {
                  await evaluateLocation(next.coords);
                }
              } catch {
                // Keep previous status if a single poll fails.
              }
            }, 8000);
          } else {
            sub = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 8000,
                distanceInterval: 5,
              },
              async (locationUpdate) => {
                if (cancelled) return;
                await evaluateLocation(locationUpdate.coords);
              }
            );
          }
        }
      } catch (err) {
        console.error('Location tracking error:', err);
        if (cancelled) return;
        setStatus('Unknown');
        setLocationMessage('Location not available. Enable location and tap Retry Location.');
        onCoordsChange?.(null);
        onAddressChange?.(null);
        onStatusChange?.('Unknown');
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (sub && typeof sub.remove === 'function') {
        try {
          sub.remove();
        } catch (error) {
          console.warn('Location subscription cleanup failed:', error);
        }
      }
    };
  }, [evaluateLocation, onAddressChange, onCoordsChange, onStatusChange, retryKey, watchMode]);

  const openDirections = () => {
    if (!nearestLocation) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${nearestLocation.latitude},${nearestLocation.longitude}`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${nearestLocation.latitude},${nearestLocation.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${nearestLocation.latitude},${nearestLocation.longitude}`,
    });
    if (url) {
      Linking.openURL(url);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {userLocation && locations.length > 0 && !showOnlyStatus && (
        <LocationMap
          inModal={inModal}
          userLocation={userLocation}
          locations={locations}
        />
      )}

      <View style={styles.statusPanel}>
        <Text
          style={[
            styles.statusText,
            {
              color:
                status === 'Active'
                  ? 'green'
                  : status === 'Inactive'
                    ? 'red'
                    : 'black',
            },
          ]}
        >
          Status: {status}
        </Text>

        {showOnlyStatus && !userLocation && (
          <Text style={{ marginTop: 8, color: '#999' }}>Getting location...</Text>
        )}

        {!!locationMessage && (
          <Text style={styles.metaText}>{locationMessage}</Text>
        )}

        {status === 'Unknown' && (
          <TouchableOpacity style={styles.retryButton} onPress={() => setRetryKey((prev) => prev + 1)}>
            <Text style={styles.retryButtonText}>Retry Location</Text>
          </TouchableOpacity>
        )}

        {status === 'Inactive' && !showOnlyStatus && nearestLocation && (
          <View style={{ marginTop: 10 }}>
            <TouchableOpacity style={styles.directionsButton} onPress={openDirections}>
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        )}

        {userAddress && (
          <Text style={styles.addressText}>{userAddress}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statusPanel: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  addressText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    color: '#555',
  },
  metaText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 12,
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  directionsButton: {
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LocationTest;
