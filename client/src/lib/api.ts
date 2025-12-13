import axios from 'axios';
import type { RoomData } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData: any) => api.post('/auth/register', userData),
  login: (credentials: any) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/me'),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

// Chat API
export const chatAPI = {
  // Room Management
  getRooms: (params?: any) => api.get('/chat/rooms', { params }),
  getPublicRooms: () => api.get('/chat/rooms/public'),
  getMyRooms: () => api.get('/chat/rooms/my'),
  createRoom: (roomData: RoomData) => api.post('/chat/rooms', roomData),
  getRoomDetails: (roomId: string) => api.get(`/chat/rooms/${roomId}`),
  updateRoom: (roomId: string, updates: Partial<RoomData>) => api.patch(`/chat/rooms/${roomId}`, updates),
  joinRoom: (roomId: string) => api.post(`/chat/rooms/${roomId}/join`),
  leaveRoom: (roomId: string) => api.post(`/chat/rooms/${roomId}/leave`),
  
  // Messages
  getMessages: (roomId: string, params?: any) => api.get(`/chat/rooms/${roomId}/messages`, { params }),
  getPinnedMessages: (roomId: string) => api.get(`/chat/rooms/${roomId}/messages/pinned`),

  // Moderation
  addModerator: (roomId: string, userId: string) => api.post(`/chat/rooms/${roomId}/moderators`, { userId }),
  removeModerator: (roomId: string, userId: string) => api.delete(`/chat/rooms/${roomId}/moderators/${userId}`),
  banUser: (roomId: string, userId: string) => api.post(`/chat/rooms/${roomId}/ban`, { userId }),
  unbanUser: (roomId: string, userId: string) => api.post(`/chat/rooms/${roomId}/unban`, { userId }),
};

// Travel Partners API
export const travelPartnersAPI = {
  getRequests: (params?: any) => api.get('/travel-partners/requests', { params }),
  createRequest: (requestData: any) => api.post('/travel-partners/requests', requestData),
  getRequest: (requestId: string) => api.get(`/travel-partners/requests/${requestId}`),
  respondToRequest: (requestId: string, message: string) => 
    api.post(`/travel-partners/requests/${requestId}/respond`, { message }),
  getMyRequests: (params?: any) => api.get('/travel-partners/my-requests', { params }),
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (profileData: any) => api.put('/users/profile', profileData),
  searchUsers: (params?: any) => api.get('/users/search', { params }),
};

// Subscriptions API
export const subscriptionsAPI = {
  getPlans: () => api.get('/subscriptions/plans'),
  getCurrentSubscription: () => api.get('/subscriptions/current'),
  upgrade: (planData: any) => api.post('/subscriptions/upgrade', planData),
  cancel: (cancelData?: any) => api.post('/subscriptions/cancel', cancelData),
  getUsage: () => api.get('/subscriptions/usage'),
  getBillingHistory: () => api.get('/subscriptions/billing-history'),
};

export default api;
