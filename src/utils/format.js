export const formatDateTime = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
