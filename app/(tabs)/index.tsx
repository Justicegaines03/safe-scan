import { StyleSheet, Text, View, TouchableOpacity, Platform, Alert, Linking, ActivityIndicator } from 'react-native';
import React, { useState, useEffect } from 'react';
import { CameraView, CameraType, BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';
import { VirusTotalService, VirusTotalResult } from '../../services/virusTotalService';

const Index = () => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<VirusTotalResult | null>(null);

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: BarcodeScanningResult) => {
    if (isScanning) return; // Prevent multiple scans
    
    setIsScanning(true);
    setScannedData(data);
    
    try {
      // Validate with VirusTotal
      const result = await VirusTotalService.validateQRCode(data);
      setScanResult(result);
      
      // Show security alert
      if (!result.isSecure && result.positives > 0) {
        Alert.alert(
          "⚠️ Security Warning",
          `${result.message}\n\nDo you want to proceed anyway?`,
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "View Details", 
              onPress: () => result.permalink && Linking.openURL(result.permalink) 
            },
            { 
              text: "Proceed Anyway", 
              style: "destructive",
              onPress: () => openQRContent(data)
            }
          ]
        );
      } else {
        // Safe to proceed or show info
        Alert.alert(
          "Security Check Complete",
          result.message,
          [
            { text: "OK" },
            { 
              text: "Open", 
              onPress: () => openQRContent(data)
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to validate QR code security. Proceed with caution.");
    } finally {
      setIsScanning(false);
    }
  };

  const openQRContent = (data: string) => {
    // Check if it's a URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = data.match(urlRegex);
    
    if (urls && urls.length > 0) {
      Linking.openURL(urls[0]);
    } else {
      // For non-URL QR codes, just show the data
      Alert.alert("QR Code Content", data);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <WebView
          source={{ uri: 'https://qrcodescan.in/' }}
          style={{ flex: 1, width: '100%' }}
          onMessage={(event) => setScannedData(event.nativeEvent.data)}
        />
        {scannedData && (
          <View style={styles.resultContainer}>
            <Text style={styles.text}>Scanned Data: {scannedData}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setScannedData(null);
                setScanResult(null);
              }}
            >
              <Text style={styles.buttonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {scannedData ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>QR Code Scanned</Text>
          <Text style={styles.text}>Data: {scannedData}</Text>
          
          {isScanning && (
            <View style={styles.scanningContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.scanningText}>Checking with VirusTotal...</Text>
            </View>
          )}
          
          {scanResult && !isScanning && (
            <View style={styles.securityContainer}>
              <Text style={[styles.securityText, { 
                color: scanResult.isSecure ? '#4CAF50' : '#F44336' 
              }]}>
                {scanResult.message}
              </Text>
              {scanResult.total > 0 && (
                <Text style={styles.detailText}>
                  Security Check: {scanResult.positives}/{scanResult.total} vendors flagged this
                </Text>
              )}
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => openQRContent(scannedData)}
            >
              <Text style={styles.buttonText}>Open Content</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setScannedData(null);
                setScanResult(null);
              }}
            >
              <Text style={styles.buttonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <CameraView
          style={styles.camera}
          facing={facing}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"]
          }}
          onBarcodeScanned={isScanning ? undefined : handleBarCodeScanned}
        >
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={() => setFacing(current => (current === 'back' ? 'front' : 'back'))}
              disabled={isScanning}
            >
              <Text style={styles.flipText}>Flip Camera</Text>
            </TouchableOpacity>
            {isScanning ? (
              <View style={styles.scanningContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.scanText}>Validating with VirusTotal...</Text>
              </View>
            ) : (
              <Text style={styles.scanText}>Position QR code in frame to scan</Text>
            )}
          </View>
        </CameraView>
      )}
    </View>
  );
};

export default Index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginVertical: 10,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 5,
    marginTop: 10,
    flex: 1,
    marginHorizontal: 5,
  },
  secondaryButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanningContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  scanningText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  securityContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 15,
    borderRadius: 10,
    marginVertical: 15,
    alignItems: 'center',
  },
  securityText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  flipButton: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 5,
  },
  flipText: {
    fontSize: 16,
    color: '#fff',
  },
});
