import { z } from 'zod'

export const agentTemplateSchema = z.enum(['custom', 'assistant', 'support', 'receptionist'])

export const agentFormSchema = z.object({
  name: z.string().trim().min(1, 'Give your agent a name.').max(100, 'Use no more than 100 characters.'),
  prompt: z.string().trim().min(1, 'Write a prompt or choose a starting point.').max(12000, 'Use no more than 12,000 characters.'),
  templateId: agentTemplateSchema,
})

export type AgentFormValues = z.infer<typeof agentFormSchema>
