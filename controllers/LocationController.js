
import prisma from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import handleResponse from '../utils/handleResponse.js';

// Generate a 6-digit random code
const generateSecurityCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

class LocationController {
  // Called by Contractor to generate a code for a worker
  static shareLocation = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { workerPhone } = req.body;
    const userId = req.user.id; // This is the contractor's user ID

    if (!workerPhone) {
      return handleResponse(400, 'Worker phone number is required.', null, res);
    }

    // 1. Verify the job belongs to the contractor
    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(403, 'User is not a contractor.', null, res);
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, contractorId: contractor.id },
    });

    if (!job) {
      return handleResponse(404, 'Job not found or not assigned to this contractor.', null, res);
    }
    
    if (job.jobType !== 'IMMEDIATE') {
        return handleResponse(400, 'Location sharing is only available for IMMEDIATE jobs.', null, res);
    }

    // 2. Generate code and expiry
    const securityCode = generateSecurityCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Expires in 15 minutes

    // 3. Update the job with sharing info
    await prisma.job.update({
      where: { id: jobId },
      data: {
        locationSharingCode: securityCode,
        locationSharingWorkerPhone: workerPhone,
        locationSharingCodeExpiresAt: expiresAt,
      },
    });

    // 4. Return the code to the contractor to share with the worker
    return handleResponse(
      200, 
      `Security code generated for worker. Share this code with the worker: ${securityCode}`,
      { securityCode, expiresAt }, 
      res
    );
  });

  // Called by the worker to verify the code and get a token
  static verifyLocationCode = asyncHandler(async (req, res) => {
    const { workerPhone, securityCode } = req.body;

    if (!workerPhone || !securityCode) {
      return handleResponse(400, 'Worker phone number and security code are required.', null, res);
    }

    const job = await prisma.job.findFirst({
      where: {
        locationSharingWorkerPhone: workerPhone,
        locationSharingCode: securityCode,
        locationSharingCodeExpiresAt: { gt: new Date() },
      },
    });

    if (!job) {
      return handleResponse(401, 'Invalid phone number, code, or code has expired.', null, res);
    }

    // For simplicity, we'll return the job ID. In a real-world scenario, we would return a JWT.
    return handleResponse(200, 'Verification successful.', { jobId: job.id }, res);
  });

  // Called by the contractor or the verified worker to update location
  static updateLocation = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { latitude, longitude } = req.body;
    // In a real-world scenario, we would get the user/worker ID from a JWT.
    // For now, we'll assume the request is authorized.

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return handleResponse(404, 'Job not found.', null, res);
    }

    const locationUpdate = await prisma.locationUpdate.create({
      data: {
        jobId,
        latitude,
        longitude,
        // We would associate this with the user/worker ID.
        userId: job.userId, // Placeholder
      },
    });

    // Broadcast the location update to the user
    const socketService = req.app.get('socketService');
    if (socketService && socketService.io) {
      socketService.io.to(`job_${jobId}`).emit('location:update', {
        latitude,
        longitude,
      });
    }

    return handleResponse(200, 'Location updated.', { locationUpdate }, res);
  });
}

export default LocationController;
