const express = require('express');
const passport = require('passport');
const router = express.Router();
require('dotenv').config();

// Route to initiate GitHub authentication - scopes are defined in passport.js
router.get('/github', 
  passport.authenticate('github')
);

// GitHub callback route
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/api/auth/login-failed' }),
  async (req, res) => {
    // Store the access token in the session for API calls
    if (req.user && req.authInfo && req.authInfo.accessToken) {
      req.session.githubToken = req.authInfo.accessToken;
    }
    
    // Redirect to client application after successful authentication
    // The client will handle checking for existing workspaces
    res.redirect(process.env.AUTH_SUCCESS_REDIRECT || 'http://localhost:5173');
  }
);

// Get current authenticated user info
router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        avatar: req.user.photos?.[0]?.value
      }
    });
  }
  return res.json({ success: false, user: null });
});

// Logout route
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect(process.env.LOGOUT_REDIRECT || 'http://localhost:5173');
  });
});

// Login failed route
router.get('/login-failed', (req, res) => {
  res.redirect(process.env.AUTH_FAILURE_REDIRECT || 'http://localhost:5173/auth-failed');
});

module.exports = router;