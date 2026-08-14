export function sendError(
  res,
  { statusCode, code, message, details, requestId },
) {
  const body = {
    error: {
      code,
      message,
    },
  };

  if (Array.isArray(details) && details.length > 0) {
    body.error.details = details;
  }

  if (requestId) {
    body.error.requestId = requestId;
  }

  return res.status(statusCode).json(body);
}
