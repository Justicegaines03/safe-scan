import Constants from 'expo-constants';

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
    baseUrl: 'https://www.virustotal.com/api/v3', // Updated to v3
    isAvailable: isVirusTotalApiAvailable(),
  },
};