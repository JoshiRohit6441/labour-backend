
import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class LocationController {
  static startTravel = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id,
      },
      include: {
        assignments: true,
      },
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to start travel', null, res);
    }

    if (!job.assignments || job.assignments.length === 0) {
      return handleResponse(400, 'You must assign at least one worker to the job before starting to travel.', null, res);
    }

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
          job.userId,
          'WORKER_ON_THE_WAY',
          'Worker on the way',
          `The worker is on the way for the job: ${job.title}`,
          { jobId, cta: 'TRACK_WORKER' }
        );
      }
      } catch (e) {
        // Silently handle notification errors
      }    return handleResponse(200, 'Travel started successfully', { job: updatedJob }, res);
  });

  static endTravel = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id,
      },
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to end travel', null, res);
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        travelStatus: 'ENDED',
        isLocationTracking: false,
      },
    });

    return handleResponse(200, 'Travel ended successfully', { job: updatedJob }, res);
  });

  static getTravelStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        OR: [
          { userId: userId },
          { contractor: { userId: userId } }
        ]
      },
      select: {
        travelStatus: true,
        isLocationTracking: true,
      }
    });

    if (!job) {
      return handleResponse(404, 'Job not found', null, res);
    }

    return handleResponse(200, 'Travel status fetched successfully', { job }, res);
  });

  static updateLocation = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id,
      },
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to update location', null, res);
    }

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

export default LocationController;
