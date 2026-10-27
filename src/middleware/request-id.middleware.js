import crypto from 'crypto';

export function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim())
    ? incomingId.trim().substring(0, 64)
    : `req_${crypto.randomUUID().replace(/-/g, '')}`;

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  /**
   * Helper to send standardized successful JSON response
   */
  res.jsonEnvelope = function (data, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      data: data !== undefined ? data : null,
      error: null,
      requestId
    });
  };

  /**
   * Helper to send standardized error JSON response
   */
  res.errorEnvelope = function (code, message, details = null, statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      data: null,
      error: {
        code,
        message,
        details
      },
      requestId
    });
  };

  next();
}

export default requestIdMiddleware;
