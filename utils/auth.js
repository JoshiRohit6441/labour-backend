import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } from '../config/jwtConfig.js';
import redisClient from '../config/redisConfig.js';

// Generate JWT token
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Generate refresh token
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

// Verify JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Hash password
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Store refresh token in Redis
export const storeRefreshToken = async (userId, refreshToken) => {
  const key = `refresh_token:${userId}`;
  await redisClient.setEx(key, 7 * 24 * 60 * 60, refreshToken); // 7 days
};

// Get refresh token from Redis
export const getRefreshToken = async (userId) => {
  const key = `refresh_token:${userId}`;
  return await redisClient.get(key);
};

// Delete refresh token from Redis
export const deleteRefreshToken = async (userId) => {
  const key = `refresh_token:${userId}`;
  await redisClient.del(key);
};

// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP in Redis
export const storeOTP = async (phone, otp) => {
  const key = `otp:${phone}`;
  await redisClient.setEx(key, 300, otp);
};

// Verify OTP
export const verifyOTP = async (phone, otp) => {
  const key = `otp:${phone}`;
  const storedOTP = await redisClient.get(key);
  return storedOTP === otp;
};

// Delete OTP from Redis
export const deleteOTP = async (phone) => {
  const key = `otp:${phone}`;
  await redisClient.del(key);
};

// Generate random string for password reset
export const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Store password reset token
export const storePasswordResetToken = async (email, token) => {
  const key = `password_reset:${email}`;
  await redisClient.setEx(key, 3600, token); // 1 hour
};

// Verify password reset token
export const verifyPasswordResetToken = async (email, token) => {
  const key = `password_reset:${email}`;
  const storedToken = await redisClient.get(key);
  return storedToken === token;
};

// Delete password reset token
export const deletePasswordResetToken = async (email) => {
  const key = `password_reset:${email}`;
  await redisClient.del(key);
};
