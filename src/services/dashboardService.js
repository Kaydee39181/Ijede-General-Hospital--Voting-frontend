import api from './api';

export const fetchAdminResults = async () => {
  const response = await api.get('/admin/results');
  return response.data;
};

export const fetchCreatorVotes = async () => {
  const response = await api.get('/creator/votes');
  return response.data;
};
