import { z } from 'zod';

export const downloadSchema = z.object({
  url: z
    .string({ required_error: 'The "url" field is required.' })
    .trim()
    .min(1, 'The "url" field cannot be empty.')
    .max(2048, 'The "url" field exceeds the maximum permitted length of 2048 characters.'),
  mode: z
    .enum(['stream', 'redirect'], {
      errorMap: () => ({ message: 'Download mode must be either "stream" or "redirect".' })
    })
    .default('stream')
});

export default {
  downloadSchema
};
