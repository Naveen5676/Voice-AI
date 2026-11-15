import { z } from 'zod'

export const agentTemplateSchema = z.enum(['custom', 'assistant', 'support', 'receptionist'])

export const agentFormSchema = z.object({
  name: z.string().trim().min(1, 'Give your agent a name.').max(100, 'Use no more than 100 characters.'),
  prompt: z.string().trim().min(1, 'Write a prompt or choose a starting point.').max(12000, 'Use no more than 12,000 characters.'),
  templateId: agentTemplateSchema,
  knowledgeBaseId: z.string().uuid().nullable().optional(),
})

export type AgentFormValues = z.infer<typeof agentFormSchema>

export const createAgentSchema = agentFormSchema.extend({
  templateId: agentTemplateSchema.default('custom'),
}).strict()

export const updateAgentSchema = agentFormSchema.partial().strict().refine(
  (values) => Object.keys(values).length > 0,
  'Provide at least one field to update.',
)

export const agentIdSchema = z.object({ id: z.uuid('Enter a valid agent ID.') })
export type UpdateAgentValues = z.infer<typeof updateAgentSchema>
