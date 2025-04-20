const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const util = require('util');
const execAsync = util.promisify(exec);

// Track build processes
const buildProcesses = new Map();

/**
 * Check if ceos-ard CLI is installed and available
 * @returns {Promise<boolean>} True if the tool is available
 */
async function checkPrerequisites() {
  try {
    await execAsync('ceos-ard --version');
    return true;
  } catch (error) {
    console.error('ceos-ard CLI is not installed or not available in PATH:', error.message);
    return false;
  }
}

/**
 * Start a build process for a workspace
 * 
 * @param {string} workspacePath - The absolute path to the workspace directory
 * @param {string} workspaceId - The unique identifier for the workspace
 * @param {string} pfs - Optional PFS to build specifically (if not provided, builds all)
 * @returns {Object} Build info object with status and process details
 */
async function startBuild(workspacePath, workspaceId, pfs = null) {
  // Create tracking object
  const buildInfo = {
    status: 'starting',
    logs: [],
    startTime: Date.now(),
    endTime: null,
    error: null,
    process: null, // Track the process object itself
    type: pfs ? 'specific' : 'all', // Indicate if this is a specific file build
    pfs: pfs, // Store the PFS name if provided
    automatic: true // Flag to indicate this was triggered automatically
  };
  
  try {
    // Check if a build is already in progress for this workspace
    if (buildProcesses.has(workspaceId)) {
      const existingBuild = buildProcesses.get(workspaceId);
      
      // If there's a running process, don't start a new one
      if (existingBuild.process && 
          existingBuild.process.exitCode === null && 
          !existingBuild.process.killed) {
        console.log(`Build already in progress for workspace ${workspaceId}, not starting a new one`);
        return existingBuild;
      }
      
      // Otherwise, we'll start a new build below
      console.log(`Previous build for workspace ${workspaceId} has completed or was killed, starting a new one`);
    }
    
    buildProcesses.set(workspaceId, buildInfo);
    
    // Check prerequisites
    const prereqsOk = await checkPrerequisites();
    if (!prereqsOk) {
      buildInfo.status = 'failed';
      buildInfo.error = 'ceos-ard CLI tool is not installed or not available';
      buildInfo.endTime = Date.now();
      return buildInfo;
    }
    
    // Check if workspace path exists
    if (!await fs.pathExists(workspacePath)) {
      buildInfo.status = 'failed';
      buildInfo.error = `Workspace path does not exist: ${workspacePath}`;
      buildInfo.endTime = Date.now();
      return buildInfo;
    }

    // Run the build process
    buildInfo.status = 'in_progress';
    
    // Prepare command arguments based on whether a specific PFS was provided
    const cmdArgs = ['generate-all', '-o', 'build', '--pdf', '--docx'];
    if (pfs) {
      cmdArgs.push('--pfs', pfs);
    }
    
    // Update build logs
    buildInfo.logs.push({ 
      type: 'info', 
      text: `Starting build for workspace ${workspaceId}${pfs ? ` with PFS ${pfs}` : ' (all files)'}` 
    });
      
    // Run the ceos-ard build command
    const buildCmd = spawn('ceos-ard', cmdArgs, { 
      cwd: workspacePath,
      shell: true
    });
    
    // Store the process reference
    buildInfo.process = buildCmd;
    
    // Collect output
    buildCmd.stdout.on('data', (data) => {
      const logLine = data.toString();
      buildInfo.logs.push({ type: 'stdout', text: logLine });
    });
    
    buildCmd.stderr.on('data', (data) => {
      const logLine = data.toString();
      buildInfo.logs.push({ type: 'stderr', text: logLine });
    });
    
    // Handle process completion
    buildCmd.on('close', (code) => {
      buildInfo.endTime = Date.now();
      if (code === 0) {
        buildInfo.status = 'completed';
        console.log(`Build completed successfully for workspace ${workspaceId}`);
      } else {
        buildInfo.status = 'failed';
        buildInfo.error = `Process exited with code ${code}`;
        console.error(`Build failed for workspace ${workspaceId}: Process exited with code ${code}`);
      }
      
      // Automatically remove from tracking after 30 minutes
      setTimeout(() => {
        if (buildProcesses.has(workspaceId) && buildProcesses.get(workspaceId) === buildInfo) {
          buildProcesses.delete(workspaceId);
        }
      }, 30 * 60 * 1000);
    });
    
    buildCmd.on('error', (err) => {
      buildInfo.status = 'failed';
      buildInfo.error = err.message;
      buildInfo.endTime = Date.now();
      console.error(`Build process error for workspace ${workspaceId}:`, err.message);
    });
    
    return buildInfo;
  } catch (buildError) {
    buildInfo.status = 'failed';
    buildInfo.error = buildError.message;
    buildInfo.endTime = Date.now();
    console.error(`Fatal error starting build for workspace ${workspaceId}:`, buildError);
    return buildInfo;
  }
}

/**
 * Get the status of a build process
 * 
 * @param {string} workspaceId - The unique identifier for the workspace
 * @returns {Object|null} Build info object or null if no build exists
 */
function getBuildStatus(workspaceId) {
  if (!buildProcesses.has(workspaceId)) {
    return null;
  }
  
  // Return a copy without the process reference for safety
  const buildInfo = { ...buildProcesses.get(workspaceId) };
  delete buildInfo.process;
  return buildInfo;
}

module.exports = {
  startBuild,
  getBuildStatus,
  buildProcesses,
  checkPrerequisites
};