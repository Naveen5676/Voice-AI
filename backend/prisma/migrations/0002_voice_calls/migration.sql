-- CreateTable
CREATE TABLE "VoiceCall" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "agentId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "roomName" TEXT NOT NULL,
    "participantIdentity" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "agentUpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dispatchId" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "joinDeadline" TIMESTAMPTZ(6) NOT NULL,
    "readyDeadline" TIMESTAMPTZ(6) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "cleanupPending" BOOLEAN NOT NULL DEFAULT false,
    "cleanupLeaseUntil" TIMESTAMPTZ(6),

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCallEvent" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceCallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_roomName_key" ON "VoiceCall"("roomName");

-- CreateIndex
CREATE INDEX "VoiceCall_ownerId_createdAt_idx" ON "VoiceCall"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCall_status_expiresAt_idx" ON "VoiceCall"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_ownerId_idempotencyKey_key" ON "VoiceCall"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCallEvent_callId_eventId_key" ON "VoiceCallEvent"("callId", "eventId");

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallEvent" ADD CONSTRAINT "VoiceCallEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
