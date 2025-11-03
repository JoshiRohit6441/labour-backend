
import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class MeetingController {
  static createMeeting = asyncHandler(async (req, res) => {
    const contractorId = req.user.id;
    const { jobId, meetingTime, location, notes } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true, jobType: true },
    });

    if (!job) {
      return handleResponse(404, 'Job not found', {}, res);
    }

    if (job.jobType !== 'BIDDING') {
      return handleResponse(400, 'Meetings can only be scheduled for bidding jobs', {}, res);
    }

    const meeting = await prisma.meeting.create({
      data: {
        jobId,
        contractorId,
        meetingTime: new Date(meetingTime),
        location,
        notes,
      },
    });

    // Notify user about the meeting
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      await socketService.sendNotificationToUsers(
        [job.userId],
        'MEETING_SCHEDULED',
        'Meeting Scheduled',
        `A contractor has scheduled a meeting for the job "${job.title}"`,
        { jobId: job.id, meetingId: meeting.id }
      );
    }

    return handleResponse(201, 'Meeting scheduled successfully', { meeting }, res);
  });
}

export default MeetingController;
