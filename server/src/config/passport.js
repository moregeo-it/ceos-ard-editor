const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
require('dotenv').config();

// Configure Passport to use GitHub strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/api/auth/github/callback`,
    scope: ['user:email', 'public_repo']  // Add repo scope to allow creating forks and PRs
  },
  (accessToken, refreshToken, profile, done) => {
    // Store the access token with the profile
    const authInfo = { accessToken };
    
    // Store the username which is required for GitHub operations
    if (profile && !profile.username && profile._json && profile._json.login) {
      profile.username = profile._json.login;
    }
    
    // In a production app, you might want to store user info in a database
    // For simplicity, we're just using the profile object provided by GitHub
    return done(null, profile, authInfo);
  }
));

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;