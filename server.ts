import express from 'express';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Assessment, Slide, Submission, AdminUser, Notification } from './server/models.js';
import multer from 'multer';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5173', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

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
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.token) {
    token = req.headers.token;
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
          const decoded = jwt.verify(trimmedToken, JWT_SECRET) as any;
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

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token.trim(), JWT_SECRET) as any;
    let foundUser = null;

    // Check role from decoded payload
    if (decoded.role === 'admin' || decoded.role === 'franchise' || decoded.role === 'assessor') {
      const admin = await AdminUser.findById(decoded.id);
      if (admin) {
        foundUser = admin.toObject ? admin.toObject() : admin;
        foundUser.role = decoded.role;
      }
    }

    // Fallback/Standard lookup in User (students / main site UserDetails)
    if (!foundUser) {
      const user = await User.findById(decoded.id)
        .populate('assignedPsych', 'name email')
        .populate('assignedGTO', 'name email')
        .populate('assignedIO', 'name email')
        .populate('assignedTO', 'name email');
      if (user) {
        foundUser = user.toObject ? user.toObject() : user;
        foundUser.role = decoded.role || foundUser.role || 'student';
      }
    }

    if (!foundUser) return res.status(401).json({ message: 'User not found' });
    req.user = foundUser;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
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
  const MONGODB_URI = process.env.MONGODB_URI;

  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
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
        decoded = jwt.verify(token.trim(), JWT_SECRET) as any;
      } catch (e: any) {
        error = e.message;
      }
    }
    
    res.json({
      hasToken: !!token,
      secretPrefix: envSecret,
      secretLength,
      secretHash,
      dbConnected: mongoose.connection.readyState === 1,
      dbName: mongoose.connection.db ? mongoose.connection.db.databaseName : 'NONE',
      userCount: await User.countDocuments().catch(() => -1),
      adminCount: await AdminUser.countDocuments().catch(() => -1),
      decoded,
      error
    });
  });

  // --- ASSESSMENT ROUTES ---
  app.get('/api/assessments', authenticate, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      return res.json(MOCK_ASSESSMENTS);
    }

    try {
      const assessments = await Assessment.find();
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
      const assessment = await Assessment.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  app.get('/api/assessments/:id/slides', authenticate, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true';
    if (isBypass) {
      const slides = MOCK_SLIDES[req.params.id] || [];
      return res.json(slides);
    }

    try {
      const slides = await Slide.find({ assessmentId: req.params.id }).sort('order');
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

  // --- SUBMISSION UPLOAD & OCR ROUTES ---
  const uploadDir = path.join(process.cwd(), 'public/uploads/assessments');
  if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`)
  });
  const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB per file

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
      const filePaths = files.map(f => `/uploads/assessments/${f.filename}`);

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
      const filePaths = files.map(f => `/uploads/assessments/${f.filename}`);

      submission.piqFiles = [...(submission.piqFiles || []), ...filePaths];
      submission.piqStatus = 'PROCESSING';
      await submission.save();

      // Perform OCR in background
      runPiqOCR(submissionId, filePaths);

      res.json({ message: 'PIQ files uploaded and processing started', files: filePaths });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function runPiqOCR(submissionId: string, filePaths: string[]) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("Skipping PIQ OCR: No GEMINI_API_KEY found");
      await Submission.findByIdAndUpdate(submissionId, { piqStatus: 'FAILED' });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let combinedText = '';

      for (const filePath of filePaths) {
        const absolutePath = path.join(process.cwd(), 'public', filePath);
        if (fs.existsSync(absolutePath)) {
          const fileData = fs.readFileSync(absolutePath);
          const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : (filePath.endsWith('.png') ? 'image/png' : 'image/jpeg');

          try {
            console.log(`Processing PIQ page OCR for file: ${filePath}`);
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                {
                  role: 'user',
                  parts: [
                    { inlineData: { data: fileData.toString('base64'), mimeType } },
                    { text: 'You are an expert military selector. Analyze this Personal Information Questionnaire (PIQ) document and extract a detailed, structured, clear profile of the candidate. Include Name, Family Background, Education, SSB Entry, Previous attempts, and notable achievements in markdown lists. Do not add conversational fillers.' }
                  ]
                }
              ]
            });
            combinedText += `\n\n--- Document Page OCR ---\n\n${response.text}`;
          } catch (apiErr) {
            console.error(`Gemini PIQ OCR failed for ${filePath}:`, apiErr);
          }
        }
      }

      if (combinedText.trim()) {
        const submission = await Submission.findById(submissionId);
        if (submission) {
          submission.piqParsedData = combinedText.trim();
          submission.piqStatus = 'PARSED';
          await submission.save();

          // Create notification for the allotted assessor
          const student = await User.findById(submission.userId);
          const recipientIds: string[] = [];
          if (submission.assessorId) {
            recipientIds.push(submission.assessorId.toString());
          } else if (student && student.assignedAssessor) {
            recipientIds.push(student.assignedAssessor.toString());
          } else {
            // Notify all assessors
            const assessors = await User.find({ role: 'assessor' });
            assessors.forEach(a => recipientIds.push(a._id.toString()));
          }

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
        }
      } else {
        await Submission.findByIdAndUpdate(submissionId, { piqStatus: 'FAILED' });
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
        .populate('userId', 'name email assignedGTO assignedTO assignedPsych assignedIO clinicalStage profileImage')
        .populate('assessmentId', 'title type');
      
      const mappedSubmissions = submissions.map(sub => {
        const subJSON = sub.toJSON ? sub.toJSON() : sub;
        return {
          ...subJSON,
          student: subJSON.userId, // Map populated userId to student for frontend
        };
      });
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
        .populate('userId', 'name email profileImage')
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
      const submission = new Submission({ ...req.body, userId: req.user._id });
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
      const submission = await Submission.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  // Serve uploaded images/slides static directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

  // Vite Middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
