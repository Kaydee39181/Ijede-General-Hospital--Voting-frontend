import api from './api';

export const registerRequest = async (payload) => {
  const response = await api.post('/auth/register', payload);
  return response.data;
};

export const loginRequest = async (payload) => {
  const response = await api.post('/auth/login', payload);
  return response.data;
};
