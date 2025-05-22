
import { Buffer } from 'buffer';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BleManager, Device, Service } from 'react-native-ble-plx';
import { HeatmapChart } from './src/components/heat-map';

const YOUR_SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB';
const YOUR_CHARACTERISTIC_UUID = '00002A37-0000-1000-8000-00805F9B34FB';

const bleManager = new BleManager();

const App = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [receivedDataLog, setReceivedDataLog] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [currentHeatmapData, setCurrentHeatmapData] = useState<number[][]>([]);

  const scanActive = useRef(false);

  const requestAndroidPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;

      const bluetoothScanPermission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN;
      const bluetoothConnectPermission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
      const fineLocationPermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

      const permissions = [];
      if (apiLevel >= 31) {
        permissions.push(bluetoothScanPermission);
        permissions.push(bluetoothConnectPermission);
      }
      permissions.push(fineLocationPermission);

      const granted = await PermissionsAndroid.requestMultiple(permissions);

      const allPermissionsGranted = permissions.every(
        (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allPermissionsGranted) {
        Alert.alert(
          'Permissions Required',
          'This application needs Bluetooth and location permissions to function correctly.'
        );
        return false;
      }
    }
    return true;
  }, []);

  useEffect(() => {
    const subscription = bleManager.onStateChange((state) => {
      console.log('Bluetooth state changed:', state);
      const isEnabled = state === 'PoweredOn';
      setBluetoothEnabled(isEnabled);

      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth to scan for devices.'
        );
        setDevices([]);
        setConnectedDevice(null);
        setIsScanning(false);
        setCurrentHeatmapData([]);
        if (scanActive.current) {
          bleManager.stopDeviceScan();
          scanActive.current = false;
        }
      }
    }, true);

    requestAndroidPermissions();

    return () => {
      subscription.remove();
      if (scanActive.current) {
        bleManager.stopDeviceScan();
        scanActive.current = false;
      }
    };
  }, [requestAndroidPermissions]);

  const startScan = useCallback(() => {
    if (!bluetoothEnabled) {
      Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for devices.');
      return;
    }

    setDevices([]);
    setIsScanning(true);
    scanActive.current = true;
    setReceivedDataLog(['Starting scan...']);
    console.log('Starting scan...');

    bleManager.startDeviceScan(
      null,
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          Alert.alert('Scan Error', error.message || 'An error occurred during scanning.');
          setIsScanning(false);
          scanActive.current = false;
          bleManager.stopDeviceScan();
          return;
        }

        if (device) {
          setDevices((prevDevices) => {
            if (!prevDevices.some((d) => d.id === device.id)) {
              return [...prevDevices, device];
            }
            return prevDevices;
          });
          setReceivedDataLog((prev) => [`Discovered: ${device.name || device.id} (RSSI: ${device.rssi})`, ...prev.slice(0, 19)]);
        }
      }
    );

    setTimeout(() => {
      if (scanActive.current) {
        bleManager.stopDeviceScan();
        scanActive.current = false;
      }
      setIsScanning(false);
      console.log('Scan completed.');
      setReceivedDataLog((prev) => ['Scan completed.', ...prev]);
    }, 10000);
  }, [bluetoothEnabled]);

  const connectToDevice = useCallback(async (device: Device) => {
    if (isScanning) {
      if (scanActive.current) {
        bleManager.stopDeviceScan();
        scanActive.current = false;
      }
      setIsScanning(false);
    }

    setReceivedDataLog(['Attempting to connect...']);
    console.log(`Attempting to connect to: ${device.id}`);

    try {
      const connected = await device.connect();
      setConnectedDevice(connected);
      console.log('Device connected:', connected.name || connected.id);
      setReceivedDataLog((prev) => [`Connected to: ${connected.name || connected.id}`, ...prev]);

      connected.onDisconnected((error, disconnectedDevice) => {
        if (error) {
          console.error('Unexpected disconnection error:', error);
        } else {
          console.log(`Device ${disconnectedDevice.name || disconnectedDevice.id} was disconnected.`);
        }
        setConnectedDevice(null);
        setCurrentHeatmapData([]);
        setReceivedDataLog(prev => ([`Device disconnected: ${disconnectedDevice.name || disconnectedDevice.id}`, ...prev]));
      });

      console.log('Starting discoverAllServicesAndCharacteristics...');
      await connected.discoverAllServicesAndCharacteristics();
      console.log('discoverAllServicesAndCharacteristics completed.');

      console.log('State of connected.services AFTER discovery:', connected.services, ' (Type:', typeof connected.services, Array.isArray(connected.services) ? 'Is Array' : 'Is Not Array', ')');
      console.log('State of connected.characteristics AFTER discovery:', connected.characteristics, ' (Type:', typeof connected.characteristics, Array.isArray(connected.characteristics) ? 'Is Array' : 'Is Not Array', ')');

      let currentServices: Service[] = [];
      if (Array.isArray(connected.services)) {
        currentServices = connected.services;
      } else if (typeof connected.services === 'function') {
        console.warn('connected.services is a function, attempting to call it...');
        try {
          const result = (connected.services as any)();
          if (Array.isArray(result)) {
            currentServices = result;
            console.log('connected.services() returned an array of services.');
          } else {
            console.error('connected.services() did not return an array:', result);
          }
        } catch (funcError) {
          console.error('Error calling connected.services():', funcError);
        }
      } else {
        console.error('connected.services is neither an array nor a function:', connected.services);
      }

      if (!currentServices || currentServices.length === 0) {
        console.error('Error: No valid services obtained from the device.');
        Alert.alert(
          'Services Error',
          'Could not find valid services on the device. Please ensure the BLE device is configured correctly.'
        );
        await connected.cancelConnection();
        setConnectedDevice(null);
        return;
      }

      const serviceUUID = YOUR_SERVICE_UUID.toLowerCase();
      const characteristicUUID = YOUR_CHARACTERISTIC_UUID.toLowerCase();

      const service = currentServices.find(s => s.uuid.toLowerCase() === serviceUUID);

      if (!service) {
        console.error(`Error: Service ${YOUR_SERVICE_UUID.substring(0, 8)}... not found.`);
        Alert.alert(
          'Service Error',
          `The service with UUID "${YOUR_SERVICE_UUID.substring(0, 8)}..." was not found on the device.`
        );
        await connected.cancelConnection();
        setConnectedDevice(null);
        return;
      }

      console.log('Characteristics found for the service (expected array):', service.characteristics, ' (Type:', typeof service.characteristics, Array.isArray(service.characteristics) ? 'Is Array' : 'Is Not Array', ')');

      if (!service.characteristics || !Array.isArray(service.characteristics) || service.characteristics.length === 0) {
        console.error(`Error: No characteristics found for service ${service.uuid}.`);
        Alert.alert(
          'Characteristic Error',
          `No characteristics found for service "${service.uuid.substring(0, 8)}...".`
        );
        await connected.cancelConnection();
        setConnectedDevice(null);
        return;
      }

      const characteristic = service.characteristics.find(c => c.uuid.toLowerCase() === characteristicUUID);

      if (!characteristic) {
        console.error(`Error: Characteristic ${YOUR_CHARACTERISTIC_UUID.substring(0, 8)}... not found in service ${service.uuid}.`);
        Alert.alert(
          'Characteristic Error',
          `The characteristic with UUID "${YOUR_CHARACTERISTIC_UUID.substring(0, 8)}..." was not found in the service.`
        );
        await connected.cancelConnection();
        setConnectedDevice(null);
        return;
      }

      console.log(`Starting notifications for ${characteristic.uuid}...`);
      characteristic.monitor((error, char) => {
        if (error) {
          console.error('Notification error:', error);
          Alert.alert('Notification Error', error.message || 'Error receiving data.');
          return;
        }
        if (char && char.value) {
          try {
            const base64Decoded = Buffer.from(char.value, 'base64');
            const flags = base64Decoded.readUInt8(0);
            let heartRate: number;

            if ((flags & 0x01) === 0) {
                heartRate = base64Decoded.readUInt8(1);
            } else {
                heartRate = base64Decoded.readUInt16LE(1);
            }

            setReceivedDataLog((prev) => [`Received HR: ${heartRate} bpm`, ...prev.slice(0, 19)]);
            console.log(`Heart Rate Received: ${heartRate} bpm`);

            const heatmapRow = [heartRate, heartRate + 2, heartRate - 1, heartRate + 5, heartRate - 3];
            setCurrentHeatmapData(prev => {
                const updatedData = [...prev, heatmapRow].slice(-5);
                return updatedData;
            });

          } catch (parseError) {
            console.error('Error parsing data for heatmap:', parseError);
            setReceivedDataLog((prev) => [`Parse Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`, ...prev.slice(0, 19)]);
          }
        }
      });

      Alert.alert('Connected', `Connected to ${connected.name || 'Unnamed Device'} and ready to receive data.`);
    } catch (error: any) {
      console.error('Error connecting or configuring (top level):', error);
      Alert.alert('Connection Error', `Failed to connect: ${error.message || error}`);
      if (device && device.id) {
        device.cancelConnection().catch(e => console.error('Error canceling connection', e));
      }
      setConnectedDevice(null);
      setCurrentHeatmapData([]);
    }
  }, [isScanning, setCurrentHeatmapData]);

  const sendData = useCallback(async (dataToSend: string) => {
    if (!connectedDevice) {
      Alert.alert('Error', 'No device connected.');
      return;
    }

    try {
      const serviceUUID = YOUR_SERVICE_UUID.toLowerCase();
      const characteristicUUID = YOUR_CHARACTERISTIC_UUID.toLowerCase();

      const base64Data = Buffer.from(dataToSend).toString('base64');

      console.log(`Sending data to ${connectedDevice.id}, Service: ${serviceUUID}, Characteristic: ${characteristicUUID}:`, dataToSend);
      await connectedDevice.writeCharacteristicWithResponseForService(
        serviceUUID,
        characteristicUUID,
        base64Data
      );
      setReceivedDataLog(prev => [`Data sent: "${dataToSend}"`, ...prev]);
      console.log('Data sent successfully.');
    } catch (error: any) {
      console.error('Error sending data:', error);
      Alert.alert('Error', `Failed to send data: ${error.message || error}`);
      setReceivedDataLog(prev => [`Error sending data: ${error.message || error}`, ...prev]);
    }
  }, [connectedDevice]);

  const disconnectDevice = useCallback(async () => {
    if (!connectedDevice) {
      Alert.alert('Info', 'No device is connected.');
      return;
    }

    try {
      console.log(`Disconnecting from ${connectedDevice.id}...`);
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
      setCurrentHeatmapData([]);
      setReceivedDataLog([`Disconnected from device ${connectedDevice.name || connectedDevice.id}`]);
      Alert.alert('Success', 'Device disconnected.');
    }
    catch (error: any) {
      console.error('Error disconnecting:', error);
      Alert.alert('Error', `Failed to disconnect from device: ${error.message || error}`);
    }
  }, [connectedDevice]);


  const renderDeviceItem = useCallback(({ item }: { item: Device }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}
    >
      <Text style={styles.deviceName}>{item.name || 'Unnamed Device'}</Text>
      <Text style={styles.deviceId}>ID: {item.id}</Text>
      <Text style={styles.deviceRssi}>RSSI: {item.rssi || 'N/A'} dBm</Text>
    </TouchableOpacity>
  ), [connectToDevice]);

  return (
    <View style={styles.container}>
      {!connectedDevice ? (
        <View style={styles.scanContainer}>
          <Text style={styles.title}>BLE Device Search</Text>

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Bluetooth Status: {bluetoothEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title={isScanning ? 'Scanning...' : 'Start Scan'}
              onPress={startScan}
              disabled={isScanning || !bluetoothEnabled}
            />
          </View>

          {isScanning && (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.scanningText}>Searching for devices...</Text>
            </View>
          )}

          <Text style={styles.listHeader}>Devices Found:</Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={renderDeviceItem}
            ListEmptyComponent={
              <Text style={styles.emptyListText}>
                {isScanning ? 'Searching...' : 'No devices found. Ensure Bluetooth and location are enabled and the BLE device is in advertising mode.'}
              </Text>
            }
            style={styles.deviceList}
            contentContainerStyle={devices.length === 0 ? styles.emptyListContainer : undefined}
          />

          <Text style={styles.subtitle}>Scan Log:</Text>
          <FlatList
            data={receivedDataLog}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => <Text style={styles.logItem}>{item}</Text>}
            style={styles.logList}
            ListEmptyComponent={<Text style={styles.emptyLogText}>No scan log yet.</Text>}
          />
        </View>
      ) : (
        <View style={styles.connectedContainer}>
          <Text style={styles.title}>
            Connected to: {connectedDevice.name || 'Unnamed Device'}
          </Text>
          <Text style={styles.deviceId}>ID: {connectedDevice.id}</Text>

          <View style={styles.actionButtonsContainer}>
            <View style={styles.buttonSpacer} />
            <Button title="Send Data (Test)" onPress={() => sendData('Test Data!')} />
            <View style={styles.buttonSpacer} />
            <Button title="Disconnect" onPress={disconnectDevice} color="red" />
          </View>

          <Text style={styles.subtitle}>Heatmap (Live Data):</Text>
          <View style={styles.heatmapContainer}>
            <HeatmapChart
              data={currentHeatmapData.length > 0 ? currentHeatmapData : [[0]]}
              title="Live Heart Rate Heatmap"
              minValue={0}
              maxValue={200}
            />
          </View>

          <Text style={styles.subtitle}>Communication Log:</Text>
          <FlatList
            data={receivedDataLog}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => <Text style={styles.logItem}>{item}</Text>}
            style={styles.logList}
            ListEmptyComponent={<Text style={styles.emptyLogText}>No data received yet.</Text>}
          />
        </View>
      )}
    </View>
  );
};

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: '#f5f5f5',
    },
    scanContainer: {
      flex: 1,
    },
    connectedContainer: {
      flex: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 16,
      color: '#2c3e50',
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 8,
      color: '#34495e',
    },
    statusContainer: {
      marginBottom: 16,
      padding: 8,
      backgroundColor: '#e8e8e8',
      borderRadius: 8,
    },
    statusText: {
      fontSize: 16,
      textAlign: 'center',
    },
    buttonContainer: {
      marginBottom: 16,
    },
    scanningIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 16,
    },
    scanningText: {
      marginLeft: 16,
      fontSize: 16,
      color: '#34495e',
    },
    listHeader: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 10,
      color: '#2c3e50',
    },
    deviceList: {
      flexGrow: 0,
      maxHeight: 250,
      marginBottom: 10,
    },
    deviceItem: {
      padding: 16,
      backgroundColor: '#fff',
      marginBottom: 8,
      borderRadius: 8,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    },
    deviceName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#2c3e50',
    },
    deviceId: {
      fontSize: 14,
      color: '#7f8c8d',
    },
    deviceRssi: {
      fontSize: 14,
      color: '#7f8c8d',
    },
    emptyListText: {
      textAlign: 'center',
      padding: 16,
      color: '#7f8c8d',
    },
    emptyListContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtonsContainer: {
      marginTop: 16,
    },
    buttonSpacer: {
      height: 12,
    },
    heatmapContainer: {
      backgroundColor: '#fff',
      padding: 8,
      borderRadius: 8,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      alignItems: 'center',
    },
    logList: {
      backgroundColor: '#fff',
      padding: 8,
      borderRadius: 8,
      marginTop: 8,
      maxHeight: 150,
      borderWidth: 1,
      borderColor: '#eee',
    },
    logItem: {
      fontSize: 14,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
      paddingVertical: 6,
      color: '#34495e',
    },
    emptyLogText: {
      textAlign: 'center',
      paddingVertical: 10,
      color: '#7f8c8d',
    },
    receivedData: {
      fontSize: 14,
      marginTop: 5,
      color: '#34495e',
    },
  });

export default App;
