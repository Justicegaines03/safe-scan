import 'react-native-gesture-handler/jestSetup';

// Mock expo-camera with the new API
import 'jest-expo/src/preset/setup';
import '@testing-library/jest-dom';

// Mock expo-camera with SDK 53 compatibility
jest.mock('expo-camera', () => ({
  CameraView: jest.fn(({ children, ...props }) => {
    const React = require('react');
    return React.createElement('div', { 
      'data-testid': 'camera-view',
      'data-barcode-scanner-enabled': props.barcodeScannerSettings?.barcodeTypes?.length > 0,
      ...props 
    }, children);
  }),
  useCameraPermissions: jest.fn(() => [
    { granted: true, status: 'granted' },
    jest.fn(() => Promise.resolve({ granted: true, status: 'granted' }))
  ]),
  BarcodeFormat: {
    QR_CODE: 'qr',
    CODE_128: 'code128',
    DATA_MATRIX: 'datamatrix'
  },
  CameraType: {
    back: 'back',
    front: 'front'
  }
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true))
}));

// Mock expo-haptics with SDK 53 API
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Rigid: 'rigid',
    Soft: 'soft'
  },
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error'
  }
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn()
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: jest.fn(({ children, ...props }) => {
    const React = require('react');
    return React.createElement('a', props, children);
  }),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn()
  }
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([]))
}));

// Mock React Native components
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default)
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 }))
  },
  Alert: {
    alert: jest.fn()
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: {
    create: jest.fn((styles) => styles),
    hairlineWidth: 1
  },
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator'
}));

// Mock themed components
jest.mock('@/components/ThemedText', () => {
  const React = require('react');
  return jest.fn(({ children, ...props }) => 
    React.createElement('span', { 'data-testid': 'themed-text', ...props }, children)
  );
});

jest.mock('@/components/ThemedView', () => {
  const React = require('react');
  return jest.fn(({ children, ...props }) => 
    React.createElement('div', { 'data-testid': 'themed-view', ...props }, children)
  );
});

// Mock constants
jest.mock('@/constants/Colors', () => ({
  light: {
    text: '#000000',
    background: '#ffffff',
    tint: '#007AFF',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#007AFF'
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    tint: '#007AFF',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#007AFF'
  }
}));

// Mock hooks
jest.mock('@/hooks/useThemeColor', () => 
  jest.fn(() => '#007AFF')
);

jest.mock('@/hooks/useColorScheme', () =>
  jest.fn(() => 'light')
);

// Global test utilities
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  })
);

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is deprecated')
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Mock WebSocket for backend tests
global.WebSocket = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1 // WebSocket.OPEN
}));

// Mock performance API for timing tests
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  navigation: {},
  timing: {}
};

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

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  Stack: {
    Screen: jest.fn(),
  },
  Tabs: {
    Screen: jest.fn(),
  },
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

// Mock React Native components
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 400, height: 800 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Platform: {
      OS: 'ios',
      select: jest.fn((obj) => obj.ios || obj.default),
    },
  };
});

// Mock themed components
jest.mock('@/components/ThemedText', () => {
  const React = require('react');
  return {
    ThemedText: React.forwardRef((props, ref) => 
      React.createElement('text', { ...props, ref })
    ),
  };
});

jest.mock('@/components/ThemedView', () => {
  const React = require('react');
  return {
    ThemedView: React.forwardRef((props, ref) => 
      React.createElement('view', { ...props, ref })
    ),
  };
});

jest.mock('@/constants/Colors', () => ({
  Colors: {
    light: {
      text: '#11181C',
      background: '#fff',
      tint: '#0a7ea4',
      icon: '#687076',
      tabIconDefault: '#687076',
      tabIconSelected: '#0a7ea4',
    },
    dark: {
      text: '#ECEDEE',
      background: '#151718',
      tint: '#fff',
      icon: '#9BA1A6',
      tabIconDefault: '#9BA1A6',
      tabIconSelected: '#fff',
    },
  },
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));
