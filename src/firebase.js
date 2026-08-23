// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyASYodoZmauhBfqt69-pot7L4ZQXK-dHpc",
  authDomain: "streamer-calculator.firebaseapp.com",
  projectId: "streamer-calculator",
  storageBucket: "streamer-calculator.firebasestorage.app",
  messagingSenderId: "743405321749",
  appId: "1:743405321749:web:279e97b00ac61dce01d81c",
  measurementId: "G-B994Q4NV0Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app)
