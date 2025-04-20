import api from './auth.js';

export class BuildService {
  constructor() {
    this.pollingInterval = null;
    this.listeners = [];
    this.isPolling = false;
    this.buildStatus = null;
    this.buildLogs = '';
    this.error = null;
  }

  // Add a listener for status updates
  addStatusListener(callback) {
    this.listeners.push(callback);
    // Immediately notify with current status if available
    if (this.buildStatus) {
      callback({
        status: this.buildStatus,
        logs: this.buildLogs,
        error: this.error
      });
    }
    return () => this.removeStatusListener(callback);
  }

  // Remove a listener
  removeStatusListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of status updates
  notifyListeners() {
    this.listeners.forEach(listener => {
      listener({
        status: this.buildStatus,
        logs: this.buildLogs,
        error: this.error
      });
    });
  }

  // Start a build for a specific PFS
  async startBuild(workspaceId, pfs = null) {
    if (!workspaceId) {
      throw new Error('No workspace ID provided');
    }

    try {
      // Build params - only include pfs if it's provided
      const params = {};
      if (pfs) {
        params.pfs = pfs;
      }

      // Start the build
      const response = await api.post('/preview/build', {}, {
        params,
        headers: {
          'Content-Type': 'application/json',
          'Workspace-Id': workspaceId
        }
      });

      // If build started successfully, start polling for status
      if (response.data.success) {
        this.startPolling(workspaceId);
        return { success: true };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Failed to start build' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message || error.response?.data?.message || 'Unknown error' 
      };
    }
  }

  // Check if a build is already in progress
  async checkBuildStatus(workspaceId) {
    if (!workspaceId) {
      throw new Error('No workspace ID provided');
    }

    try {
      const response = await api.get('/preview/build-status', {
        headers: {
          'Workspace-Id': workspaceId
        }
      });

      this.buildStatus = response.data.status;
      this.buildLogs = response.data.logs ? response.data.logs.map(log => log.text).join('') : '';
      this.error = response.data.error;

      this.notifyListeners();

      return {
        status: this.buildStatus,
        logs: this.buildLogs,
        error: this.error
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // No build in progress
        this.buildStatus = null;
        this.buildLogs = '';
        this.error = null;
        this.notifyListeners();
        
        return { status: null };
      }
      
      this.error = error.message || error.response?.data?.message || 'Unknown error';
      this.notifyListeners();
      
      throw error;
    }
  }

  // Start polling for build status
  startPolling(workspaceId) {
    if (this.isPolling) {
      return;
    }

    // Mark as polling and initialize status
    this.isPolling = true;
    this.buildStatus = 'starting';
    this.buildLogs = '';
    this.error = null;
    
    // Notify listeners that polling has started
    this.notifyListeners();

    const pollingStartTime = Date.now();
    const POLLING_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

    // Clear any existing interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Set up polling interval (every 2 seconds)
    this.pollingInterval = setInterval(async () => {
      try {
        // Check if we've exceeded the timeout
        if (Date.now() - pollingStartTime > POLLING_TIMEOUT) {
          this.stopPolling();
          this.buildStatus = 'timeout';
          this.error = 'Build timed out after 5 minutes';
          this.notifyListeners();
          return;
        }

        // Check the build status
        await this.checkBuildStatus(workspaceId);

        // If build completed or failed, stop polling
        if (this.buildStatus === 'completed' || this.buildStatus === 'failed') {
          setTimeout(() => {
            this.stopPolling();
          }, 1000); // Keep the status for a short time so user can see it
        }
      } catch (error) {
        // Only log once per minute to avoid console spam
        if (Math.floor((Date.now() - pollingStartTime) / 60000) % 1 === 0) {
          console.warn('Error polling build status:', error);
        }
      }
    }, 2000);
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  // Get a status message for UI display based on current status
  getStatusMessage() {
    switch (this.buildStatus) {
      case 'starting':
        return 'Preparing build environment...';
      case 'in_progress':
        return 'Building documents...';
      case 'completed':
        return 'Build completed successfully!';
      case 'failed':
        return `Build failed: ${this.error || 'Unknown error'}`;
      case 'timeout':
        return 'Build timed out after 5 minutes';
      default:
        return `Build status: ${this.buildStatus || 'Unknown'}`;
    }
  }

  // Clean up resources
  dispose() {
    this.stopPolling();
    this.listeners = [];
  }
}

// Export a singleton instance for app-wide use
export const buildService = new BuildService();
export default buildService;