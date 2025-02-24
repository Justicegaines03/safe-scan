import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useScanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';
import { WebView } from 'react-native-webview';

export default function Index() {
  const [hasPermission, setHasPermission] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const devices = useCameraDevices();
  const device = devices.back;

  const [frameProcessor, barcodes] = useScanBarcodes([BarcodeFormat.QR_CODE], {
    checkInverted: true,
  });

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();
  }, []);

  useEffect(() => {
    if (barcodes && barcodes.length > 0 && !scannedData) {
      setScannedData(barcodes[0].displayValue || '');
    }
  }, [barcodes]);

  const handleWebMessage = (event: any) => {
    setScannedData(event.nativeEvent.data);
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === 'authorized');
          }}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://unpkg.com/html5-qrcode"></script>
        <style>
          body { margin: 0; }
          #reader { width: 100vw; height: 100vh; }
          .result { position: fixed; top: 10px; left: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div id="reader"></div>
        <script>
          function onScanSuccess(decodedText, decodedResult) {
            window.ReactNativeWebView.postMessage(decodedText);
          }
          
          const html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", { fps: 10, qrbox: 250 }
          );
          html5QrcodeScanner.render(onScanSuccess);
        </script>
      </body>
      </html>
    `;

    return (
      <View style={styles.container}>
        <WebView
          source={{ html: htmlContent }}
          style={styles.webview}
          onMessage={handleWebMessage}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
        />
        {scannedData && (
          <View style={styles.overlay}>
            <Text style={styles.text}>Scanned: {scannedData}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setScannedData(null)}
            >
              <Text style={styles.buttonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={!scannedData}
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
          <Text style={styles.text}>Align QR code within the frame</Text>
          {scannedData && (
            <View>
              <Text style={styles.text}>Scanned: {scannedData}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setScannedData(null)}
              >
                <Text style={styles.buttonText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: 18,
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
