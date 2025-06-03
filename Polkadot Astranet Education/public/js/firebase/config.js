/**
 * config.js
 * 
 * Firebase configuration and initialization for the Polkadot Educational Web Platform.
 * This module provides environment-specific configurations and initializes Firebase services.
 */

// Import Firebase SDK modules
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

/**
 * Environment-specific Firebase configurations
 */
const firebaseConfigs = {
  development: {
    apiKey: "YOUR_DEV_API_KEY",
    authDomain: "polkadot-edu-dev.firebaseapp.com",
    projectId: "polkadot-edu-dev",
    storageBucket: "polkadot-edu-dev.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456",
    measurementId: "G-DEV123456",
    databaseURL: "https://polkadot-edu-dev.firebaseio.com"
  },
  production: {
    apiKey: "YOUR_PROD_API_KEY",
    authDomain: "your-prod.firebaseapp.com",
    projectId: "your-prod",
    storageBucket: "your-prod.appspot.com",
    messagingSenderId: "YOUR_PROD_MSG_ID",
    appId: "YOUR_PROD_APP_ID",
    measurementId: "YOUR_PROD_MEASUREMENT_ID",
    databaseURL: "https://your-prod.firebaseio.com"
  }
};

/**
 * Determine the current environment
 * @returns {string} - 'development' or 'production'
 */
function getEnvironment() {
  // Use hostname to determine environment when served statically
  return window.location.hostname === 'localhost' ? 'development' : 'production';
}

/**
 * Get the appropriate Firebase configuration based on environment
 * @returns {Object} - Firebase configuration object
 */
function getFirebaseConfig() {
  const env = getEnvironment();
  console.log(`Initializing Firebase in ${env} environment`);
  return firebaseConfigs[env];
}

// Initialize Firebase with the appropriate configuration
const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const firestore = getFirestore(app);
const database = getDatabase(app);

// Initialize App Check for security (only in production)
if (getEnvironment() === 'production') {
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
    isTokenAutoRefreshEnabled: true
  });
}

/**
 * Firebase instance and services
 */
const firebase = {
  app,
  auth,
  firestore,
  database,
  config: firebaseConfig
};

// Export Firebase instance and services
export default firebase;
