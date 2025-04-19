// Authentication middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Return 401 for API requests
  res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};

module.exports = { ensureAuthenticated };