/**
 * Standard Application Error with HTTP status code and standardized error code.
 */
export class AppError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Missing or invalid API key.') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenDestinationError extends AppError {
  constructor(message = 'Access to private or prohibited network destinations is blocked.') {
    super('FORBIDDEN_DESTINATION', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found.') {
    super('NOT_FOUND', message, 404);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'File size or request payload exceeds configured limits.') {
    super('PAYLOAD_TOO_LARGE', message, 413);
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(message = 'The requested file format is not supported for this operation.') {
    super('UNSUPPORTED_FORMAT', message, 415);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'The supplied URL could not be processed as a downloadable file.') {
    super('UNPROCESSABLE_ENTITY', message, 422);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Rate limit exceeded. Please try again later.') {
    super('TOO_MANY_REQUESTS', message, 429);
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Upstream server returned an invalid or failed response.', details = null) {
    super('UPSTREAM_ERROR', message, 502, details);
  }
}

export class UpstreamTimeoutError extends AppError {
  constructor(message = 'Upstream request timed out.') {
    super('UPSTREAM_TIMEOUT', message, 504);
  }
}
