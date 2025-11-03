import { Worker } from 'bullmq';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || "root";

const notificationWorker = new Worker('notification-queue', async (job) => {
  const { type, data } = job.data;

  if (type === 'sms') {
    console.log(`Sending SMS to ${data.phone} with message: ${data.message}`);
  }
}, {
  connection: {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
  },
});

console.log('Notification worker started');

export default notificationWorker;