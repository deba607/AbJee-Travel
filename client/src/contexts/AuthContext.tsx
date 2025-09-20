import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';

interface AuthContextType {
  currentUser: any | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signup: (email: string, password: string, additionalData?: any) => Promise<{ success: boolean; user: any }>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  username?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Create user profile in Firestore
  const createUserProfile = async (user: any, additionalData?: any) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const { displayName, email, photoURL } = user;
      const createdAt = new Date();

      const profileData: UserProfile = {
        uid: user.uid,
        email: email || '',
        displayName: displayName || '',
        photoURL: photoURL || '',
        createdAt,
        updatedAt: createdAt,
        ...additionalData,
      };

      try {
        await setDoc(userRef, profileData);
        setUserProfile(profileData);
      } catch (error) {
        console.error('Error creating user profile:', error);
      }
    } else {
      setUserProfile(userSnap.data() as UserProfile);
    }
  };

  // Sign up with email and password
const signup = async (email: string, password: string, additionalData?: any) => {
  try {
    // Input validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Create user with email and password
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update display name if provided
    if (additionalData?.firstName && additionalData?.lastName) {
      const displayName = `${additionalData.firstName} ${additionalData.lastName}`;
      await updateProfile(user, { displayName });
      additionalData.displayName = displayName;
    }

    // Create user profile in Firestore
    await createUserProfile(user, additionalData);
    
    return { success: true, user };
  } catch (error: any) {
    console.error('Signup error:', error);
    let errorMessage = 'Failed to create account. Please try again.';
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered. Please use a different email or sign in.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    }
    
    throw new Error(errorMessage);
  }
};

  // Sign in with email and password
  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // Sign in with Google
  const loginWithGoogle = async () => {
    const { user } = await signInWithPopup(auth, googleProvider);
    await createUserProfile(user);
  };

  // Sign out
  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  // Reset password
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Update user profile
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const updatedData = {
      ...data,
      updatedAt: new Date(),
    };

    await setDoc(userRef, updatedData, { merge: true });
    
    if (userProfile) {
      setUserProfile({ ...userProfile, ...updatedData });
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Load user profile from Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
