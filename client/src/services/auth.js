import axios from 'axios';
import { API_URL } from '../config.js';

// Create an axios instance with credentials support
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true // Important for cookies/sessions
});

export const AuthService = {
  // Get current authenticated user
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/user');
      return response.data.success ? response.data.user : null;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  },
  
  // Check if the user is authenticated
  async checkAuthentication() {
    const user = await this.getCurrentUser();
    return !!user;
  },
  
  // Logout the user
  async logout() {
    try {
      window.location.href = `${API_URL}/auth/logout`;
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  }
};

// Export configured axios instance for other API calls
export default api;