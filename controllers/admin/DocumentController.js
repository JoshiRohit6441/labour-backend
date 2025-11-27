import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class AdminDocumentController {
  // Get all documents with filters
  static getDocuments = asyncHandler(async (req, res) => {
    const { verificationStatus, documentType, page = 1, limit = 10 } = req.query;

    const where = {};
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (documentType) where.documentType = documentType;

    const documents = await prisma.document.findMany({
      where,
      include: {
        contractor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.document.count({ where });

    return handleResponse(200, 'Documents retrieved successfully', {
      documents: documents.map(d => ({
        id: d.id,
        contractorId: d.contractorId,
        documentType: d.documentType,
        documentNumber: d.documentNumber,
        documentUrl: d.documentUrl,
        verificationStatus: d.verificationStatus,
        rejectionReason: d.rejectionReason,
        createdAt: d.createdAt,
        contractor: d.contractor,
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    }, res);
  });

  // Get document by ID
  static getDocumentById = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        contractor: {
          include: {
            user: true,
            jobs: {
              select: {
                id: true,
                title: true,
                status: true,
              }
            }
          }
        }
      }
    });

    if (!document) {
      return handleResponse(404, 'Document not found', {}, res);
    }

    return handleResponse(200, 'Document retrieved successfully', { document }, res);
  });

  // Verify document
  static verifyDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const adminId = req.user.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        contractor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    if (!document) {
      return handleResponse(404, 'Document not found', {}, res);
    }

    if (document.verificationStatus === 'VERIFIED') {
      return handleResponse(400, 'Document already verified', {}, res);
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: adminId,
        rejectionReason: null, // Clear any previous rejection reason
      },
      include: {
        contractor: true
      }
    });

    // Check if all contractor documents are now verified and update contractor verification status
    const pendingDocs = await prisma.document.count({
      where: {
        contractorId: document.contractorId,
        verificationStatus: 'PENDING'
      }
    });

    if (pendingDocs === 0) {
      await prisma.contractor.update({
        where: { id: document.contractorId },
        data: { verificationStatus: 'VERIFIED' }
      });
    }

    // Notify contractor about verification
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      await socketService.sendNotificationToUsers(
        [document.contractor.user.id],
        'DOCUMENT_VERIFIED',
        'Document Verified',
        `Your ${document.documentType} has been verified`,
        { documentId: document.id }
      );
    }

    return handleResponse(200, 'Document verified successfully', { document: updatedDocument }, res);
  });

  // Reject document
  static rejectDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    if (!rejectionReason) {
      return handleResponse(400, 'Rejection reason is required', {}, res);
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        contractor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    if (!document) {
      return handleResponse(404, 'Document not found', {}, res);
    }

    if (document.verificationStatus === 'REJECTED') {
      return handleResponse(400, 'Document already rejected', {}, res);
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        verificationStatus: 'REJECTED',
        rejectionReason,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
      include: {
        contractor: true
      }
    });

    // Notify contractor about rejection
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      await socketService.sendNotificationToUsers(
        [document.contractor.user.id],
        'DOCUMENT_REJECTED',
        'Document Rejected',
        `Your ${document.documentType} has been rejected. Reason: ${rejectionReason}`,
        { documentId: document.id }
      );
    }

    return handleResponse(200, 'Document rejected successfully', { document: updatedDocument }, res);
  });

  // Get document statistics
  static getDocumentStats = asyncHandler(async (req, res) => {
    const pending = await prisma.document.count({
      where: { verificationStatus: 'PENDING' }
    });

    const verified = await prisma.document.count({
      where: { verificationStatus: 'VERIFIED' }
    });

    const rejected = await prisma.document.count({
      where: { verificationStatus: 'REJECTED' }
    });

    const byType = await prisma.document.groupBy({
      by: ['documentType'],
      _count: { id: true }
    });

    return handleResponse(200, 'Document stats retrieved successfully', {
      stats: {
        pending,
        verified,
        rejected,
        total: pending + verified + rejected,
        byType: Object.fromEntries(
          byType.map(t => [t.documentType, t._count.id])
        )
      }
    }, res);
  });

  // Bulk verify documents
  static bulkVerifyDocuments = asyncHandler(async (req, res) => {
    const { documentIds } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return handleResponse(400, 'Invalid document IDs', {}, res);
    }

    const updated = await prisma.document.updateMany({
      where: {
        id: { in: documentIds },
        verificationStatus: 'PENDING'
      },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: adminId,
      }
    });

    return handleResponse(200, `${updated.count} documents verified successfully`, {
      verified: updated.count
    }, res);
  });

  // Bulk reject documents
  static bulkRejectDocuments = asyncHandler(async (req, res) => {
    const { documentIds, rejectionReason } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return handleResponse(400, 'Invalid document IDs', {}, res);
    }

    if (!rejectionReason) {
      return handleResponse(400, 'Rejection reason is required', {}, res);
    }

    const updated = await prisma.document.updateMany({
      where: {
        id: { in: documentIds },
        verificationStatus: 'PENDING'
      },
      data: {
        verificationStatus: 'REJECTED',
        rejectionReason,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      }
    });

    return handleResponse(200, `${updated.count} documents rejected successfully`, {
      rejected: updated.count
    }, res);
  });
}

export default AdminDocumentController;
