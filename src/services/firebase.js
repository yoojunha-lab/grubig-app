import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// GRUBIG ERP - Firebase 초기화 싱글톤 (Environment Variables 적용 권장)
const firebaseConfig = {
  apiKey: "AIzaSyBVMPRApW7oMiWGGG_ILQaqfgkHeoHlJk8",
  authDomain: "grubig-app.firebaseapp.com",
  projectId: "grubig-app",
  storageBucket: "grubig-app.firebasestorage.app",
  messagingSenderId: "924930443548",
  appId: "1:924930443548:web:b5c19871f4417a263512d9",
  measurementId: "G-HGR6VH6TDX"
};

const app = initializeApp(firebaseConfig);
// ignoreUndefinedProperties: undefined 필드 자동 무시 (Firestore 기본은 에러)
// 일부 optional 필드가 undefined로 들어와도 저장 가능하게 안전망 역할.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
