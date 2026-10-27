import { ValidationError } from '../utils/errors.js';

/**
 * Express middleware generator that validates request parts using Zod schemas.
 * @param {object} schemas
 * @param {import('zod').ZodType} [schemas.body]
 * @param {import('zod').ZodType} [schemas.query]
 * @param {import('zod').ZodType} [schemas.params]
 */
export function validateRequest(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body && req.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query && req.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params && req.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.name === 'ZodError' || Array.isArray(err.issues)) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }));
        return next(new ValidationError('Request validation failed.', details));
      }
      return next(err);
    }
  };
}

export default validateRequest;
