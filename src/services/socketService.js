import { io } from 'socket.io-client';

const getDefaultSocketUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000`;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || getDefaultSocketUrl();

let socket;
let subscribedFieldIds = [];

const emitFieldSubscriptions = () => {
  if (!socket || !subscribedFieldIds.length) {
    return;
  }

  socket.emit('fields:subscribe', subscribedFieldIds);
};

export const connectSocket = (token) => {
  if (!token) {
    return null;
  }

  if (socket) {
    socket.off('connect', emitFieldSubscriptions);
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket']
  });
  socket.on('connect', emitFieldSubscriptions);

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.off('connect', emitFieldSubscriptions);
    socket.disconnect();
    socket = null;
  }

  subscribedFieldIds = [];
};

export const getSocket = () => socket;

export const subscribeToFieldRooms = (fieldIds) => {
  subscribedFieldIds = Array.isArray(fieldIds)
    ? [...new Set(fieldIds.filter((fieldId) => typeof fieldId === 'string' && fieldId.trim()))]
    : [];

  if (socket) {
    socket.emit('fields:subscribe', subscribedFieldIds);
  }
};

export const onPollUpdated = (handler) => {
  if (!socket) {
    return () => {};
  }

  socket.on('poll:updated', handler);
  return () => socket.off('poll:updated', handler);
};

export const onAdminResultsUpdated = (handler) => {
  if (!socket) {
    return () => {};
  }

  socket.on('admin:resultsUpdated', handler);
  return () => socket.off('admin:resultsUpdated', handler);
};

export const onCreatorVotesUpdated = (handler) => {
  if (!socket) {
    return () => {};
  }

  socket.on('creator:votesUpdated', handler);
  return () => socket.off('creator:votesUpdated', handler);
};

export const onSocketStateChanged = (handler) => {
  if (!socket) {
    return () => {};
  }

  const onConnect = () => handler(true);
  const onDisconnect = () => handler(false);

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  handler(socket.connected);

  return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
  };
};
