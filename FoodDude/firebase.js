// firebase.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC-iWgVUvZo9oF-15MNPjB_BoZRyNdumAo",
  authDomain: "fooddude-52fc8.firebaseapp.com",
  projectId: "fooddude-52fc8",
  storageBucket: "fooddude-52fc8.firebasestorage.app",
  messagingSenderId: "680960914063",
  appId: "1:680960914063:web:16e9d6bd4810f642f636fa"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);