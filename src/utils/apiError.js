const buildConfiguredApiOrigin = () => {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (!apiUrl) {
    return '';
  }

  try {
    return new URL(apiUrl).origin;
  } catch (error) {
    return apiUrl;
  }
};

export const getFriendlyApiErrorMessage = (error, fallbackMessage) => {
  const responseMessage = error?.response?.data?.message;

  if (responseMessage) {
    return responseMessage;
  }

  if (error?.message === 'Network Error') {
    const apiOrigin = buildConfiguredApiOrigin();

    if (apiOrigin) {
      return `Cannot reach the server at ${apiOrigin}. Check the Vercel API URL and Railway CORS settings.`;
    }

    return 'Cannot reach the server. Set VITE_API_URL and VITE_SOCKET_URL for the deployed frontend.';
  }

  return error?.message || fallbackMessage;
};
