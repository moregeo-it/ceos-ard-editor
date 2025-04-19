const express = require('express');
const passport = require('passport');
const router = express.Router();
require('dotenv').config();

// Route to initiate GitHub authentication
router.get('/github', 
  passport.authenticate('github', { scope: ['user:email'] })
);

// GitHub callback route
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/api/auth/login-failed' }),
  (req, res) => {
    // Redirect to client application after successful authentication
    res.redirect(process.env.AUTH_SUCCESS_REDIRECT || 'http://localhost:5174');
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
    res.redirect(process.env.LOGOUT_REDIRECT || 'http://localhost:5174');
  });
});

// Login failed route
router.get('/login-failed', (req, res) => {
  res.redirect(process.env.AUTH_FAILURE_REDIRECT || 'http://localhost:5174/auth-failed');
});

module.exports = router;