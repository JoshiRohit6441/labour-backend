import { jobExpirationQueue } from '../../config/queue.js';
import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';
import { calculateDistance } from '../../utils/helpers.js';

class ImmediateJobController {
  static createJob = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      title,
      description,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      numberOfWorkers,
      requiredSkills,
      budget,
    } = req.body;

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const job = await prisma.job.create({
      data: {
        userId,
        title,
        description,
        jobType: 'IMMEDIATE',
        address,
        city,
        state,
        pincode,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        workersNeeded: numberOfWorkers,
        numberOfWorkers,
        requiredSkills,
        budget,
        isLocationTracking: true,
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Add job to expiration queue
    await jobExpirationQueue.add('expire-job', { jobId: job.id }, { delay: 300000 }); // 5 minutes

    // Notify nearby contractors
    try {
      const requiredSkillsArray = Array.isArray(requiredSkills) ? requiredSkills : (requiredSkills ? [requiredSkills] : []);

      let contractorIdsBySkill = [];
      if (requiredSkillsArray.length > 0) {
        const skillMatches = await prisma.worker.findMany({
          where: { skills: { hasSome: requiredSkillsArray } },
          select: { contractorId: true },
          distinct: ['contractorId'],
        });
        contractorIdsBySkill = skillMatches.map((s) => s.contractorId);
      }

      const contractors = await prisma.contractor.findMany({
        where: {
          isActive: true,
          businessLatitude: { not: null },
          businessLongitude: { not: null },
          ...(contractorIdsBySkill.length > 0 ? { id: { in: contractorIdsBySkill } } : {}),
        },
        select: { id: true, userId: true, coverageRadius: true, businessLatitude: true, businessLongitude: true },
      });

      const nearbyUserIds = contractors
        .filter((c) => {
          const distKm = calculateDistance(
            Number(job.latitude),
            Number(job.longitude),
            Number(c.businessLatitude),
            Number(c.businessLongitude)
          );
          return isFinite(distKm) && distKm <= Number(c.coverageRadius);
        })
        .map((c) => c.userId);

      if (nearbyUserIds.length > 0) {
        const socketService = req.app.get('socketService');
        if (socketService && socketService.sendNotificationToUsers) {
          await socketService.sendNotificationToUsers(
            nearbyUserIds,
            'JOB_REQUEST',
            'New job near you',
            `${job.title} • ${job.city}`,
            { jobId: job.id, jobType: job.jobType, city: job.city, cta: 'SEE_JOB' }
          );
        }
      }
    } catch (e) {
    }

    return handleResponse(201, 'Immediate job created successfully!', { job }, res);
  });
}

export default ImmediateJobController;