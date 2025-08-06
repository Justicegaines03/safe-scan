module.exports = ({ config }) => {
  // Try to get API key from environment, fallback to test key if not available
  const virusTotalApiKey = process.env.VIRUS_TOTAL_API_KEY || '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';
  
  return {
    ...config,
    extra: {
      ...config.extra,
      VIRUSTOTAL_API_KEY: virusTotalApiKey,
    },
  };
};