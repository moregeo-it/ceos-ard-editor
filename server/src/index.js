const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
const session = require('express-session');
const passport = require('./config/passport');

// Load environment variables
require('dotenv').config();

// Import routes
const workspaceRoutes = require('./routes/workspace');
const fileRoutes = require('./routes/file');
const previewRoutes = require('./routes/preview');
const authRoutes = require('./routes/auth');

// Import middleware
const { ensureAuthenticated } = require('./middleware/auth');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));

// Set request size limits to prevent abuse
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

// File upload security settings
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: (parseInt(process.env.MAX_FILE_SIZE) || 50) * 1024 * 1024,
    files: 1 // Maximum number of files allowed per request
  },
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: path.join(__dirname, '../.tmp/'),
  safeFileNames: true, // Removes special characters
  preserveExtension: true
}));

// Session configuration with secure settings
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // Prevents client-side JS from reading the cookie
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax' // Provides some CSRF protection
  }
};

app.use(session(sessionConfig));

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/workspace', ensureAuthenticated, workspaceRoutes);
app.use('/api/file', ensureAuthenticated, fileRoutes);
app.use('/api/preview', ensureAuthenticated, previewRoutes);

for (const folder of ['../workspaces', '../tmp']) {
  fs.ensureDirSync(path.join(__dirname, folder));
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});