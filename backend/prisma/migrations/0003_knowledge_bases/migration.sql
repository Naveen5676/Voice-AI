-- AlterTable
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "knowledge_base_id" UUID;

-- AlterTable
ALTER TABLE "VoiceCall" ADD COLUMN IF NOT EXISTS "knowledge_base_id" UUID;

-- CreateTable
CREATE TABLE IF NOT EXISTS "knowledge_bases" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "kb_items" (
    "id" UUID NOT NULL,
    "knowledge_base_id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "char_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "knowledge_bases_owner_id_idx" ON "knowledge_bases"("owner_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kb_items_knowledge_base_id_idx" ON "kb_items"("knowledge_base_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kb_items_owner_id_idx" ON "kb_items"("owner_id");

-- AddForeignKey
ALTER TABLE "knowledge_bases" DROP CONSTRAINT IF EXISTS "knowledge_bases_owner_id_fkey";
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_items" DROP CONSTRAINT IF EXISTS "kb_items_knowledge_base_id_fkey";
ALTER TABLE "kb_items" ADD CONSTRAINT "kb_items_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_items" DROP CONSTRAINT IF EXISTS "kb_items_owner_id_fkey";
ALTER TABLE "kb_items" ADD CONSTRAINT "kb_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_knowledge_base_id_fkey";
ALTER TABLE "agents" ADD CONSTRAINT "agents_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
