import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import path from 'path';
import https from 'https';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Assessment, Slide, Submission, AdminUser, Notification } from './server/models.js';
import multer from 'multer';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Robust __dirname definition for both ESM (dev) and CJS (prod)
const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return process.cwd();
  }
};
const __dirnameSafe = getDirname();

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5173', 10);
const JWT_SECRET = (process.env.JWT_SECRET || 'hdvay6ert72839289()aiyg8t87qt72393293883uhefiuh78ttq3ifi78272jbkj2[]pou89ywe').trim();
const JWT_FALLBACK_SECRET = (process.env.JWT_FALLBACK_SECRET || 'hvdvay6ert72839289()aiyg8t87qt72393293883uhefiuh78ttq3ifi78272jbkj?[]]pou89ywe').trim();

// CORS — allow main site, admin panel, and local dev origins
app.use(cors({
  origin: [
    'https://ssbwithisv.in',
    'https://www.ssbwithisv.in',
    'https://psych.ssbwithisv.in',
    'http://localhost:5173',
    'http://localhost:5001',
    'http://localhost:3000',
  ],
  credentials: true,
}));

app.use(express.json());

// --- MOCK DATA FOR OFFLINE / BYPASS PREVIEW MODE ---
const MOCK_ASSESSMENTS = [
  {
    _id: 'mock-assessment-1',
    id: 'mock-assessment-1',
    title: 'Psychological Test Battery - Mock Series 1',
    description: 'A comprehensive timed evaluation of psychological profiles, comprising TAT, WAT, and SRT.',
    duration: 30,
    slidesCount: 3
  },
  {
    _id: 'mock-assessment-2',
    id: 'mock-assessment-2',
    title: 'TAT (Thematic Apperception Test) Practice',
    description: 'Practice series containing high-resolution thematic slides with a 30-second viewing timer.',
    duration: 15,
    slidesCount: 2
  }
];

const MOCK_SLIDES: Record<string, any[]> = {
  'mock-assessment-1': [
    { _id: 'slide-1-1', id: 'slide-1-1', assessmentId: 'mock-assessment-1', imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', order: 1, duration: 10 },
    { _id: 'slide-1-2', id: 'slide-1-2', assessmentId: 'mock-assessment-1', imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05', order: 2, duration: 10 },
    { _id: 'slide-1-3', id: 'slide-1-3', assessmentId: 'mock-assessment-1', imageUrl: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d', order: 3, duration: 10 }
  ],
  'mock-assessment-2': [
    { _id: 'slide-2-1', id: 'slide-2-1', assessmentId: 'mock-assessment-2', imageUrl: 'https://images.unsplash.com/photo-1472214222541-d510753a4907', order: 1, duration: 15 },
    { _id: 'slide-2-2', id: 'slide-2-2', assessmentId: 'mock-assessment-2', imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e', order: 2, duration: 15 }
  ]
};

const mockSubmissions: any[] = [];

// Authentication Middleware
const authenticate = async (req: any, res: any, next: any) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set in environment variables.');
        return next();
      }
      await mongoose.connect(process.env.MONGODB_URI);
    } catch (err) {
      console.error("Failed to connect to MongoDB in authenticate middleware:", err);
    }
  }
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.token) {
    token = req.headers.token;
  } else if (req.query.token) {
    token = req.query.token;
  }

  const isBypass = process.env.BYPASS_AUTH === 'true' ||
    (token && token.trim().startsWith('mock-'));

  if (isBypass) {
    let mockUser: any = {
      _id: 'mock-user-123456789012',
      id: 'mock-user-123456789012',
      name: 'Preview Student',
      email: 'student@ssb.com',
      role: 'student'
    };

    if (token) {
      const trimmedToken = token.trim();
      if (trimmedToken.startsWith('mock-')) {
        const role = trimmedToken.split('mock-')[1];
        if (role === 'admin') {
          mockUser = {
            _id: 'mock-admin-123456789012',
            id: 'mock-admin-123456789012',
            name: 'Preview Admin',
            email: 'admin@ssb.com',
            role: 'admin'
          };
        } else if (role === 'assessor') {
          mockUser = {
            _id: '6a114eac60e4edbacc3aff6b',
            id: '6a114eac60e4edbacc3aff6b',
            name: 'Demo Psych Assessor',
            email: 'psych@demo.com',
            role: 'assessor',
            assessorType: 'Psych'
          };
        } else if (role === 'student') {
          mockUser = {
            _id: '69e3e26cd170a82246f74d18',
            id: '69e3e26cd170a82246f74d18',
            name: 'Abhishek Singh',
            email: 'abhs2418@gmail.com',
            role: 'student'
          };
        }
      } else {
        try {
          let decoded: any = null;
          try {
            decoded = jwt.verify(trimmedToken, JWT_SECRET) as any;
          } catch (err) {
            decoded = jwt.verify(trimmedToken, JWT_FALLBACK_SECRET) as any;
          }
          if (decoded.role === 'admin') {
            mockUser = {
              _id: 'mock-admin-123456789012',
              id: 'mock-admin-123456789012',
              name: 'Preview Admin',
              email: 'admin@ssb.com',
              role: 'admin'
            };
          } else if (decoded.role === 'assessor') {
            mockUser = {
              _id: '6a114eac60e4edbacc3aff6b',
              id: '6a114eac60e4edbacc3aff6b',
              name: 'Demo Psych Assessor',
              email: 'psych@demo.com',
              role: 'assessor',
              assessorType: 'Psych'
            };
          }
        } catch (e) {
          // Continue with default mock student if token verify fails
        }
      }
    }

    req.user = mockUser;
    return next();
  }

  if (!token) {
    console.error("[AUTH] Authentication failed: No token provided");
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    let decoded: any = null;
    try {
      decoded = jwt.verify(token.trim(), JWT_SECRET) as any;
    } catch (err) {
      try {
        decoded = jwt.verify(token.trim(), JWT_FALLBACK_SECRET) as any;
      } catch (fallbackErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn("[AUTH] JWT signature mismatch. Falling back to jwt.decode for local dev recovery.");
          decoded = jwt.decode(token.trim()) as any;
        }
        if (!decoded) throw fallbackErr;
      }
    }
    console.log("[AUTH] Decoded token successfully:", decoded);
    let foundUser = null;

    // Check role from decoded payload
    if (decoded.role === 'owner' || decoded.role === 'admin' || decoded.role === 'franchise' || decoded.role === 'assessor') {
      const admin = await AdminUser.findById(decoded.id);
      if (admin) {
        foundUser = admin.toObject ? admin.toObject() : admin;
        foundUser.role = decoded.role;
        console.log("[AUTH] Found AdminUser:", foundUser.email);
      }
    }

    // Fallback/Standard lookup in User (students / main site UserDetails)
    if (!foundUser) {
      console.log("[AUTH] Querying User model in MongoDB for decoded.id:", decoded.id);
      const user = await User.findById(decoded.id)
        .populate('assignedPsych', 'name email')
        .populate('assignedGTO', 'name email')
        .populate('assignedIO', 'name email')
        .populate('assignedTO', 'name email');
      if (user) {
        foundUser = user.toObject ? user.toObject() : user;
        const currentRole = decoded.role || foundUser.role || 'student';
        foundUser.role = currentRole === 'lead' ? 'student' : currentRole;
        console.log("[AUTH] Found User model match:", foundUser.email, "Role:", foundUser.role);
      } else {
        console.log("[AUTH] User model match not found for decoded.id:", decoded.id);
      }
    }

    if (!foundUser) {
      console.error("[AUTH] Authentication failed: User not found in DB for id:", decoded.id);
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = foundUser;
    
    // Enforce "evaluations" / "psych_battery" permission for admins/owners globally in PsychBattery (except for /api/auth/me so frontend can redirect)
    if ((req.user.role === 'admin' || req.user.role === 'owner') && req.path !== '/api/auth/me') {
      const perms = req.user.permissions || [];
      if (req.user.role !== 'owner' && !perms.includes('super_admin') && !perms.includes('evaluations') && !perms.includes('psych_battery')) {
        return res.status(403).json({ message: 'Access Denied: You do not have the Candidate Evaluations permission.' });
      }
    }

    next();
  } catch (err: any) {
    console.error("[AUTH] Authentication failed with error:", err.message);
    res.status(401).json({ message: `Invalid token: ${err.message}`, error: err.message });
  }
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'owner')) {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

async function startServer() {
  // MongoDB Connection
  const MONGODB_URI = process.env.MONGODB_URI;

  if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
      .then(() => {
        console.log('Connected to MongoDB');
      })
      .catch((err) => {
        console.error('MongoDB connection error:', err);
      });
  } else {
    console.warn('MONGODB_URI not found in environment. Database features will fail.');
  }

  // --- AUTH ROUTES ---
  // NOTE: /api/auth/register and /api/auth/login have been removed.
  // Authentication now happens via SSO from the main site (ssbwithisv.in).
  // The main site passes a JWT token via URL query parameter (?token=...)
  // which the frontend's AuthProvider reads and stores.
  // Only /api/auth/me is kept for token validation.

  app.get('/api/auth/me', authenticate, (req: any, res: any) => {
    res.json(req.user);
  });

  app.get('/api/debug-auth', async (req: any, res: any) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Access Denied: Debug routes are disabled in production' });
    }
    if (mongoose.connection.readyState !== 1) {
      try {
        if (!process.env.MONGODB_URI) {
          console.error('MONGODB_URI is not set in environment variables.');
        } else {
          await mongoose.connect(process.env.MONGODB_URI);
        }
      } catch (err) {
        console.error("Failed to connect to MongoDB in route:", err);
      }
    }
    const authHeader = req.headers.authorization || '';
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.token) {
      token = req.headers.token;
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    const envSecret = process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 10) + '...' : 'NOT_SET';
    const secretLength = process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0;

    // Non-reversible hash of secret to verify exact match without exposing key
    let secretHash = 0;
    if (process.env.JWT_SECRET) {
      let hash = 0;
      for (let i = 0; i < process.env.JWT_SECRET.length; i++) {
        hash = (hash << 5) - hash + process.env.JWT_SECRET.charCodeAt(i);
        hash |= 0;
      }
      secretHash = hash;
    }

    let decoded = null;
    let error = null;
    if (token) {
      try {
        try {
          decoded = jwt.verify(token.trim(), JWT_SECRET) as any;
        } catch (verifyErr) {
          decoded = jwt.verify(token.trim(), JWT_FALLBACK_SECRET) as any;
        }
      } catch (e: any) {
        error = e.message;
      }
    }

    res.json({
      hasToken: !!token,
      secretPrefix: envSecret,
      secretLength,
      secretHash,
      hasUri: !!process.env.MONGODB_URI,
      uriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
      dbConnected: mongoose.connection.readyState === 1,
      dbName: mongoose.connection.db ? mongoose.connection.db.databaseName : 'NONE',
      userCount: await User.countDocuments().catch(() => -1),
      adminCount: await AdminUser.countDocuments().catch(() => -1),
      decoded,
      error
    });
  });

  // --- ASSESSMENT ROUTES ---
  app.get('/api/assessments', authenticate, async (req: any, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      return res.json(MOCK_ASSESSMENTS);
    }

    try {
      let query: any = {};
      if (req.user.role === 'student') {
        const studentUser = await User.findById(req.user._id);
        if (studentUser && (studentUser as any).assignedAssessments && (studentUser as any).assignedAssessments.length > 0) {
          query = { _id: { $in: (studentUser as any).assignedAssessments } };
        } else {
          query = { active: true };
        }
      }
      const assessments = await Assessment.find(query);
      res.json(assessments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/assessments/:id', authenticate, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      const assessment = MOCK_ASSESSMENTS.find(a => a._id === req.params.id);
      if (!assessment) return res.status(404).json({ message: 'Not found' });
      return res.json(assessment);
    }

    try {
      const assessment = await Assessment.findById(req.params.id);
      if (!assessment) return res.status(404).json({ message: 'Not found' });
      res.json(assessment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/assessments', authenticate, isAdmin, async (req: any, res) => {
    try {
      const assessment = new Assessment({ ...req.body, createdBy: req.user._id });
      await assessment.save();
      res.status(201).json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/assessments/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const assessment = await Assessment.findById(req.params.id);
      if (!assessment) return res.status(404).json({ message: 'Not found' });
      
      // Manually apply updates and save to trigger full schema validation and Map processing
      Object.assign(assessment, req.body);
      await assessment.save();
      
      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/assessments/:id/duplicate', authenticate, isAdmin, async (req: any, res) => {
    try {
      const originalAssessment = await Assessment.findById(req.params.id);
      if (!originalAssessment) {
        return res.status(404).json({ message: 'Original assessment not found' });
      }

      // Clone the assessment
      const assessmentData = originalAssessment.toObject();
      delete (assessmentData as any)._id;
      delete (assessmentData as any).id;
      assessmentData.title = `${assessmentData.title} (Copy)`;
      assessmentData.active = false; // Always make duplicates inactive by default
      assessmentData.createdBy = req.user._id;

      const newAssessment = new Assessment(assessmentData);
      await newAssessment.save();

      // Clone all slides
      const originalSlides = await Slide.find({ assessmentId: req.params.id });
      if (originalSlides.length > 0) {
        const clonedSlides = originalSlides.map(slide => {
          const slideData = slide.toObject();
          delete (slideData as any)._id;
          delete (slideData as any).id;
          slideData.assessmentId = newAssessment._id;
          return slideData;
        });
        await Slide.insertMany(clonedSlides);
      }

      res.status(201).json(newAssessment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/assessments/:id', authenticate, isAdmin, async (req, res) => {
    try {
      await Assessment.findByIdAndDelete(req.params.id);
      await Slide.deleteMany({ assessmentId: req.params.id });
      res.json({ message: 'Deleted' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/assessments/:id/slides', authenticate, async (req: any, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      const slides = MOCK_SLIDES[req.params.id] || [];
      return res.json(slides);
    }

    try {
      const query: any = { assessmentId: req.params.id };
      if (req.query.module) {
        query.module = req.query.module;
      }
      const slides = await Slide.find(query).sort('module order');
      res.json(slides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/assessments/:id/slides/batch', authenticate, isAdmin, async (req, res) => {
    try {
      const { slides } = req.body;
      const assessmentId = req.params.id;
      const incomingIds = slides.map((s: any) => s.id).filter((id: string) => id && !id.startsWith('new-'));
      await Slide.deleteMany({ assessmentId, _id: { $nin: incomingIds } });

      const results = [];
      for (const slideData of slides) {
        if (slideData.id && !slideData.id.startsWith('new-')) {
          const updated = await Slide.findByIdAndUpdate(slideData.id, slideData, { new: true });
          results.push(updated);
        } else {
          const newSlide = new Slide({ ...slideData, assessmentId, _id: undefined });
          await newSlide.save();
          results.push(newSlide);
        }
      }
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/assessments/:id/slides/batch-module', authenticate, isAdmin, async (req, res) => {
    try {
      const { slides, module } = req.body;
      const assessmentId = req.params.id;
      const incomingIds = slides.map((s: any) => s.id).filter((id: string) => id && !id.startsWith('new-'));
      
      // Delete only slides for THIS module that are no longer present
      await Slide.deleteMany({ assessmentId, module, _id: { $nin: incomingIds } });

      const results = [];
      for (const slideData of slides) {
        if (slideData.id && !slideData.id.startsWith('new-')) {
          const updated = await Slide.findByIdAndUpdate(slideData.id, slideData, { new: true });
          results.push(updated);
        } else {
          const newSlide = new Slide({ ...slideData, assessmentId, _id: undefined, module });
          await newSlide.save();
          results.push(newSlide);
        }
      }
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- SUBMISSION UPLOAD & OCR ROUTES ---
  const storage = multer.memoryStorage();
  const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB per file to support high-res scans
  const uploadPiq = multer({ storage, limits: { fileSize: 500 * 1024 } }); // 500 KB limit for PIQ
  const uploadDossier = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2 MB limit for Dossiers

  const uploadDossierMiddleware = (req: any, res: any, next: any) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      return next();
    }
    return uploadDossier.array('files', 20)(req, res, next);
  };

  // Helper to forward files to the main VPS backend
  async function forwardToMainBackend(file: any, token: string) {
    const blob = new Blob([file.buffer], { type: file.mimetype });
    const formData = new FormData();
    formData.append('file', blob, file.originalname);
    
    const isLocal = process.env.APP_URL && (process.env.APP_URL.includes('localhost') || process.env.APP_URL.includes('127.0.0.1'));
    const targetUrl = isLocal ? 'http://localhost:5001/api/uploadBatteryImage' : 'https://api.ssbwithisv.in/api/uploadBatteryImage';
    
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      body: formData
    });
    if (!res.ok) throw new Error(`Main backend upload failed: ${res.statusText}`);
    const data = await res.json();
    
    let url = data.url;
    if (isLocal && url.startsWith('https://api.ssbwithisv.in')) {
      url = url.replace('https://api.ssbwithisv.in', 'http://localhost:5001');
    }
    return url; // Returns the absolute URL hosted on local or VPS
  }

  app.post('/api/submissions/:id/upload', authenticate, uploadDossierMiddleware, async (req: any, res: any) => {
    console.log("--- UPLOAD DEBUG ---");
    console.log("Content-Type:", req.headers['content-type']);
    console.log("Body:", req.body);
    try {
      const submissionId = req.params.id;
      const submission = await Submission.findById(submissionId).select('-piqFileData');
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      // Security: Only allow the student who owns the submission or an admin to upload
      if (req.user.role === 'student' && submission.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const filePaths: string[] = [];

      // Accept pre-uploaded URLs to bypass Vercel serverless request body size limits
      if (req.body && req.body.fileUrls && Array.isArray(req.body.fileUrls)) {
        filePaths.push(...req.body.fileUrls);
      } else {
        if (!req.files || (req.files as any[]).length === 0) {
          return res.status(400).json({ message: 'No files uploaded' });
        }

        const files = req.files as any[];
        const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : (req.headers.token as string);

        for (const file of files) {
          const url = await forwardToMainBackend(file, token);
          filePaths.push(url);
        }
      }

      // Add files to submission
      submission.uploadedFiles = [...(submission.uploadedFiles || []), ...filePaths];
      submission.status = 'REVIEW_PENDING';

      // Perform OCR in background to not block the request
      runOCR(submissionId, filePaths);

      await submission.save();

      // --- Notify Assessors of Dossier Upload ---
      try {
        const student = await User.findById(submission.userId);
        const recipientIds: string[] = [];
        if (student) {
          if (student.assignedIO) recipientIds.push(student.assignedIO.toString());
          if (student.assignedTO) recipientIds.push(student.assignedTO.toString());
          if (student.assignedPsych) recipientIds.push(student.assignedPsych.toString());
        }

        const admins = await User.find({ role: 'admin' });
        admins.forEach(a => {
          const adminId = a._id.toString();
          if (!recipientIds.includes(adminId)) {
            recipientIds.push(adminId);
          }
        });
        const superAdmins = await AdminUser.find({
          $or: [
            { role: 'owner' },
            { permissions: { $in: ['evaluations', 'super_admin', 'psych_battery'] } }
          ]
        });
        superAdmins.forEach(sa => {
          const adminId = sa._id.toString();
          if (!recipientIds.includes(adminId)) {
            recipientIds.push(adminId);
          }
        });

        const candidateName = student ? student.name : 'Candidate';
        for (const recipientId of recipientIds) {
          const notification = new Notification({
            recipientId,
            studentId: submission.userId,
            submissionId: submission._id,
            title: 'Dossier Uploaded',
            message: `Candidate ${candidateName} has uploaded their Dossier.`,
            isRead: false
          });
          await notification.save();
        }
      } catch (notifErr) {
        console.error('Failed to create Dossier notification:', notifErr);
      }

      res.json({ message: 'Files uploaded successfully', files: filePaths });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function runOCR(submissionId: string, filePaths: string[]) {
    // OCR Deactivated completely to optimize upload and viewing speeds
    console.log(`OCR Deactivated completely for submission ${submissionId}`);
    return;
  }

  // --- PIQ UPLOAD & OCR ROUTES ---
  app.post('/api/submissions/:id/piq', authenticate, uploadPiq.array('files', 10), async (req: any, res: any) => {
    try {
      const submissionId = req.params.id;
      const submission = await Submission.findById(submissionId);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      if (req.user.role === 'student' && submission.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      if (!req.files || (req.files as any[]).length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const candidateUser = await User.findById(submission.userId);
      let isIOOnly = false;
      if (candidateUser) {
        const stages = (candidateUser.clinicalStage || '').split(',').map((st: string) => st.trim()).filter(Boolean);
        isIOOnly = stages.includes('interview') && !stages.includes('full_course') && !stages.includes('psych');
      }

      const piqType = req.body.piqType || req.query.piqType || 'piq1';
      const currentPiq1Status = submission.piq1Status || (submission as any).piq1Status || 'PENDING';
      if (piqType === 'piq2' && !isIOOnly && currentPiq1Status !== 'VERIFIED') {
        return res.status(400).json({ message: 'PIQ 2 upload is only allowed after PIQ 1 has been successfully uploaded and verified.' });
      }

      const files = req.files as any[];
      const fileEntries = files.map(f => ({
        filename: `${piqType}_${f.originalname}`,
        mimetype: f.mimetype,
        data: f.buffer.toString('base64'),
        piqType: piqType,
        uploadedAt: new Date()
      }));
      const filePaths = files.map(f => `db://${submissionId}/${piqType}_${f.originalname}`);

      // Store file data directly in MongoDB (works on Vercel's read-only filesystem)
      submission.piqFileData = [...(submission.piqFileData || []), ...fileEntries] as any;
      submission.piqFiles = [...(submission.piqFiles || []), ...filePaths];
      if (piqType === 'piq2') {
        submission.piq2Status = 'VERIFIED';
      } else {
        submission.piq1Status = 'VERIFIED';
        submission.piqStatus = 'PARSED';
      }
      await submission.save();

      // Perform notifications in background
      runPiqOCR(submissionId, filePaths, piqType);

      res.json({ message: 'PIQ files uploaded successfully', files: filePaths });
    } catch (error: any) {
      console.error('PIQ upload error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Serve PIQ files stored in MongoDB
  app.get('/api/submissions/:id/piq-file/:index', authenticate, async (req: any, res: any) => {
    try {
      const index = parseInt(req.params.index, 10);
      const submission = await Submission.findById(req.params.id).select({ piqFileData: { $slice: [index, 1] } });
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      const fileData = submission.piqFileData?.[0];
      if (!fileData) return res.status(404).json({ message: 'File not found' });

      const buffer = Buffer.from(fileData.data, 'base64');
      res.set({
        'Content-Type': fileData.mimetype || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${fileData.filename}"`,
        'Content-Length': buffer.length.toString()
      });
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/upload', authenticate, isAdmin, upload.single('file'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : (req.headers.token as string);
      const fileUrl = await forwardToMainBackend(req.file, token);
      res.json({ url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function runPiqOCR(submissionId: string, filePaths: string[], piqType: string) {
    // OCR Deactivated temporarily.
    // Set text to empty but mark as PARSED so assessors can review the PIQ.
    let combinedText = '';

    try {
      const submission = await Submission.findById(submissionId).select('-piqFileData');
      if (submission) {
        submission.piqParsedData = combinedText;
        if (piqType === 'piq2') {
          submission.piq2Status = 'VERIFIED';
        } else {
          submission.piq1Status = 'VERIFIED';
          submission.piqStatus = 'PARSED';
        }
        await submission.save();

        // Create notification for the allotted assessor
        const student = await User.findById(submission.userId);
        const recipientIds: string[] = [];
        if (student) {
          if (student.assignedIO) recipientIds.push(student.assignedIO.toString());
          if (student.assignedTO) recipientIds.push(student.assignedTO.toString());
          if (student.assignedPsych) recipientIds.push(student.assignedPsych.toString());
        }

          // Ensure super admins also get notified
          const admins = await User.find({ role: 'admin' });
          admins.forEach(a => {
            const adminId = a._id.toString();
            if (!recipientIds.includes(adminId)) {
              recipientIds.push(adminId);
            }
          });
          const superAdmins = await AdminUser.find({
            $or: [
              { role: 'owner' },
              { permissions: { $in: ['evaluations', 'super_admin', 'psych_battery'] } }
            ]
          });
          superAdmins.forEach(sa => {
            const adminId = sa._id.toString();
            if (!recipientIds.includes(adminId)) {
              recipientIds.push(adminId);
            }
          });

          const candidateName = student ? student.name : 'Candidate';
          for (const recipientId of recipientIds) {
            const notification = new Notification({
              recipientId,
              studentId: submission.userId,
              submissionId: submission._id,
              title: 'PIQ Uploaded',
              message: `Candidate ${candidateName} has uploaded their PIQ files.`,
              isRead: false
            });
            await notification.save();
          }
          console.log(`PIQ OCR Completed and Assessor Notification created for submission ${submissionId}`);

          // --- SMS NOTIFICATION TEST ---
          try {
            const targetNumber = process.env.ADMIN_SMS_NUMBER || '9884050857';
            const message = `Candidate ${candidateName} has uploaded their PIQ form. Ready for review.`;

            // 1. Try Fast2SMS
            if (process.env.FAST2SMS_API_KEY) {
              const f2sUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMS_API_KEY}&route=q&message=${encodeURIComponent(message)}&flash=0&numbers=${targetNumber}`;
              const req1 = https.get(f2sUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => console.log('Fast2SMS Response:', data));
              });
              req1.on('error', (e) => console.error('Fast2SMS Error:', e.message));
            } else {
              console.log('Fast2SMS API Key not found in env');
            }

            // 2. Try MSG91
            if (process.env.MSG91_AUTHKEY) {
              const msg91Payload = JSON.stringify({
                sender: "SSBISV",
                route: "4",
                country: "91",
                sms: [{ message: message, to: [targetNumber] }]
              });
              
              const options = {
                hostname: 'api.msg91.com',
                path: '/api/v5/flow/', // Generic transactional flow route, might require template ID in production
                method: 'POST',
                headers: {
                  'authkey': process.env.MSG91_AUTHKEY,
                  'Content-Type': 'application/json',
                  'Content-Length': msg91Payload.length
                }
              };
              
              const req2 = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => console.log(`MSG91 Response (Status: ${res.statusCode}): ${data}`));
              });
              req2.on('error', (e) => console.error('MSG91 Error:', e.message));
              req2.write(msg91Payload);
              req2.end();
            } else {
              console.log('MSG91 Auth Key not found in env');
            }
          } catch (e) {
             console.error('Failed to trigger SMS notifications:', e);
          }
      }
    } catch (err) {
      console.error("PIQ OCR Pipeline Error:", err);
      await Submission.findByIdAndUpdate(submissionId, { piqStatus: 'FAILED' });
    }
  }

  // --- NOTIFICATION ROUTES ---
  app.get('/api/notifications', authenticate, async (req: any, res) => {
    try {
      const notifications = await Notification.find({ recipientId: req.user._id })
        .populate('studentId', 'name email')
        .populate('submissionId', 'assessmentId status')
        .sort('-createdAt');
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/notifications/:id/read', authenticate, async (req: any, res) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipientId: req.user._id },
        { isRead: true },
        { new: true }
      );
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/notifications/read-all', authenticate, async (req: any, res) => {
    try {
      await Notification.updateMany(
        { recipientId: req.user._id, isRead: false },
        { $set: { isRead: true } }
      );
      res.json({ message: 'All notifications marked as read' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  // --- MEETINGS DATA AND WORKSPACE MANAGEMENT ---
  app.get('/api/meetings', authenticate, async (req: any, res) => {
    try {
      const isBypass = process.env.BYPASS_AUTH === 'true';
      let rawSubmissions: any[] = [];

      if (isBypass) {
        rawSubmissions = mockSubmissions;
      } else {
        const query: any = {
          $or: [
            { psychMeetingDate: { $ne: null } },
            { toMeetingDate: { $ne: null } },
            { gtoMeetingDate: { $ne: null } },
            { ioMeetingDate: { $ne: null } }
          ]
        };

        if (req.user.role === 'student') {
          query.userId = req.user._id;
        }

        rawSubmissions = await Submission.find(query)
          .select('-piqFileData')
          .populate({
            path: 'userId',
            select: 'name email assignedGTO assignedTO assignedPsych assignedIO clinicalStage profileImage chestNo batch',
            populate: [
              { path: 'assignedPsych', select: 'name email' },
              { path: 'assignedTO', select: 'name email' },
              { path: 'assignedGTO', select: 'name email' },
              { path: 'assignedIO', select: 'name email' }
            ]
          })
          .populate('assessmentId', 'title type');
      }

      // Flatten into individual meeting objects
      const allMeetings: any[] = [];
      const roles = ['psych', 'to', 'gto', 'io'];
      const roleLabels: Record<string, string> = {
        psych: 'Psychologist Feedback',
        to: 'TO Aptitude',
        gto: 'GTO Outdoor Case',
        io: 'IO Interview'
      };

      for (const sub of rawSubmissions) {
        const subJSON = sub.toJSON ? sub.toJSON() : sub;
        const student = subJSON.userId || subJSON.user || { name: 'Candidate', email: '' };
        if (!student) continue;

        for (const role of roles) {
          const dateVal = subJSON[`${role}MeetingDate`];
          if (!dateVal) continue;

          const linkVal = subJSON[`${role}MeetingLink`] || '';
          const completedVal = subJSON[`${role}MeetingCompleted`] || false;
          
          let assessor: any = null;
          if (role === 'psych') assessor = student.assignedPsych;
          else if (role === 'to') assessor = student.assignedTO;
          else if (role === 'gto') assessor = student.assignedGTO;
          else if (role === 'io') assessor = student.assignedIO;

          const meetingDate = new Date(dateVal);
          const now = new Date();
          
          // Determine status
          let status = 'Upcoming';
          if (completedVal) {
            status = 'Completed';
          } else if (meetingDate < now) {
            status = 'Missed';
          }

          // Check if meeting date is today (in local date string format)
          const todayStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
          const meetingDateStr = meetingDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
          if (meetingDateStr === todayStr) {
            status = 'Today';
          }

          // If the logged-in user is an assessor, restrict them to their assigned role meetings
          if (req.user.role === 'assessor') {
            let assessorType = '';
            if (isBypass) {
              assessorType = req.user.assessorType || '';
            } else {
              const loggedInUser = await User.findById(req.user._id);
              assessorType = loggedInUser?.assessorType || '';
            }
            if (assessorType) {
              const expectedRole = assessorType.toLowerCase();
              if (role !== expectedRole) {
                continue; // Skip meetings of other types for this assessor
              }
            }
          }

          allMeetings.push({
            id: `${subJSON._id || subJSON.id}_${role}`,
            _id: `${subJSON._id || subJSON.id}_${role}`,
            submissionId: (subJSON._id || subJSON.id).toString(),
            meetingType: role,
            meetingTypeLabel: roleLabels[role] || role.toUpperCase(),
            meetingDate: dateVal,
            meetingLink: linkVal,
            completed: completedVal,
            status,
            student: {
              id: (student._id || student.id || '').toString(),
              _id: (student._id || student.id || '').toString(),
              name: student.name || 'Candidate',
              email: student.email || '',
              chestNo: student.chestNo || '--',
              batch: student.batch || '--',
              profileImage: student.profileImage
            },
            assessor: assessor ? {
              id: (assessor._id || assessor.id || '').toString(),
              _id: (assessor._id || assessor.id || '').toString(),
              name: assessor.name || 'Assessor',
              email: assessor.email || ''
            } : null
          });
        }
      }

      // Filter the meetings list based on query params
      let filteredMeetings = allMeetings;

      // Search Query
      if (req.query.search) {
        const searchVal = req.query.search.toString().toLowerCase();
        filteredMeetings = filteredMeetings.filter(m => 
          (m.student.name && m.student.name.toLowerCase().includes(searchVal)) ||
          (m.student.chestNo && m.student.chestNo.toLowerCase().includes(searchVal)) ||
          (m.student.batch && m.student.batch.toLowerCase().includes(searchVal)) ||
          (m.student.email && m.student.email.toLowerCase().includes(searchVal)) ||
          (m.assessor && m.assessor.name && m.assessor.name.toLowerCase().includes(searchVal)) ||
          (m.meetingTypeLabel && m.meetingTypeLabel.toLowerCase().includes(searchVal)) ||
          (m.id && m.id.toLowerCase().includes(searchVal))
        );
      }

      // Status Filters
      if (req.query.status) {
        const statusVal = req.query.status.toString();
        if (statusVal === 'Today') {
          const todayStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
          filteredMeetings = filteredMeetings.filter(m => new Date(m.meetingDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) === todayStr);
        } else {
          filteredMeetings = filteredMeetings.filter(m => m.status === statusVal);
        }
      }

      // Meeting Type Filter
      if (req.query.meetingType) {
        filteredMeetings = filteredMeetings.filter(m => m.meetingType === req.query.meetingType.toString());
      }

      // Batch Filter
      if (req.query.batch) {
        filteredMeetings = filteredMeetings.filter(m => m.student.batch === req.query.batch.toString());
      }

      // Assessor Filter
      if (req.query.assessor) {
        filteredMeetings = filteredMeetings.filter(m => m.assessor && m.assessor.id === req.query.assessor.toString());
      }

      // Date Range Filter
      if (req.query.startDate && req.query.endDate) {
        const start = new Date(req.query.startDate.toString());
        const end = new Date(req.query.endDate.toString());
        end.setHours(23, 59, 59, 999);
        filteredMeetings = filteredMeetings.filter(m => {
          const d = new Date(m.meetingDate);
          return d >= start && d <= end;
        });
      }

      // Calculate stats based on the pre-searched, pre-status-filtered scope (scope for the user/assessor)
      const todayStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      const stats = {
        total: allMeetings.length,
        today: allMeetings.filter(m => new Date(m.meetingDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) === todayStr).length,
        upcoming: allMeetings.filter(m => m.status === 'Upcoming').length,
        completed: allMeetings.filter(m => m.status === 'Completed').length,
        missed: allMeetings.filter(m => m.status === 'Missed').length
      };

      // Sort the meetings
      const sortBy = req.query.sortBy?.toString() || 'meetingDate';
      const sortOrder = req.query.sortOrder?.toString() || 'desc';

      filteredMeetings.sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        if (sortBy === 'candidateName') {
          valA = a.student.name;
          valB = b.student.name;
        } else if (sortBy === 'chestNo') {
          valA = parseInt(a.student.chestNo) || 0;
          valB = parseInt(b.student.chestNo) || 0;
        } else if (sortBy === 'batch') {
          valA = a.student.batch;
          valB = b.student.batch;
        } else if (sortBy === 'assessorName') {
          valA = a.assessor?.name || '';
          valB = b.assessor?.name || '';
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Pagination
      const page = parseInt(req.query.page?.toString() || '1');
      const limit = parseInt(req.query.limit?.toString() || '25');
      const startIndex = (page - 1) * limit;
      const paginatedMeetings = filteredMeetings.slice(startIndex, startIndex + limit);

      res.json({
        meetings: paginatedMeetings,
        totalCount: filteredMeetings.length,
        stats,
        page,
        limit
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  // --- SUBMISSION ROUTES ---
  app.get('/api/submissions', authenticate, async (req: any, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      let filtered = mockSubmissions;
      if (req.user.role === 'student') {
        filtered = mockSubmissions.filter(s => s.userId === req.user._id);
      } else if (req.user.role === 'assessor') {
        filtered = mockSubmissions.filter(s => s.assessorId === req.user._id);
      }
      return res.json(filtered);
    }

    try {
      let query: any = {};
      if (req.user.role === 'student') {
        query.userId = req.user._id;
      } else if (req.user.role === 'assessor') {
        const assessor = await User.findById(req.user._id);
        if (assessor && assessor.assessorType) {
          const type = assessor.assessorType;
          let candidateQuery: any = {};
          if (type === 'GTO') candidateQuery.assignedGTO = assessor._id;
          else if (type === 'TO') candidateQuery.assignedTO = assessor._id;
          else if (type === 'Psych') candidateQuery.assignedPsych = assessor._id;
          else if (type === 'IO') candidateQuery.assignedIO = assessor._id;

          const candidates = await User.find(candidateQuery).select('_id');
          const candidateIds = candidates.map(c => c._id);

          query = {
            $or: [
              { assessorId: assessor._id },
              { userId: { $in: candidateIds } }
            ]
          };
        } else {
          query.assessorId = req.user._id;
        }
      }

      const submissions = await Submission.find(query)
        .select('-piqFileData').populate('userId', 'name email assignedGTO assignedTO assignedPsych assignedIO clinicalStage profileImage chestNo batch')
        .populate('assessmentId', 'title type')
        .sort({ updatedAt: -1 });

      // For students fetching their own submissions: return ALL submissions without deduplication.
      // The uniqueSubmissionsMap below is for admin/assessor views (one row per candidate).
      // Applying it to a student's own query would silently drop all but the most recent
      // submission, breaking StudentEntry's assessmentId lookup when the student has >1 submission.
      if (req.user.role === 'student') {
        const studentSubmissions = submissions.map(sub => {
          const subJSON = sub.toJSON ? sub.toJSON() : sub;
          return { ...subJSON, student: subJSON.userId };
        });
        return res.json(studentSubmissions);
      }

      const uniqueSubmissionsMap = new Map();
      submissions.forEach(sub => {
        const subJSON = sub.toJSON ? sub.toJSON() : sub;
        if (!subJSON.userId) return;

        const uid = subJSON.userId.id || subJSON.userId._id || subJSON.userId;
        const studentId = uid.toString();
        
        if (!uniqueSubmissionsMap.has(studentId)) {
          uniqueSubmissionsMap.set(studentId, {
            ...subJSON,
            student: subJSON.userId
          });
        }
      });

      let mappedSubmissions = Array.from(uniqueSubmissionsMap.values());

      // Append pending submissions for students that are allotted but haven't uploaded anything
      if (req.user.role === 'assessor' || req.user.role === 'admin' || req.user.role === 'owner') {
        let candidateQuery: any = {};

        if (req.user.role === 'assessor') {
          const assessor = await User.findById(req.user._id);
          if (assessor && assessor.assessorType) {
            const type = assessor.assessorType;
            if (type === 'GTO') candidateQuery.assignedGTO = assessor._id;
            else if (type === 'TO') candidateQuery.assignedTO = assessor._id;
            else if (type === 'Psych') candidateQuery.assignedPsych = assessor._id;
            else if (type === 'IO') candidateQuery.assignedIO = assessor._id;
          } else {
            // Assessor has no type, don't query candidates
            candidateQuery = null;
          }
        } else if (req.user.role === 'admin' || req.user.role === 'owner') {
          // Admins should see ALL candidates that have AT LEAST ONE assessor assigned
          candidateQuery = {
            $or: [
              { assignedPsych: { $exists: true, $ne: null } },
              { assignedGTO: { $exists: true, $ne: null } },
              { assignedIO: { $exists: true, $ne: null } },
              { assignedTO: { $exists: true, $ne: null } }
            ]
          };
        }

        if (candidateQuery) {
          const candidates = await User.find(candidateQuery).select('_id name email assignedGTO assignedTO assignedPsych assignedIO clinicalStage profileImage chestNo batch');
          const usersWithSubmissions = new Set(submissions.map((s: any) => s.userId && s.userId._id ? s.userId._id.toString() : ''));

          for (const candidate of candidates) {
            if (!usersWithSubmissions.has(candidate._id.toString())) {
              mappedSubmissions.push({
                id: `pending-${candidate._id}`,
                _id: `pending-${candidate._id}`,
                userId: candidate._id,
                status: 'PENDING',
                student: candidate.toObject ? candidate.toObject() : candidate,
                assessmentId: null,
                startedAt: null
              });
            }
          }
        }
      }

      // For admin/owner, ensure they ONLY see students that have at least one assigned assessor
      if (req.user.role === 'admin' || req.user.role === 'owner') {
        mappedSubmissions = mappedSubmissions.filter(sub => {
          const st = sub.student;
          if (!st) return false;
          return st.assignedPsych || st.assignedGTO || st.assignedIO || st.assignedTO;
        });
      }

      res.json(mappedSubmissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/submissions/:id', authenticate, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      const submission = mockSubmissions.find(s => s._id === req.params.id);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });
      return res.json(submission);
    }

    let submissionId = req.params.id;
    if (submissionId.startsWith('pending-')) {
      try {
        const candidateId = submissionId.substring(8);
        const candidateUser = await User.findById(candidateId);
        if (!candidateUser) {
          return res.status(404).json({ message: 'Candidate not found' });
        }

        const activeAssessment = await Assessment.findOne({ active: true });
        const assessmentId = activeAssessment ? activeAssessment._id : null;

        let submission = await Submission.findOne({ userId: candidateId });
        if (!submission) {
          let gtoStatus = candidateUser.assignedGTO ? 'PENDING' : 'NOT_REQUIRED';
          let ioStatus = candidateUser.assignedIO ? 'PENDING' : 'NOT_REQUIRED';
          let toStatus = candidateUser.assignedTO ? 'PENDING' : 'NOT_REQUIRED';
          let psychStatus = candidateUser.assignedPsych ? 'PENDING' : 'NOT_REQUIRED';

          submission = new Submission({
            userId: candidateId,
            assessmentId: assessmentId,
            status: 'PENDING',
            startedAt: null,
            psychStatus,
            gtoStatus,
            ioStatus,
            toStatus
          });
          await submission.save();
        }
        submissionId = (submission as any)._id.toString();
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }

    try {
      const submission = await Submission.findById(submissionId)
        .select('-piqFileData').populate('userId', 'name email assignedGTO assignedTO assignedPsych assignedIO clinicalStage profileImage chestNo batch')
        .populate('assessmentId', 'title');
      res.json(submission);
    } catch (error: any) {
      res.status(404).json({ message: 'Submission not found' });
    }
  });

  app.post('/api/submissions', authenticate, async (req: any, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      const newSub = {
        ...req.body,
        _id: `mock-sub-${Date.now()}`,
        id: `mock-sub-${Date.now()}`,
        userId: req.user._id,
        user: { name: req.user.name, email: req.user.email },
        assessment: MOCK_ASSESSMENTS.find(a => a._id === req.body.assessmentId) || { title: 'Psychology Test Battery' },
        createdAt: new Date().toISOString()
      };
      mockSubmissions.push(newSub);
      return res.status(201).json(newSub);
    }

    try {
      // Check for existing submission for this user and assessment to prevent duplication
      let submission = await Submission.findOne({
        userId: req.user._id,
        assessmentId: req.body.assessmentId
      });

      if (submission) {
        // Protect terminal/advanced statuses from being overwritten by a re-create call
        // (e.g. PIQ upload from ProfileDashboard passes status: 'IN_PROGRESS' which would
        //  reset a PENDING_UPLOAD / COMPLETED submission back to IN_PROGRESS)
        const PROTECTED_STATUSES = ['PENDING_UPLOAD', 'COMPLETED', 'UPLOADED', 'REVIEW_PENDING', 'REPORT_RELEASED', 'MEETING_SCHEDULED'];
        const existingStatus = (submission as any).status;
        const isProtected = PROTECTED_STATUSES.includes(existingStatus);

        Object.keys(req.body).forEach(key => {
          if (key === 'userId' || key === 'assessmentId') return;
          // Never overwrite status if submission is already in a terminal/advanced state
          if (key === 'status' && isProtected) return;
          (submission as any)[key] = req.body[key];
        });
        await submission.save();
        return res.status(200).json(submission);
      }

      // Pre-populate assessor statuses based on candidate allotments
      const candidateUser = await User.findById(req.user._id);
      let gtoStatus = 'NOT_REQUIRED';
      let ioStatus = 'NOT_REQUIRED';
      let toStatus = 'NOT_REQUIRED';
      let psychStatus = 'PENDING'; // Always required if this psychological battery is assigned

      if (candidateUser) {
        if (candidateUser.assignedGTO) gtoStatus = 'PENDING';
        if (candidateUser.assignedIO) ioStatus = 'PENDING';
        if (candidateUser.assignedTO) toStatus = 'PENDING';
        if (candidateUser.assignedPsych) psychStatus = 'PENDING';
      }

      submission = new Submission({
        ...req.body,
        userId: req.user._id,
        startedAt: new Date(),
        psychStatus,
        gtoStatus,
        ioStatus,
        toStatus
      });
      await submission.save();
      res.status(201).json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/submissions/:id/complete', authenticate, async (req: any, res) => {
    try {
      const submission = await Submission.findById(req.params.id).select('-piqFileData');
      if (!submission) return res.status(404).json({ message: 'Submission not found' });
      
      submission.status = 'PENDING_UPLOAD';
      submission.workflowStage = 'EVALUATION_COMPLETED';
      await submission.save();

      // Send Candidate Evaluation Completed notification
      const student = await User.findById(submission.userId);
      const recipientIds: string[] = [];
      if (student) {
        if (student.assignedIO) recipientIds.push(student.assignedIO.toString());
        if (student.assignedTO) recipientIds.push(student.assignedTO.toString());
        if (student.assignedPsych) recipientIds.push(student.assignedPsych.toString());
      }
      
      const admins = await User.find({ role: 'admin' });
      admins.forEach(a => { if (!recipientIds.includes(a._id.toString())) recipientIds.push(a._id.toString()); });
      
      const superAdmins = await AdminUser.find({
        $or: [
          { role: 'owner' },
          { permissions: { $in: ['evaluations', 'super_admin', 'psych_battery'] } }
        ]
      });
      superAdmins.forEach(sa => { if (!recipientIds.includes(sa._id.toString())) recipientIds.push(sa._id.toString()); });

      const candidateName = student ? student.name : 'Candidate';
      for (const recipientId of recipientIds) {
        const notification = new Notification({
          recipientId,
          studentId: submission.userId,
          submissionId: submission._id,
          title: 'Candidate Evaluation Completed',
          message: `Candidate ${candidateName} has completed their Evaluation.`,
          isRead: false
        });
        await notification.save();
      }

      res.json({ message: 'Evaluation marked as complete', submission });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/submissions/:id', authenticate, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      const idx = mockSubmissions.findIndex(s => s._id === req.params.id);
      if (idx !== -1) {
        mockSubmissions[idx] = { ...mockSubmissions[idx], ...req.body };
        return res.json(mockSubmissions[idx]);
      }
      return res.status(404).json({ message: 'Submission not found' });
    }

    let submissionId = req.params.id;
    if (submissionId.startsWith('pending-')) {
      try {
        const candidateId = submissionId.substring(8);
        const candidateUser = await User.findById(candidateId);
        if (!candidateUser) {
          return res.status(404).json({ message: 'Candidate not found' });
        }

        const activeAssessment = await Assessment.findOne({ active: true });
        const assessmentId = activeAssessment ? activeAssessment._id : null;

        let submission = await Submission.findOne({ userId: candidateId });
        if (!submission) {
          let gtoStatus = candidateUser.assignedGTO ? 'PENDING' : 'NOT_REQUIRED';
          let ioStatus = candidateUser.assignedIO ? 'PENDING' : 'NOT_REQUIRED';
          let toStatus = candidateUser.assignedTO ? 'PENDING' : 'NOT_REQUIRED';
          let psychStatus = candidateUser.assignedPsych ? 'PENDING' : 'NOT_REQUIRED';

          submission = new Submission({
            userId: candidateId,
            assessmentId: assessmentId,
            status: 'PENDING',
            startedAt: null,
            psychStatus,
            gtoStatus,
            ioStatus,
            toStatus
          });
          await submission.save();
        }
        submissionId = (submission as any)._id.toString();
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }

    try {
      const oldSubmission = await Submission.findById(submissionId).select('-piqFileData').populate('userId', 'name email');
      const submission = await Submission.findByIdAndUpdate(submissionId, req.body, { new: true }).select('-piqFileData').populate('userId', 'name email');
      
      // Check for meeting link changes and send email if necessary
      const roles = ['psych', 'gto', 'io', 'to'];
      for (const role of roles) {
        const linkField = `${role}MeetingLink`;
        const dateField = `${role}MeetingDate`;
        
        const linkChanged = req.body[linkField] !== undefined && req.body[linkField] !== (oldSubmission as any)[linkField];
        const dateChanged = req.body[dateField] !== undefined && (
          req.body[dateField] === null 
            ? (oldSubmission as any)[dateField] !== null 
            : new Date(req.body[dateField]).getTime() !== new Date((oldSubmission as any)[dateField] || 0).getTime()
        );
        const explicitlyTriggered = req.body.triggerEmail && req.body.meetingRole === role;
        
        if (explicitlyTriggered || linkChanged || dateChanged) {
          const studentEmail = (submission.userId as any)?.email;
          const studentName = (submission.userId as any)?.name || 'Candidate';
          const meetingLink = req.body[linkField] !== undefined ? req.body[linkField] : (submission as any)[linkField];
          const meetingDate = req.body[dateField] !== undefined ? req.body[dateField] : (submission as any)[dateField];
          
          let assessorEmail = '';
          let assessorName = '';
          try {
            const studentId = submission.userId && (submission.userId as any)._id ? (submission.userId as any)._id : submission.userId;
            const student = await User.findById(studentId);
            let assessorId = null;
            if (student) {
              if (role === 'psych' && student.assignedPsych) {
                assessorId = student.assignedPsych;
              } else if (role === 'to' && student.assignedTO) {
                assessorId = student.assignedTO;
              } else if (role === 'gto' && student.assignedGTO) {
                assessorId = student.assignedGTO;
              } else if (role === 'io' && student.assignedIO) {
                assessorId = student.assignedIO;
              }
            }
            
            if (assessorId) {
              const assignedAssessor = await User.findById(assessorId);
              if (assignedAssessor) {
                assessorEmail = assignedAssessor.email;
                assessorName = assignedAssessor.name;
              }
            }
            
            // Fallback to currently logged-in user if no assigned assessor
            if (!assessorEmail && (req as any).user && (req as any).user._id) {
              const assessorUser = await User.findById((req as any).user._id);
              if (assessorUser) {
                assessorEmail = assessorUser.email;
                assessorName = assessorUser.name;
              }
            }
          } catch (err) {
            console.error("Failed to fetch assessor for email:", err);
          }
          
          if (!studentEmail) {
            console.warn(`[EMAIL WARNING] Student email is missing. Cannot send meeting email for ${role.toUpperCase()}.`);
          } else if (!process.env.MSG91_AUTHKEY) {
            console.warn(`[EMAIL WARNING] MSG91_AUTHKEY is missing in env. Cannot send meeting email for ${role.toUpperCase()} to ${studentEmail}.`);
          } else {
            try {
              let formattedDate = 'TBA';
              let formattedTime = 'TBA';
              const isCancelled = (req.body[dateField] === null) || (submission && (submission as any)[dateField] === null && oldSubmission && (oldSubmission as any)[dateField] !== null);
              
              if (isCancelled) {
                formattedDate = 'Cancelled';
                formattedTime = 'Cancelled';
              } else if (meetingDate) {
                const d = new Date(meetingDate);
                formattedDate = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
                formattedTime = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
              }

              const roleLabels: Record<string, string> = {
                psych: 'Psychologist Feedback',
                gto: 'GTO Outdoor Case',
                io: 'Interviewing Officer Interview',
                to: 'Technical Officer Aptitude'
              };
              const roleLabel = roleLabels[role] || role.toUpperCase();
              const assessorRoleName = role === 'psych' ? 'Psychologist' : role === 'to' ? 'Technical Officer' : role === 'gto' ? 'GTO Assessor' : 'Interviewing Officer';

              const sendMsg91Email = (payload: any, label: string) => {
                const formattedPayload = {
                  recipients: [
                    {
                      to: payload.to,
                      variables: payload.variables
                    }
                  ],
                  from: payload.from,
                  domain: payload.domain,
                  template_id: payload.template_id
                };
                const msg91Payload = JSON.stringify(formattedPayload);
                const options = {
                  hostname: 'control.msg91.com',
                  path: '/api/v5/email/send',
                  method: 'POST',
                  headers: {
                    'authkey': process.env.MSG91_AUTHKEY,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(msg91Payload)
                  }
                };

                const reqEmail = https.request(options, (resEmail: any) => {
                  let data = '';
                  resEmail.on('data', (chunk: string) => data += chunk);
                  resEmail.on('end', () => console.log(`Sent meeting email via MSG91 for ${role.toUpperCase()} [${label}]. Status: ${resEmail.statusCode}. Response: ${data}`));
                });
                reqEmail.on('error', (e: any) => console.error(`MSG91 Email Error [${label}]:`, e.message));
                reqEmail.write(msg91Payload);
                reqEmail.end();
              };

              if (role === 'psych' || role === 'to') {
                // Send candidate email using MSG91 template 'psych_interview_candidate'
                const candidatePayload = {
                  to: [{ name: studentName, email: studentEmail }],
                  from: {
                    name: "Integrated SSB Virtuosos",
                    email: "noreply@ssbwithisv.in"
                  },
                  domain: "noreply.ssbwithisv.in",
                  template_id: "psych_interview_candidate",
                  variables: {
                    candidate_name: studentName,
                    assessor_name: assessorName || 'Assessor',
                    assessor_role: assessorRoleName,
                    date: formattedDate,
                    time: formattedTime,
                    meeting_link: meetingLink || '#'
                  }
                };
                sendMsg91Email(candidatePayload, 'Candidate');

                // Send assessor email using MSG91 template 'psych_interview_assessor'
                if (assessorEmail) {
                  const assessorPayload = {
                    to: [{ name: assessorName || 'Assessor', email: assessorEmail }],
                    from: {
                      name: "Integrated SSB Virtuosos",
                      email: "noreply@ssbwithisv.in"
                    },
                    domain: "noreply.ssbwithisv.in",
                    template_id: "psych_interview_assessor",
                    variables: {
                      candidate_name: studentName,
                      assessor_name: assessorName || 'Assessor',
                      assessor_role: assessorRoleName,
                      date: formattedDate,
                      time: formattedTime,
                      meeting_link: meetingLink || '#'
                    }
                  };
                  sendMsg91Email(assessorPayload, 'Assessor');
                } else {
                  console.warn(`[EMAIL WARNING] Assessor email is missing. Cannot send meeting email for ${role.toUpperCase()} Assessor.`);
                }
              } else if (role === 'io') {
                // Send candidate email using MSG91 template 'interview_template_6'
                const candidatePayload = {
                  to: [{ name: studentName, email: studentEmail }],
                  from: {
                    name: "Integrated SSB Virtuosos",
                    email: "noreply@ssbwithisv.in"
                  },
                  domain: "noreply.ssbwithisv.in",
                  template_id: "interview_template_6",
                  variables: {
                    candidate_name: studentName,
                    interview_type: roleLabel,
                    date: formattedDate,
                    time: formattedTime,
                    meeting_link: meetingLink || '#'
                  }
                };
                sendMsg91Email(candidatePayload, 'Candidate');

                // Send IO assessor email using MSG91 template 'io_interview_template'
                if (assessorEmail) {
                  const assessorPayload = {
                    to: [{ name: assessorName || 'Assessor', email: assessorEmail }],
                    from: {
                      name: "Integrated SSB Virtuosos",
                      email: "noreply@ssbwithisv.in"
                    },
                    domain: "noreply.ssbwithisv.in",
                    template_id: "io_interview_template",
                    variables: {
                      candidate_name: studentName,
                      assessor_name: assessorName || 'Assessor',
                      assessor_role: assessorRoleName,
                      date: formattedDate,
                      time: formattedTime,
                      meeting_link: meetingLink || '#'
                    }
                  };
                  sendMsg91Email(assessorPayload, 'Assessor');
                } else {
                  console.warn(`[EMAIL WARNING] Assessor email is missing. Cannot send meeting email for IO Assessor.`);
                }
              } else {
                // Legacy template behavior for other roles (GTO) using 'interview_template_6' to both
                const recipients = [{ name: studentName, email: studentEmail }];
                if (assessorEmail) {
                  recipients.push({ name: assessorName || 'Assessor', email: assessorEmail });
                }

                const legacyPayload = {
                  to: recipients,
                  from: {
                    name: "Integrated SSB Virtuosos",
                    email: "noreply@ssbwithisv.in"
                  },
                  domain: "noreply.ssbwithisv.in",
                  template_id: "interview_template_6",
                  variables: {
                    candidate_name: `${studentName} (${roleLabel})`,
                    interview_type: roleLabel,
                    date: formattedDate,
                    time: formattedTime,
                    meeting_link: meetingLink || '#'
                  }
                };
                sendMsg91Email(legacyPayload, 'Combined-Legacy');
              }
            } catch (emailErr) {
              console.error("Failed to send meeting email:", emailErr);
            }
          }
        }
      }

      res.json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- SUPER ADMIN AUDITING & BROADCAST ENDPOINTS ---
  app.post('/api/submissions/:id/broadcast', authenticate, async (req: any, res) => {
    try {
      // Security: Only admins and owners can broadcast reports
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Access Denied: Administrative privileges required' });
      }

      console.log("[DEBUG BROADCAST] req.body:", req.body);
      const { assessorType } = req.body;

      let submissionId = req.params.id;
      if (submissionId.startsWith('pending-')) {
        try {
          const candidateId = submissionId.substring(8);
          const candidateUser = await User.findById(candidateId);
          if (!candidateUser) {
            return res.status(404).json({ message: 'Candidate not found' });
          }

          const activeAssessment = await Assessment.findOne({ active: true });
          const assessmentId = activeAssessment ? activeAssessment._id : null;

          let submission = await Submission.findOne({ userId: candidateId });
          if (!submission) {
            let gtoStatus = candidateUser.assignedGTO ? 'PENDING' : 'NOT_REQUIRED';
            let ioStatus = candidateUser.assignedIO ? 'PENDING' : 'NOT_REQUIRED';
            let toStatus = candidateUser.assignedTO ? 'PENDING' : 'NOT_REQUIRED';
            let psychStatus = candidateUser.assignedPsych ? 'PENDING' : 'NOT_REQUIRED';

            submission = new Submission({
              userId: candidateId,
              assessmentId: assessmentId,
              status: 'PENDING',
              startedAt: null,
              psychStatus,
              gtoStatus,
              ioStatus,
              toStatus
            });
            await submission.save();
          }
          submissionId = (submission as any)._id.toString();
        } catch (err: any) {
          return res.status(500).json({ message: err.message });
        }
      }

      const submission = await Submission.findById(submissionId).select('-piqFileData');
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      const isIndividual = assessorType && ['psych', 'io', 'gto', 'to'].includes(assessorType.toLowerCase());

      if (isIndividual) {
        const type = assessorType.toLowerCase();
        submission.set(`reportVisibility.${type}`, true);

        // Copy current assessor remarks to released/broadcasted field
        const remarksField = `${type}Remarks`;
        const releasedRemarksField = `released${type.charAt(0).toUpperCase() + type.slice(1)}Remarks`;
        submission.set(releasedRemarksField, submission.get(remarksField) || '');
      } else {
        submission.status = 'REPORT_RELEASED';
        submission.reportVisibility = {
          psych: true,
          io: true,
          gto: true,
          to: true
        };

        // Copy all assessor remarks to released fields
        submission.set('releasedPsychRemarks', (submission as any).psychRemarks || '');
        submission.set('releasedGtoRemarks', (submission as any).gtoRemarks || '');
        submission.set('releasedIoRemarks', (submission as any).ioRemarks || '');
        submission.set('releasedToRemarks', (submission as any).toRemarks || '');
      }

      await submission.save();

      // Create notifications for the student and all allotted assessors
      const student = await User.findById(submission.userId);
      if (student) {
        const recipientIds = [student._id.toString()];
        if (student.assignedPsych) recipientIds.push(student.assignedPsych.toString());
        if (student.assignedGTO) recipientIds.push(student.assignedGTO.toString());
        if (student.assignedIO) recipientIds.push(student.assignedIO.toString());
        if (student.assignedTO) recipientIds.push(student.assignedTO.toString());

        const candidateName = student.name || 'Candidate';
        const notifTitle = isIndividual 
          ? `${assessorType.toUpperCase()} Report Released` 
          : 'Results Broadcasted';
        const notifMessage = isIndividual
          ? `The ${assessorType.toUpperCase()} evaluation report for ${candidateName} has been released by the Admin.`
          : `The official evaluation report for ${candidateName} has been broadcasted by the Admin.`;

        for (const recipientId of new Set(recipientIds)) {
          const notification = new Notification({
            recipientId,
            studentId: submission.userId,
            submissionId: submission._id,
            title: notifTitle,
            message: notifMessage,
            isRead: false
          });
          await notification.save();
        }

        // Send email via MSG91 ONLY for final broadcast
        if (!isIndividual) {
          if (!student.email) {
            console.warn(`[EMAIL WARNING] Student email is missing. Cannot send results broadcast email.`);
          } else if (!process.env.MSG91_AUTHKEY) {
            console.warn(`[EMAIL WARNING] MSG91_AUTHKEY is missing in env. Cannot send results broadcast email to ${student.email}.`);
          } else {
            try {
              const msg91Payload = JSON.stringify({
                recipients: [
                  {
                    to: [
                      { name: candidateName, email: student.email }
                    ],
                    variables: {
                      candidate_name: candidateName,
                      evaluation_details: `Your psychological evaluation results are published. Overall Score: ${submission.score || '--'}.`,
                      report_link: `https://ssbwithisv.in/ProfileDashboard?tab=psycheTest`
                    }
                  }
                ],
                from: {
                  name: "Integrated SSB Virtuosos",
                  email: "noreply@ssbwithisv.in"
                },
                domain: "noreply.ssbwithisv.in",
                template_id: "results_broadcast_template_1"
              });

              const options = {
                hostname: 'control.msg91.com',
                path: '/api/v5/email/send',
                method: 'POST',
                headers: {
                  'authkey': process.env.MSG91_AUTHKEY,
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(msg91Payload)
                }
              };

              const reqEmail = https.request(options, (resEmail: any) => {
                let data = '';
                resEmail.on('data', (chunk: string) => data += chunk);
                resEmail.on('end', () => console.log(`Sent results broadcast email via MSG91. Status: ${resEmail.statusCode}. Response: ${data}`));
              });
              reqEmail.on('error', (e: any) => console.error('MSG91 Results Email Error:', e.message));
              reqEmail.write(msg91Payload);
              reqEmail.end();
            } catch (emailErr) {
              console.error("Failed to send broadcast email:", emailErr);
            }
          }
        }
      }

      res.json({ message: 'Results successfully broadcasted', submission });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/submissions/:id/audit', authenticate, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Access Denied: Administrative privileges required' });
      }

      const submission = await Submission.findById(req.params.id).select('-piqFileData');
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      const { assessorType, action, remarks } = req.body;
      if (!assessorType || !action) {
        return res.status(400).json({ message: 'Assessor type and action are required' });
      }

      const statusField = `${assessorType.toLowerCase()}Status`;
      const remarksField = `${assessorType.toLowerCase()}Remarks`;

      if (action === 'APPROVE') {
        submission.set(statusField, 'COMPLETED');
      } else if (action === 'REJECT') {
        submission.set(statusField, 'UNDER_REVIEW');
        if (remarks) {
          const currentRemarks = submission.get(remarksField) || '';
          submission.set(remarksField, `${currentRemarks}\n\n[ADMIN REVISION REQUEST]: ${remarks}`);
        }
      }

      await submission.save();
      res.json({ message: `Successfully updated ${assessorType} status to ${action}`, submission });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- USER MANAGEMENT ---
  app.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      return res.json([
        { _id: 'mock-user-123456789012', name: 'Preview Student', email: 'student@ssb.com', role: 'student' },
        { _id: 'mock-assessor-123456789012', name: 'Preview Assessor', email: 'assessor@ssb.com', role: 'assessor' },
        { _id: 'mock-admin-123456789012', name: 'Preview Admin', email: 'admin@ssb.com', role: 'admin' }
      ]);
    }

    try {
      const users = await User.find();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- UPLOAD ENDPOINT ---
  const batteryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

  app.post('/api/uploadBatteryImage', authenticate, batteryUpload.single('file'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Enforce 2MB limit for student uploads (Dossiers)
      if (req.user && req.user.role === 'student' && req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ message: 'File size exceeds the 2MB limit for Dossier uploads' });
      }
      
      const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : (req.headers.token as string);
      const url = await forwardToMainBackend(req.file, token);
      res.json({ url, message: 'File uploaded successfully via main backend' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Serve uploaded images/slides static directory
  app.use('/uploads', express.static(path.join(__dirnameSafe, 'public/uploads')));

  // Vite Middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirnameSafe, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    // Global Error Handler to catch unhandled errors (like Multer)
    app.use((err: any, req: any, res: any, next: any) => {
      console.error("GLOBAL ERROR HANDLER:", err);
      res.status(500).json({ 
        error: err.message || 'Internal Server Error', 
        code: err.code,
        stack: err.stack 
      });
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
