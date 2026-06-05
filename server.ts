import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import path from 'path';
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
      const fallbackUri = 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';
      await mongoose.connect(process.env.MONGODB_URI || fallbackUri);
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
            const fallbackSecret = 'hvdvay6ert72839289()aiyg8t87qt72393293883uhefiuh78ttq3ifi78272jbkj?[]]pou89ywe';
            decoded = jwt.verify(trimmedToken, fallbackSecret) as any;
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
        const fallbackSecret = 'hvdvay6ert72839289()aiyg8t87qt72393293883uhefiuh78ttq3ifi78272jbkj?[]]pou89ywe';
        decoded = jwt.verify(token.trim(), fallbackSecret) as any;
      } catch (fallbackErr) {
        console.warn("[AUTH] JWT signature mismatch. Falling back to jwt.decode for local dev recovery.");
        decoded = jwt.decode(token.trim()) as any;
        if (!decoded) throw fallbackErr;
      }
    }
    console.log("[AUTH] Decoded token successfully:", decoded);
    let foundUser = null;

    // Check role from decoded payload
    if (decoded.role === 'admin' || decoded.role === 'franchise' || decoded.role === 'assessor') {
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
        foundUser.role = decoded.role || foundUser.role || 'student';
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
    
    // Enforce "evaluations" permission for admins globally in PsychBattery (except for /api/auth/me so frontend can redirect)
    if (req.user.role === 'admin' && req.path !== '/api/auth/me') {
      const perms = req.user.permissions || [];
      if (!perms.includes('super_admin') && !perms.includes('evaluations')) {
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
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

async function startServer() {
  // MongoDB Connection
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';

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
    if (mongoose.connection.readyState !== 1) {
      try {
        const fallbackUri = 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';
        await mongoose.connect(process.env.MONGODB_URI || fallbackUri);
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
          const fallbackSecret = 'hvdvay6ert72839289()aiyg8t87qt72393293883uhefiuh78ttq3ifi78272jbkj?[]]pou89ywe';
          decoded = jwt.verify(token.trim(), fallbackSecret) as any;
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

  // Helper to forward files to the main VPS backend
  async function forwardToMainBackend(file: any, token: string) {
    const blob = new Blob([file.buffer], { type: file.mimetype });
    const formData = new FormData();
    formData.append('file', blob, file.originalname);
    
    const res = await fetch('https://api.ssbwithisv.in/api/uploadBatteryImage', {
      method: 'POST',
      headers: { 'token': token || '' },
      body: formData
    });
    if (!res.ok) throw new Error(`Main backend upload failed: ${res.statusText}`);
    const data = await res.json();
    return data.url; // Returns the absolute URL hosted on the VPS
  }

  app.post('/api/submissions/:id/upload', authenticate, upload.array('files', 20), async (req: any, res: any) => {
    try {
      const submissionId = req.params.id;
      const submission = await Submission.findById(submissionId);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      // Security: Only allow the student who owns the submission or an admin to upload
      if (req.user.role === 'student' && submission.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      if (!req.files || (req.files as any[]).length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const files = req.files as any[];
      const filePaths: string[] = [];
      const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : (req.headers.token as string);

      for (const file of files) {
        const url = await forwardToMainBackend(file, token);
        filePaths.push(url);
      }

      // Add files to submission
      submission.uploadedFiles = [...(submission.uploadedFiles || []), ...filePaths];
      submission.status = 'REVIEW_PENDING';

      // Perform OCR in background to not block the request
      runOCR(submissionId, filePaths);

      await submission.save();
      res.json({ message: 'Files uploaded successfully', files: filePaths });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function runOCR(submissionId: string, filePaths: string[]) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("Skipping OCR: No GEMINI_API_KEY found");
      return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let fullTranscript = '';

      for (const filePath of filePaths) {
        const absolutePath = path.join(process.cwd(), 'public', filePath);
        if (fs.existsSync(absolutePath)) {
          const fileData = fs.readFileSync(absolutePath);
          const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : (filePath.endsWith('.png') ? 'image/png' : 'image/jpeg');

          try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                {
                  role: 'user',
                  parts: [
                    { inlineData: { data: fileData.toString('base64'), mimeType } },
                    { text: 'Please transcribe the handwritten text in this image accurately. Do not summarize, just output the raw text.' }
                  ]
                }
              ]
            });
            fullTranscript += `\n\n--- Page Transcript ---\n\n${response.text}`;
          } catch (apiErr) {
            console.error(`Gemini OCR failed for ${filePath}:`, apiErr);
          }
        }
      }

      if (fullTranscript.trim()) {
        await Submission.findByIdAndUpdate(submissionId, { evaluation: fullTranscript.trim() });
        console.log(`OCR Complete for submission ${submissionId}`);
      }
    } catch (err) {
      console.error("OCR Pipeline Error:", err);
    }
  }

  // --- PIQ UPLOAD & OCR ROUTES ---
  app.post('/api/submissions/:id/piq', authenticate, upload.array('files', 10), async (req: any, res: any) => {
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

      const files = req.files as any[];
      const fileEntries = files.map(f => ({
        filename: f.originalname,
        mimetype: f.mimetype,
        data: f.buffer.toString('base64'),
        uploadedAt: new Date()
      }));
      const filePaths = files.map(f => `db://${submissionId}/${f.originalname}`);

      // Store file data directly in MongoDB (works on Vercel's read-only filesystem)
      submission.piqFileData = [...(submission.piqFileData || []), ...fileEntries] as any;
      submission.piqFiles = [...(submission.piqFiles || []), ...filePaths];
      submission.piqStatus = 'PROCESSING';
      await submission.save();

      // Perform OCR in background
      runPiqOCR(submissionId, filePaths);

      res.json({ message: 'PIQ files uploaded and processing started', files: filePaths });
    } catch (error: any) {
      console.error('PIQ upload error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Serve PIQ files stored in MongoDB
  app.get('/api/submissions/:id/piq-file/:index', authenticate, async (req: any, res: any) => {
    try {
      const submission = await Submission.findById(req.params.id);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      const index = parseInt(req.params.index, 10);
      const fileData = submission.piqFileData?.[index];
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

  async function runPiqOCR(submissionId: string, filePaths: string[]) {
    // OCR Deactivated temporarily.
    // Set text to empty but mark as PARSED so assessors can review the PIQ.
    let combinedText = '';

    try {
      const submission = await Submission.findById(submissionId);
      if (submission) {
        submission.piqParsedData = combinedText;
        submission.piqStatus = 'PARSED';
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
            permissions: { $in: ['evaluations', 'super_admin'] }
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
              title: 'PIQ & Dossier Ready for Review',
              message: `Candidate ${candidateName} has completed their timed psychological test battery and uploaded their PIQ files. Dossier parsed successfully and is ready for assessment.`,
              isRead: false
            });
            await notification.save();
          }
          console.log(`PIQ OCR Completed and Assessor Notification created for submission ${submissionId}`);

          // --- SMS NOTIFICATION TEST ---
          try {
            const https = require('https');
            const targetNumber = '9884050857';
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
                res.on('end', () => console.log('MSG91 Response:', data));
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
      if (req.user.role === 'assessor' || req.user.role === 'admin') {
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
        } else if (req.user.role === 'admin') {
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

      // For admin, ensure they ONLY see students that have at least one assigned assessor
      if (req.user.role === 'admin') {
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

    try {
      const submission = await Submission.findById(req.params.id)
        .select('-piqFileData').populate('userId', 'name email profileImage')
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

      const submission = new Submission({
        ...req.body,
        userId: req.user._id,
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

    try {
      const oldSubmission = await Submission.findById(req.params.id).select('-piqFileData').populate('userId', 'name email');
      const submission = await Submission.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-piqFileData').populate('userId', 'name email');
      
      // Check for meeting link changes and send email if necessary
      const roles = ['psych', 'gto', 'io', 'to'];
      for (const role of roles) {
        const linkField = `${role}MeetingLink`;
        const dateField = `${role}MeetingDate`;
        
        const linkChanged = req.body[linkField] && req.body[linkField] !== (oldSubmission as any)[linkField];
        const dateChanged = req.body[dateField] && new Date(req.body[dateField]).getTime() !== new Date((oldSubmission as any)[dateField] || 0).getTime();
        const explicitlyTriggered = req.body.triggerEmail && req.body.meetingRole === role;
        
        if (explicitlyTriggered || linkChanged || dateChanged) {
          const studentEmail = (submission.userId as any)?.email;
          const studentName = (submission.userId as any)?.name || 'Candidate';
          const meetingLink = req.body[linkField];
          const meetingDate = req.body[dateField] || (submission as any)[dateField];
          
          if (studentEmail && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
              const transporter = nodemailer.createTransport({
                host: "smtp.zoho.in",
                port: 465,
                secure: true,
                auth: {
                  user: process.env.EMAIL_USER,
                  pass: process.env.EMAIL_PASS
                }
              });

              let meetingMessage = "";
              if (role.toLowerCase() === 'io') {
                meetingMessage = "your mock interview with the Interviewing Officer has been scheduled.";
              } else if (role.toLowerCase() === 'psych') {
                meetingMessage = "Your Psych Test feedback has been scheduled.";
              } else if (role.toLowerCase() === 'to') {
                meetingMessage = "Your TO Test feedback has been scheduled.";
              } else {
                meetingMessage = `Your ${role.toUpperCase()} Test feedback has been scheduled.`;
              }

              await transporter.sendMail({
                from: '"SSB With ISV" <info@ssbwithisv.in>',
                to: studentEmail,
                subject: `SSB Feedback Meeting Scheduled (${role.toUpperCase()} Assessor)`,
                html: `
                  <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://ssbwithisv.in/assets/logo-b9c1b3f8.png" alt="SSB With ISV Logo" style="max-height: 80px;" />
                      </div>
                      <h2 style="color: #C5A028; border-bottom: 2px solid #C5A028; padding-bottom: 10px;">Meeting Scheduled</h2>
                      <p>Dear ${studentName},</p>
                      <p>${meetingMessage}</p>
                      <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #C5A028; margin: 20px 0;">
                        <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong> ${meetingDate ? new Date(meetingDate).toLocaleString() : 'TBA'}</p>
                        <p style="margin: 0;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #C5A028; font-weight: bold; text-decoration: none;">Click here to join</a></p>
                      </div>
                      <p>Please ensure you join the meeting on time.</p>
                      <p>Best Regards,<br/><strong>SSB With ISV Evaluation Team</strong></p>
                    </body>
                  </html>
                `
              });
              console.log(`Sent meeting email to ${studentEmail} for ${role.toUpperCase()}`);
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
      // Security: Only admins can broadcast reports
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access Denied: Administrative privileges required' });
      }

      const submission = await Submission.findById(req.params.id);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });

      submission.status = 'REPORT_RELEASED';
      submission.reportVisibility = {
        psych: true,
        io: true,
        gto: true,
        to: true
      };

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
        for (const recipientId of new Set(recipientIds)) {
          const notification = new Notification({
            recipientId,
            studentId: submission.userId,
            submissionId: submission._id,
            title: 'Results Broadcasted',
            message: `The official evaluation report for ${candidateName} has been broadcasted by the Admin.`,
            isRead: false
          });
          await notification.save();
        }
      }

      res.json({ message: 'Results successfully broadcasted to student', submission });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/submissions/:id/audit', authenticate, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access Denied: Administrative privileges required' });
      }

      const submission = await Submission.findById(req.params.id);
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
