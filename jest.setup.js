import 'react-native-gesture-handler/jestSetup';

// Mock expo modules
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(),
    getCameraPermissionsAsync: jest.fn(),
    Constants: {
      Type: {
        back: 'back',
        front: 'front'
      }
    }
  },
  BarCodeScanner: {
    requestPermissionsAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    Constants: {
      BarCodeType: {
        qr: 'qr'
      }
    }
  }
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
  canOpenURL: jest.fn(),
  parseURL: jest.fn()
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn()
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
};

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
