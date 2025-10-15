// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyC-iWgVUvZo9oF-15MNPjB_BoZRyNdumAo",
  authDomain: "fooddude-52fc8.firebaseapp.com",
  projectId: "fooddude-52fc8",
  storageBucket: "fooddude-52fc8.firebasestorage.app",
  messagingSenderId: "680960914063",
  appId: "1:680960914063:web:16e9d6bd4810f642f636fa"
};


// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with React Native persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore instance
const db = getFirestore(app);

export { app, auth, db };