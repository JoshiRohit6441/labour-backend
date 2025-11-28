import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';
import { generateWorkerToken } from '../../utils/auth.js';

class WorkerController {
  static verifyLocationCode = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { securityCode, workerPhone } = req.body;

    const job = await prisma.job.findUnique({ where: { id: jobId } });

    if (!job || !job.locationSharingCode) {
      return handleResponse(404, 'Job not found or location sharing not enabled.', null, res);
    }

    if (job.locationSharingCode !== securityCode) {
      return handleResponse(401, 'Invalid security code.', null, res);
    }

    if (job.locationSharingWorkerPhone !== workerPhone) {
      return handleResponse(401, 'Phone number does not match.', null, res);
    }

    if (new Date() > job.locationSharingCodeExpiresAt) {
      return handleResponse(401, 'Security code has expired.', null, res);
    }

    const token = generateWorkerToken({ jobId, workerPhone });

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
          'TRACKING_STARTED',
          'Worker started journey',
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