import api from './api';

export const fetchFields = async () => {
  const response = await api.get('/fields');
  return response.data;
};
