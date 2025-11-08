import admin from './firebase-admin.js';

const initializeFirestore = async () => {
  try {
    console.log('🔄 Initializing Firestore...');

    // Get Firestore instance
    const db = admin.firestore();
    
    // Configure Firestore settings
    db.settings({
      ignoreUndefinedProperties: true,
    });

    console.log('✅ Firestore initialized successfully');
    console.log('📦 Database: Firebase Firestore');

    // Test connection by writing a test document
    try {
      await db.collection('_health').doc('check').set({
        status: 'connected',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Firestore connection test successful');
    } catch (testError) {
      console.warn('⚠️ Firestore connection test failed:', testError.message);
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('📦 Firestore connection closed through app termination');
      process.exit(0);
    });

    return db;

  } catch (error) {
    console.error('❌ Firestore initialization failed:', error.message);
    console.log('💡 Please ensure Firebase Admin SDK is properly configured');
    process.exit(1);
  }
};

export default initializeFirestore;
export const db = admin.firestore();
export { admin };
