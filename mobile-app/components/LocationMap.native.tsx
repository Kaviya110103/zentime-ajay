import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

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

const LocationMap = ({ inModal, userLocation, locations }: Props) => {
  return (
    <MapView
      style={inModal ? styles.modalMap : styles.map}
      provider={Platform.OS === 'android' ? 'google' : undefined}
      mapType="satellite"
      region={{
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
    >
      {locations.map((fence) => (
        <React.Fragment key={fence.id}>
          <Marker
            coordinate={fence}
            title={fence.name}
            description={fence.address}
          />
          <Circle
            center={fence}
            radius={fence.radius}
            strokeColor="rgba(0,255,0,0.8)"
            fillColor="rgba(0,255,0,0.3)"
          />
        </React.Fragment>
      ))}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '75%',
  },
  modalMap: {
    width: '100%',
    height: 250,
  },
});

export default LocationMap;
