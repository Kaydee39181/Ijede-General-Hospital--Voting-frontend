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
let socketConnected = false;

const socketStateListeners = new Set();
const pollUpdatedListeners = new Set();
const adminResultsUpdatedListeners = new Set();
const creatorVotesUpdatedListeners = new Set();

const notifyListeners = (listeners, payload) => {
  listeners.forEach((listener) => listener(payload));
};

const setSocketConnected = (connected) => {
  socketConnected = connected;
  notifyListeners(socketStateListeners, connected);
};

const emitFieldSubscriptions = () => {
  if (!socket || !subscribedFieldIds.length) {
    return;
  }

  socket.emit('fields:subscribe', subscribedFieldIds);
};

const handleConnect = () => {
  setSocketConnected(true);
  emitFieldSubscriptions();
};

const handleDisconnect = () => {
  setSocketConnected(false);
};

const handleConnectError = (error) => {
  setSocketConnected(false);

  if (typeof console !== 'undefined') {
    console.error('[socket] connect_error', error?.message || error);
  }
};

const handlePollUpdated = (payload) => {
  notifyListeners(pollUpdatedListeners, payload);
};

const handleAdminResultsUpdated = (payload) => {
  notifyListeners(adminResultsUpdatedListeners, payload);
};

const handleCreatorVotesUpdated = (payload) => {
  notifyListeners(creatorVotesUpdatedListeners, payload);
};

const detachSocketListeners = (activeSocket) => {
  if (!activeSocket) {
    return;
  }

  activeSocket.off('connect', handleConnect);
  activeSocket.off('disconnect', handleDisconnect);
  activeSocket.off('connect_error', handleConnectError);
  activeSocket.off('poll:updated', handlePollUpdated);
  activeSocket.off('admin:resultsUpdated', handleAdminResultsUpdated);
  activeSocket.off('creator:votesUpdated', handleCreatorVotesUpdated);
};

const attachSocketListeners = (activeSocket) => {
  activeSocket.on('connect', handleConnect);
  activeSocket.on('disconnect', handleDisconnect);
  activeSocket.on('connect_error', handleConnectError);
  activeSocket.on('poll:updated', handlePollUpdated);
  activeSocket.on('admin:resultsUpdated', handleAdminResultsUpdated);
  activeSocket.on('creator:votesUpdated', handleCreatorVotesUpdated);
};

export const connectSocket = (token) => {
  if (!token) {
    return null;
  }

  if (socket) {
    detachSocketListeners(socket);
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token }
  });
  setSocketConnected(socket.connected);
  attachSocketListeners(socket);

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    detachSocketListeners(socket);
    socket.disconnect();
    socket = null;
  }

  setSocketConnected(false);
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
  pollUpdatedListeners.add(handler);
  return () => pollUpdatedListeners.delete(handler);
};

export const onAdminResultsUpdated = (handler) => {
  adminResultsUpdatedListeners.add(handler);
  return () => adminResultsUpdatedListeners.delete(handler);
};

export const onCreatorVotesUpdated = (handler) => {
  creatorVotesUpdatedListeners.add(handler);
  return () => creatorVotesUpdatedListeners.delete(handler);
};

export const onSocketStateChanged = (handler) => {
  socketStateListeners.add(handler);
  handler(socketConnected);
  return () => socketStateListeners.delete(handler);
};
