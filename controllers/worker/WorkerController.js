import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class WorkerController {
  static verifyLocationCode = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { securityCode, workerPhone } = req.body;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        locationSharingWorkerPhone: workerPhone,
        locationSharingCode: securityCode,
        locationSharingCodeExpiresAt: { gt: new Date() },
      },
    });

    if (!job) {
      return handleResponse(401, 'Invalid security code or phone number', null, res);
    }

    const token = generateToken({ jobId, workerPhone }, '1h');

    return handleResponse(200, 'Security code verified successfully', { token }, res);
  });

  static startTravel = asyncHandler(async (req, res) => {
    const { jobId } = req.worker;

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        travelStatus: 'STARTED',
        isLocationTracking: true,
      },
    });

    // Notify user
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          updatedJob.userId,
          'WORKER_ON_THE_WAY',
          'Worker on the way',
          `The worker is on the way for the job: ${updatedJob.title}`,
          { jobId, cta: 'TRACK_WORKER' }
        );
      }
    } catch (e) {
      // Silently handle notification errors
    }

    return handleResponse(200, 'Travel started successfully', { job: updatedJob }, res);
  });

  static updateLocation = asyncHandler(async (req, res) => {
    const { jobId } = req.worker;
    const { latitude, longitude } = req.body;

    const job = await prisma.job.findUnique({ where: { id: jobId } });

    if (!job.isLocationTracking || job.travelStatus !== 'STARTED') {
      return handleResponse(400, 'Location tracking is not active for this job', null, res);
    }

    const locationUpdate = await prisma.locationUpdate.create({
      data: {
        jobId,
        userId: job.userId,
        latitude,
        longitude,
      },
    });

    // Broadcast location update to user
    try {
      const socketService = req.app.get('socketService');
      if (socketService) {
        socketService.io.to(`user_${job.userId}`).emit('location_update', {
          jobId,
          latitude,
          longitude,
        });
      }
    } catch (error) {
      // Silently handle broadcast errors
    }

    return handleResponse(200, 'Location updated successfully', { locationUpdate }, res);
  });
}

export default WorkerController;