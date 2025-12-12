// config-overrides.js
module.exports = function override(config) {
  // Make sure resolve exists
  config.resolve = config.resolve || {};

  config.resolve.fallback = {
    ...(config.resolve.fallback || {}),
    // sql.js tries to use Node core modules — but our app runs in a WebView,
    // and the REAL DB work happens natively via @capacitor-community/sqlite.
    fs: false,
    path: false,
    crypto: false,
  };

  return config;
};
