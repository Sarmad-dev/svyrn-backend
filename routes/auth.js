import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate, registerSchema, loginSchema } from '../middleware/validation.js';
import { forgotPassword, getMe, login, logout, register, resetPassword } from '../controllers/authController.js';

const router = express.Router();

// Authentication routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

export default router;