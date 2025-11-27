import admin from 'firebase-admin';
import logger from '../utils/logger.js';
import fs from 'fs';

let initialized = false;

const init = () => {
  if (initialized) return;
  try {
    const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!svcJson) {
      logger.info('Firebase service account not configured; pushService disabled');
      return;
    }

    let serviceAccount;
    if (svcJson.trim().startsWith('{')) {
      serviceAccount = JSON.parse(svcJson);
    } else if (fs.existsSync(svcJson)) {
      serviceAccount = JSON.parse(fs.readFileSync(svcJson, 'utf8'));
    } else {
      logger.warn('FIREBASE_SERVICE_ACCOUNT_PATH provided but file not found');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    logger.info('Firebase Admin initialized for push notifications');
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin:', err);
  }
};

const sendToTokens = async (tokens = [], payload = {}) => {
  if (!tokens || tokens.length === 0) return;
  if (!initialized) init();
  if (!initialized) return;

  try {
    const message = {
      notification: {
        title: payload.title || '',
        body: payload.body || '',
      },
      data: payload.data || {},
      tokens,
    };

    const res = await admin.messaging().sendMulticast(message);
    logger.info('Push notifications sent', { successCount: res.successCount, failureCount: res.failureCount });
    return res;
  } catch (err) {
    logger.error('Failed to send push notifications:', err);
  }
};

export default { init, sendToTokens };
