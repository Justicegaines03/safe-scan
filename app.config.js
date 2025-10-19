module.exports = ({ config }) => {
  // Try to get API key from environment, fallback to test key if not available
  const virusTotalApiKey = process.env.VIRUS_TOTAL_API_KEY

  return {
    ...config,
    extra: {
      ...config.extra,
      VIRUSTOTAL_API_KEY: virusTotalApiKey,
      router: {
        ...config.extra?.router,
        // Configure expo-router to use 'presentation' folder instead of 'app'
        appDir: './presentation',
      },
    },
  };
};