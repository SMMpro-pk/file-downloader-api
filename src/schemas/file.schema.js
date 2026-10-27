import { z } from 'zod';

export const fileUrlSchema = z.object({
  url: z
    .string({ required_error: 'The "url" field is required.' })
    .trim()
    .min(1, 'The "url" field cannot be empty.')
    .max(2048, 'The "url" field exceeds the maximum permitted length of 2048 characters.')
});

export default {
  fileUrlSchema
};
