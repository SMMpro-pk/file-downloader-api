import { z } from 'zod';
import { LIMITS } from '../config/limits.js';

export const extractLinksSchema = z.object({
  url: z
    .string({ required_error: 'The "url" field is required.' })
    .trim()
    .min(1, 'The "url" field cannot be empty.')
    .max(2048, 'The "url" field exceeds the maximum permitted length of 2048 characters.'),
  limit: z
    .coerce
    .number()
    .int()
    .min(1, 'The limit must be at least 1.')
    .max(LIMITS.MAX_EXTRACTED_LINKS, `The limit cannot exceed ${LIMITS.MAX_EXTRACTED_LINKS}.`)
    .default(LIMITS.MAX_EXTRACTED_LINKS)
});

export default {
  extractLinksSchema
};
