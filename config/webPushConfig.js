
import webpush from 'web-push';
import 'dotenv/config';

const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY

webpush.setVapidDetails(
  'mailto:admin@example.com',
  publicKey,
  privateKey
);

export default webpush;
