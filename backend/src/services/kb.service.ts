import type { Database } from '../db/prisma.js'
import { HttpError } from '../lib/http-error.js'
import type { CreateKbNoteValues, CreateKnowledgeBaseValues } from '../validator/kb.validator.js'

export function createKbService(prisma: Database, vectorServiceUrl: string) {
  async function syncVectorIndex(text: string, itemId: string, kbId: string) {
    try {
      const response = await fetch(`${vectorServiceUrl}/index-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, item_id: itemId, kb_id: kbId }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.warn('Vector service index failed:', errorText)
      }
    } catch (cause) {
      console.warn('Vector service is unreachable during index:', cause)
    }
  }

  async function syncVectorDelete(itemId?: string, kbId?: string) {
    try {
      await fetch(`${vectorServiceUrl}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, kb_id: kbId }),
      })
    } catch (cause) {
      console.warn('Vector service is unreachable during delete:', cause)
    }
  }

  return {
    async listKbs(ownerId: string) {
      const kbs = await prisma.knowledgeBase.findMany({
        where: { ownerId },
        include: {
          _count: { select: { items: true, agents: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return kbs.map((kb) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description ?? '',
        itemCount: kb._count.items,
        agentCount: kb._count.agents,
        createdAt: kb.createdAt.toISOString(),
        updatedAt: kb.updatedAt.toISOString(),
      }))
    },

    async getKb(ownerId: string, kbId: string) {
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, ownerId },
        include: {
          _count: { select: { items: true, agents: true } },
          items: { orderBy: { createdAt: 'desc' } },
        },
      })
      if (!kb) throw new HttpError(404, 'Knowledge base not found.')

      return {
        id: kb.id,
        name: kb.name,
        description: kb.description ?? '',
        itemCount: kb._count.items,
        agentCount: kb._count.agents,
        createdAt: kb.createdAt.toISOString(),
        updatedAt: kb.updatedAt.toISOString(),
        items: kb.items.map((item) => ({
          id: item.id,
          knowledgeBaseId: item.knowledgeBaseId,
          title: item.title,
          content: item.content,
          charCount: item.charCount,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
        })),
      }
    },

    async createKb(ownerId: string, values: CreateKnowledgeBaseValues) {
      const count = await prisma.knowledgeBase.count({ where: { ownerId } })
      if (count >= 10) throw new HttpError(400, 'Maximum limit of 10 knowledge bases reached.')

      const kb = await prisma.knowledgeBase.create({
        data: {
          ownerId,
          name: values.name,
          description: values.description ?? null,
        },
      })

      return {
        id: kb.id,
        name: kb.name,
        description: kb.description ?? '',
        itemCount: 0,
        agentCount: 0,
        createdAt: kb.createdAt.toISOString(),
        updatedAt: kb.updatedAt.toISOString(),
      }
    },

    async deleteKb(ownerId: string, kbId: string) {
      const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, ownerId } })
      if (!kb) throw new HttpError(404, 'Knowledge base not found.')

      await prisma.knowledgeBase.delete({ where: { id: kbId } })
      void syncVectorDelete(undefined, kbId)

      return { ok: true, id: kbId }
    },

    async listNotes(ownerId: string, kbId: string) {
      const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, ownerId } })
      if (!kb) throw new HttpError(404, 'Knowledge base not found.')

      const items = await prisma.kbItem.findMany({
        where: { knowledgeBaseId: kbId, ownerId },
        orderBy: { createdAt: 'desc' },
      })

      return items.map((item) => ({
        id: item.id,
        knowledgeBaseId: item.knowledgeBaseId,
        title: item.title,
        content: item.content,
        charCount: item.charCount,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
      }))
    },

    async createNote(ownerId: string, kbId: string, values: CreateKbNoteValues) {
      const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, ownerId } })
      if (!kb) throw new HttpError(404, 'Knowledge base not found.')

      const count = await prisma.kbItem.count({ where: { knowledgeBaseId: kbId } })
      if (count >= 20) throw new HttpError(400, 'Maximum limit of 20 notes reached for this knowledge base.')

      const item = await prisma.kbItem.create({
        data: {
          knowledgeBaseId: kbId,
          ownerId,
          title: values.title,
          content: values.content,
          charCount: values.content.length,
          status: 'ready',
        },
      })

      void syncVectorIndex(values.content, item.id, kbId)

      return {
        id: item.id,
        knowledgeBaseId: item.knowledgeBaseId,
        title: item.title,
        content: item.content,
        charCount: item.charCount,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
      }
    },

    async deleteNote(ownerId: string, kbId: string, itemId: string) {
      const item = await prisma.kbItem.findFirst({ where: { id: itemId, knowledgeBaseId: kbId, ownerId } })
      if (!item) throw new HttpError(404, 'Note not found.')

      await prisma.kbItem.delete({ where: { id: itemId } })
      void syncVectorDelete(itemId, kbId)

      return { ok: true, id: itemId }
    },
  }
}

export type KbService = ReturnType<typeof createKbService>
