import api from './api';

export const createVote = async (payload) => {
  const response = await api.post('/vote', payload);
  return response.data;
};

export const fetchMyVotes = async () => {
  const response = await api.get('/vote/my');
  return response.data;
};
