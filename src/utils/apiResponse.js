export const sendApiError = (res, status, code, message, details) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  res.status(status).json(payload);
};
