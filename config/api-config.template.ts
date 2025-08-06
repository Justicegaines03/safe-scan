import Constants from 'expo-constants';

// Template for API configuration
// Copy this file to api-config.ts and replace the placeholder values

// Get the API key from Expo configuration
export const VIRUSTOTAL_API_KEY = Constants.expoConfig?.extra?.VIRUSTOTAL_API_KEY;

// Validate API key availability
export const isVirusTotalApiAvailable = (): boolean => {
  return !!(VIRUSTOTAL_API_KEY && VIRUSTOTAL_API_KEY !== "${VIRUS_TOTAL_API_KEY}");
};

// API configuration
export const API_CONFIG = {
  virusTotal: {
    apiKey: VIRUSTOTAL_API_KEY,
    baseUrl: 'https://www.virustotal.com/vtapi/v2',
    isAvailable: isVirusTotalApiAvailable(),
  },
};

// Instructions:
// 1. The API key is configured through app.config.js
// 2. app.config.js will try to read from environment variable VIRUS_TOTAL_API_KEY
// 3. If no environment variable is found, it falls back to the test API key
// 4. Make sure app.config.js is properly configured for your environment