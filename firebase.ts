// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCdkzUITM44Sy7tpYi_JTRVB0sWoW3eiDo",
  authDomain: "insaneambition-66b76.firebaseapp.com",
  projectId: "insaneambition-66b76",
  storageBucket: "insaneambition-66b76.appspot.com",
  messagingSenderId: "864493557554",
  appId: "1:864493557554:web:1aa07e35cf414c94efa92b",
  measurementId: "G-Z63534XDBF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
