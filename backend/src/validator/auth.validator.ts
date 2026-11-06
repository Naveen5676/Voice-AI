import { z } from 'zod'

const fields = {
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.').max(128, 'Use no more than 128 characters.'),
}

export const loginSchema = z.object({ ...fields, name: z.string() })
export const loginRequestSchema = loginSchema.omit({ name: true })
export const signupSchema = loginSchema.extend({
  name: z.string().trim().min(1, 'Enter your name.').max(100, 'Use no more than 100 characters.'),
  password: fields.password.min(8, 'Use at least 8 characters.'),
})

export type AuthFormValues = z.infer<typeof loginSchema>
