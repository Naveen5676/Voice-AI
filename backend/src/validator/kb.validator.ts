import { z } from 'zod'

export const createKnowledgeBaseSchema = z.object({
  name: z.string().trim().min(1, 'Give your knowledge base a name.').max(100, 'Name cannot exceed 100 characters.'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters.').optional(),
})

export type CreateKnowledgeBaseValues = z.infer<typeof createKnowledgeBaseSchema>

export const createKbNoteSchema = z.object({
  title: z.string().trim().min(1, 'Give your note a title.').max(200, 'Title cannot exceed 200 characters.'),
  content: z.string().trim().min(1, 'Enter content for your note.').max(20000, 'Content cannot exceed 20,000 characters.'),
})

export type CreateKbNoteValues = z.infer<typeof createKbNoteSchema>

export const kbIdParamSchema = z.object({
  kbId: z.uuid('Enter a valid knowledge base ID.'),
})

export const kbItemIdParamSchema = z.object({
  kbId: z.uuid('Enter a valid knowledge base ID.'),
  itemId: z.uuid('Enter a valid note ID.'),
})
