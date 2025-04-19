const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const simpleGit = require('simple-git');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const axios = require('axios');

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn('Warning: GITHUB_TOKEN is not set. Push operations may fail if authentication is required.');
}
const DEFAULT_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'm-mohr'; // todo: change to ceos-org
const DEFAULT_REPO_NAME = process.env.GITHUB_REPO_NAME || 'ceos-ard';

// Base directory for workspaces
const WORKSPACES_DIR = path.join(__dirname, '../../workspaces');
const REPO_URL = `https://github.com/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}`;

// Make sure all paths use forward slashes
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

// Create a new workspace
router.post('/create', async (req, res) => {
  try {
    // Generate unique workspace ID
    const workspaceId = uuidv4();
    const workspacePath = path.join(WORKSPACES_DIR, workspaceId);
    
    // Create workspace directory
    await fs.ensureDir(workspacePath);
    
    // Clone repository into workspace
    const git = simpleGit();
    await git.clone(REPO_URL, workspacePath);
    
    // Set up git config in the workspace to avoid warnings
    const workspaceGit = simpleGit(workspacePath);
    await workspaceGit.addConfig('user.name', 'CEOS-ARD Editor User');
    await workspaceGit.addConfig('user.email', 'ceos-ard-editor@example.com');
    
    // Return workspace ID as token
    return res.status(201).json({
      success: true,
      workspaceId,
      message: 'Workspace created successfully'
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create workspace',
      error: error.message
    });
  }
});

// Close/delete a workspace
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workspacePath = path.join(WORKSPACES_DIR, id);
    
    // Check if workspace exists
    if (await fs.pathExists(workspacePath)) {
    // Remove workspace directory
      await fs.remove(workspacePath);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Workspace closed successfully'
    });
  } catch (error) {
    console.error('Error closing workspace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close workspace',
      error: error.message
    });
  }
});

// Get workspace status (git status)
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const workspacePath = path.join(WORKSPACES_DIR, id);
    
    // Check if workspace exists
    if (!await fs.pathExists(workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }
    
    // Get git status
    const git = simpleGit(workspacePath);
    const gitStatus = await git.status();
    
    // Create a simplified array of file status objects
    const files = [];
    
    // Process modified files
    if (gitStatus.modified && gitStatus.modified.length > 0) {
      gitStatus.modified.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'modified'
        });
      });
    }
    
    // Process created/new files
    if (gitStatus.created && gitStatus.created.length > 0) {
      gitStatus.created.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'added'
        });
      });
    }
    
    // Process not_added files (untracked)
    if (gitStatus.not_added && gitStatus.not_added.length > 0) {
      gitStatus.not_added.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'added'
        });
      });
    }
    
    // Process deleted files
    if (gitStatus.deleted && gitStatus.deleted.length > 0) {
      gitStatus.deleted.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'deleted'
        });
      });
    }
    
    // Process renamed files
    if (gitStatus.renamed && gitStatus.renamed.length > 0) {
      gitStatus.renamed.forEach(item => {
        files.push({
          path: normalizePath(item.to),
          originalPath: normalizePath(item.from),
          status: 'renamed'
        });
      });
    }
    
    return res.status(200).json({
      success: true,
      files
    });
  } catch (error) {
    console.error('Error getting workspace status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get workspace status',
      error: error.message
    });
  }
});

// POST /api/workspace/propose - Create a new branch, commit changes, and create a PR
router.post('/propose', async (req, res) => {
  try {
    const workspaceId = req.headers['workspace-id'];
    const { title, description } = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const workspacePath = path.join(WORKSPACES_DIR, workspaceId);
    
    if (!fs.existsSync(workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Ensure we're in a git repository
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: workspacePath });
    } catch (error) {
      try {
        // Initialize git if not already a repo
        await execAsync('git init', { cwd: workspacePath });
        // Configure git user for this repository
        await execAsync('git config user.name "CEOS ARD Editor"', { cwd: workspacePath });
        await execAsync('git config user.email "ceos-ard-editor@example.com"', { cwd: workspacePath });
      } catch (initError) {
        return res.status(500).json({
          success: false,
          message: `Failed to initialize git repository: ${initError.message}`
        });
      }
    }

    // Check if there are any changes to commit
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: workspacePath });
    if (!statusOutput.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No changes to propose'
      });
    }

    // Generate UUID for branch name
    const branchUuid = uuidv4();
    const finalBranchName = `proposal/${branchUuid}`;

    try {
      // Create and checkout a new branch
      await execAsync(`git checkout -b ${finalBranchName}`, { cwd: workspacePath });

      // Add all files
      await execAsync('git add .', { cwd: workspacePath });

      // Commit changes
      await execAsync(`git commit -m "${title.replace(/"/g, '\\"')}"`, { cwd: workspacePath });
      
      // Check if the repository has a remote named "origin"
      let remoteExistsResponse;
      try {
        remoteExistsResponse = await execAsync('git remote get-url origin', { cwd: workspacePath });
      } catch (remoteError) {
        // If no remote exists, check if we have a GitHub repository URL in environment
        const githubRepoUrl = process.env.GITHUB_REPO_URL || `https://github.com/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}.git`;
        try {
          await execAsync(`git remote add origin ${githubRepoUrl}`, { cwd: workspacePath });
          console.log(`Added remote origin: ${githubRepoUrl}`);
        } catch (addRemoteError) {
          return res.status(500).json({
            success: false,
            message: `Failed to add remote repository: ${addRemoteError.message}`
          });
        }
      }

      // Push to remote repository
      let pushResult;
      try {
        // Check if GitHub token is available
        if (GITHUB_TOKEN) {
          // Use token for authentication
          const remoteUrl = (await execAsync('git remote get-url origin', { cwd: workspacePath })).stdout.trim();
          const tokenizedUrl = remoteUrl.replace('https://', `https://${GITHUB_TOKEN}@`);
          pushResult = await execAsync(`git push -u ${tokenizedUrl} ${finalBranchName}`, { 
            cwd: workspacePath,
            // Hide token from logs
            stdio: ['ignore', 'pipe', 'pipe']
          });
        } else {
          // Try without token (might work if SSH is set up or for public repos)
          pushResult = await execAsync(`git push -u origin ${finalBranchName}`, { cwd: workspacePath });
        }
        console.log('Successfully pushed to remote');
      } catch (pushError) {
        return res.status(500).json({
          success: false,
          message: `Failed to push to remote repository: ${pushError.message}`
        });
      }

      // Create pull request using GitHub API
      let pullRequestUrl = '';
      try {
        if (GITHUB_TOKEN) {
          // Extract repository owner and name from the remote URL
          let remoteUrl = (await execAsync('git remote get-url origin', { cwd: workspacePath })).stdout.trim();
          
          // Parse repo owner and name from URL
          let repoOwner, repoName;
          if (remoteUrl.includes('github.com')) {
            const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
            if (match) {
              repoOwner = match[1];
              repoName = match[2];
            } else {
              repoOwner = DEFAULT_REPO_OWNER;
              repoName = DEFAULT_REPO_NAME;
            }
          } else {
            repoOwner = DEFAULT_REPO_OWNER;
            repoName = DEFAULT_REPO_NAME;
          }

          // Create the pull request
          const response = await axios.post(
            `https://api.github.com/repos/${repoOwner}/${repoName}/pulls`,
            {
              title: title,
              body: description,
              head: finalBranchName,
              base: 'main'  // Target branch, usually main or master
            },
            {
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          );
          
          pullRequestUrl = response.data.html_url;
          console.log(`Created pull request: ${pullRequestUrl}`);
        }
      } catch (prError) {
        console.error('Failed to create pull request:', prError);
        // Continue without failing - we'll still return success for the push
      }

      // Return successful response with PR URL if available
      if (pullRequestUrl) {
        return res.json({
          success: true,
          message: 'Changes proposed and pull request created successfully',
          branchName: finalBranchName,
          pullRequestUrl: pullRequestUrl,
          automaticPr: true
        });
      } else {
        return res.json({
          success: true,
          message: 'Changes proposed successfully',
          branchName: finalBranchName,
          automaticPr: false,
          instructions: 'Your changes have been pushed to the remote repository. To complete the process, please create a pull request manually from your Git hosting service.'
        });
      }
    } catch (gitError) {
      return res.status(500).json({
        success: false, 
        message: `Git operation failed: ${gitError.message}`
      });
    }
  } catch (error) {
    console.error('Error proposing changes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to propose changes',
      error: error.message
    });
  }
});

module.exports = router;