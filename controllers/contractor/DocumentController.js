import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { uploader } from '../../utils/cloudinaryUploader.js';

class DocumentController {

  // Upload contractor document
  static uploadDocument = asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(400).json({
        error: 'Not a contractor',
        message: 'Only contractors can upload documents'
      });
    }

    const contractorId = contractor.id;
    const { documentType, documentNumber } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a document file'
      });
    }

    if (!documentType) {
      return res.status(400).json({
        error: 'Document type required',
        message: 'Please specify the document type'
      });
    }

    try {
      // Upload to cloud storage
      const uploadResult = await uploader.uploadDocument(file);

      const document = await prisma.document.create({
        data: {
          userId,
          contractorId,
          documentType,
          documentNumber: documentNumber || null,
          documentUrl: uploadResult.secure_url,
          verificationStatus: 'PENDING'
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        document
      });

    } catch (error) {
      console.error('Document upload error:', error);
      return res.status(500).json({
        error: 'Upload failed',
        message: error.message || 'Failed to upload document'
      });
    }
  });

  // Get contractor documents
  static getContractorDocuments = asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(400).json({
        error: 'Not a contractor',
        message: 'Only contractors can view documents'
      });
    }

    const documents = await prisma.document.findMany({
      where: { contractorId: contractor.id },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      documents
    });
  });

  // Delete document
  static deleteDocument = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { documentId } = req.params;

    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(400).json({
        error: 'Not a contractor',
        message: 'Only contractors can delete documents'
      });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document || document.contractorId !== contractor.id) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'Document does not exist or permission denied'
      });
    }

    try {
      await uploader.deleteFile(document.documentUrl);
    } catch (error) {
      console.error('Cloud deletion error:', error);
    }

    await prisma.document.delete({
      where: { id: documentId }
    });

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  });

  // Get verification status
  static getVerificationStatus = asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(400).json({
        error: 'Not a contractor',
        message: 'Only contractors can view verification status'
      });
    }

    const documents = await prisma.document.findMany({
      where: { contractorId: contractor.id },
      select: {
        documentType: true,
        verificationStatus: true
      }
    });

    const pendingCount = documents.filter(d => d.verificationStatus === 'PENDING').length;
    const rejectedCount = documents.filter(d => d.verificationStatus === 'REJECTED').length;

    return res.status(200).json({
      success: true,
      verification: {
        overallStatus: contractor.verificationStatus,
        pendingDocuments: pendingCount,
        rejectedDocuments: rejectedCount,
        totalDocuments: documents.length,
        documents
      }
    });
  });

}

export default DocumentController;
