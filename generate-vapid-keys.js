// const webpush = require('web-push');
import webpush from 'web-push';


const vapidKeys = webpush.generateVAPIDKeys();

import logger from './utils/logger.js';

logger.info('VAPID Public Key:', vapidKeys.publicKey);
logger.info('VAPID Private Key:', vapidKeys.privateKey);
