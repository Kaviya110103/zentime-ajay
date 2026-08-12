import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppTypography';

type LocationDto = {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  radius: number;
};

type Props = {
  inModal: boolean;
  userLocation: { latitude: number; longitude: number };
  locations: LocationDto[];
};

const LocationMap = ({ userLocation, locations }: Props) => {
  return (
    <View style={styles.fallback}>
      <Text style={styles.title}>Map preview is available in Android/iOS build.</Text>
      <Text style={styles.text}>
        Current: {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
      </Text>
      <Text style={styles.text}>Nearby zones: {locations.length}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    width: '100%',
    minHeight: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  text: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
  },
});

export default LocationMap;

