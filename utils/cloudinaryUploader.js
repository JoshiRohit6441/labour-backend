import cloudinary from '../config/cloudinaryConfig.js';
import { v4 as uuidv4 } from 'uuid';

export class CloudinaryUploader {
  async uploadDocument(file) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          public_id: uuidv4(),
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(file.buffer);
    });
  }

  async deleteFile(url) {
    if (!url) return Promise.resolve();
    const publicId = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.'));
    if (!publicId) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          console.error('Cloudinary deletion error:', error);
          // Don't reject, just log and resolve
          resolve(result);
        } else {
          resolve(result);
        }
      });
    });
  }
}

export const uploader = new CloudinaryUploader();


export const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        public_id: uuidv4(),
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(file.buffer);
  });
};

export const uploadMultipleToCloudinary = async (files) => {
  const uploadPromises = files.map(uploadToCloudinary);
  return Promise.all(uploadPromises);
};
