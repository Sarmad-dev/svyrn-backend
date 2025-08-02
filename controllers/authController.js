import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validationResult } from 'express-validator';

// Generate JWT token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

export const returnBetterAuthApi = async () => {
  return sign
}

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password, dateOfBirth } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      dateOfBirth
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if user exists and include password
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  // try {
  //   const user = await User.findById(req.user.id)
  //     .populate('followers', 'name profilePicture isVerified _id')
  //     .populate('following', 'name profilePicture isVerified _id');

  //   res.status(200).json({
  //     status: 'success',
  //     data: {
  //       user: {
  //         id: user._id,
  //         name: user.name,
  //         email: user.email,
  //         profilePicture: user.profilePicture,
  //         coverPhoto: user.coverPhoto,
  //         bio: user.bio,
  //         location: user.location,
  //         website: user.website,
  //         dateOfBirth: user.dateOfBirth,
  //         isVerified: user.isVerified,
  //         privacy: user.privacy,
  //         followersCount: user.followersCount,
  //         followingCount: user.followingCount,
  //         createdAt: user.createdAt
  //       }
  //     }
  //   });
  // } catch (error) {
  //   console.error(error)
  //   res.status(500).json({
  //     status: 'error',
  //     message: 'Error fetching user profile',
  //     error: error.message
  //   });
  // }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logout successful'
  });
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Generate reset token (implement token generation logic)
    const resetToken = 'generated-reset-token'; // Implement proper token generation
    
    // Save reset token to user (implement in User model)
    // user.resetPasswordToken = resetToken;
    // user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    // await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset email sent'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error processing forgot password request',
      error: error.message
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Find user by reset token (implement token validation)
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error resetting password',
      error: error.message
    });
  }
};