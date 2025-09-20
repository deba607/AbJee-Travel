import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyD2RQGDQWj6uv5zZfcNOwjbi8wX6vv61Ss",
    authDomain: "abjee-travel-4fc38.firebaseapp.com",
    projectId: "abjee-travel-4fc38",
    storageBucket: "abjee-travel-4fc38.firebasestorage.app",
    messagingSenderId: "1042055167342",
    appId: "1:1042055167342:web:4c9e26116cd60e9459d57f",
    measurementId: "G-VCZ3KW7NY1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);