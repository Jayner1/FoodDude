// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC-iWgVUvZo9oF-15MNPjB_BoZRyNdumAo",
  authDomain: "fooddude-52fc8.firebaseapp.com",
  projectId: "fooddude-52fc8",
  storageBucket: "fooddude-52fc8.firebasestorage.app",
  messagingSenderId: "680960914063",
  appId: "1:680960914063:web:16e9d6bd4810f642f636fa"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
