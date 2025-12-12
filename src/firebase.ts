// src/firebase.ts — CAPACITOR + iOS SIMULATOR PERFECT
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  indexedDBLocalPersistence,
  browserLocalPersistence,
  initializeAuth 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: "AIzaSyC-iWgVUvZo9oF-15MNPjB_BoZRyNdumAo",
  authDomain: "fooddude-52fc8.firebaseapp.com",
  projectId: "fooddude-52fc8",
  storageBucket: "fooddude-52fc8.firebasestorage.app",
  messagingSenderId: "680960914063",
  appId: "1:680960914063:web:16e9d6bd4810f642f636fa"
};

const app = initializeApp(firebaseConfig);

const auth = Capacitor.isNativePlatform() 
  ? initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    })
  : getAuth(app);

const db = getFirestore(app);

export { auth, db };