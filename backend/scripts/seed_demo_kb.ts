import { readEnvironment } from '../src/config/env'
import { createPrismaClient } from '../src/db/prisma'

const DEMO_NOTES = [
  {
    title: 'Consultation Fees & Treatment Pricing',
    content: `General Consultation: $50 (includes comprehensive oral exam).
Teeth Cleaning (Prophylaxis): $90 - $120 depending on plaque build-up.
Teeth Whitening (In-office Zoom Whitening): $350 per session.
Root Canal Therapy: $600 to $900 per tooth depending on whether it is a front tooth or molar.
Dental Implants: $1,800 to $2,500 per implant (including crown and abutment).
Composite Fillings: $120 - $220 per tooth.
Emergency walk-in fee: $75 flat fee added to treatment.`
  },
  {
    title: 'Clinic Hours & Location',
    content: `Address: 452 Elmwood Street, Suite 300, Downtown Medical Center, Metro City.
Hours of Operation:
Monday to Friday: 8:00 AM to 6:30 PM.
Saturday: 9:00 AM to 2:00 PM.
Sunday: Closed for routine visits, but emergency phone line is open 24/7.
Parking: Free underground visitor parking available behind the building with parking validation at front desk.
Public Transit: 2 blocks away from Central Station Metro Line B.`
  },
  {
    title: 'Insurance & Payment Policies',
    content: `In-network Insurance: We accept Delta Dental, MetLife, Cigna, Aetna, and Blue Cross Blue Shield.
Out-of-network Insurance: We submit claims on your behalf and provide itemized superbills for direct reimbursement.
Payment options: We accept all major Credit cards, debit cards, cash, HSA/FSA cards, and CareCredit interest-free 6-month financing.
Cancellation policy: Please notify us at least 24 hours in advance to reschedule or cancel to avoid a $35 late-cancellation fee.`
  },
  {
    title: 'Emergency Care & Doctor Roster',
    content: `Lead Cosmetic Dentist: Dr. Sarah Bennett, DDS (Specializes in cosmetic dentistry, veneers, and dental implants. 14 years experience).
Pediatric Dentist: Dr. Michael Zhang, DMD (Specializes in gentle care for children, teens, and anxious patients).
Orthodontist: Dr. Emily Rivera, DDS (Specializes in Invisalign clear aligners and traditional braces).
Dental Emergencies: For severe acute tooth pain, knocked-out teeth, or uncontrollable bleeding, call our 24/7 emergency hotline at 555-0199 immediately.
First aid tip: For a knocked-out tooth, do not scrub the root; store it in a cup of whole milk or cold saline and reach the clinic within 60 minutes.`
  }
]

async function seed() {
  const env = readEnvironment()
  const prisma = createPrismaClient(env.DATABASE_URL)

  try {
    const user = await prisma.user.findFirst()
    if (!user) throw new Error('No user found in database.')

    console.log(`Seeding for user: ${user.name} (${user.email}, ID: ${user.id})`)

    // Check if KB already exists
    let kb = await prisma.knowledgeBase.findFirst({
      where: { ownerId: user.id, name: 'Apex Dental Clinic - FAQ & Pricing' }
    })

    if (!kb) {
      kb = await prisma.knowledgeBase.create({
        data: {
          ownerId: user.id,
          name: 'Apex Dental Clinic - FAQ & Pricing',
          description: 'Operating hours, doctor specialties, consultation pricing, emergency policies, and insurance coverage.'
        }
      })
      console.log(`Created Knowledge Base: ${kb.id} - ${kb.name}`)
    } else {
      console.log(`Using existing Knowledge Base: ${kb.id} - ${kb.name}`)
    }

    // Add or verify notes
    for (const note of DEMO_NOTES) {
      const existingNote = await prisma.kbItem.findFirst({
        where: { knowledgeBaseId: kb.id, title: note.title }
      })
      if (!existingNote) {
        const item = await prisma.kbItem.create({
          data: {
            knowledgeBaseId: kb.id,
            ownerId: user.id,
            title: note.title,
            content: note.content,
            charCount: note.content.length,
            status: 'ready'
          }
        })
        console.log(`Added Note: ${item.id} - "${item.title}"`)
      } else {
        console.log(`Note already exists: "${existingNote.title}"`)
      }
    }

    // Connect to Receptionist agent and update prompt
    const agent = await prisma.agent.findFirst({
      where: { ownerId: user.id }
    })

    if (agent) {
      const updatedAgent = await prisma.agent.update({
        where: { id: agent.id },
        data: {
          name: 'Willow - Dental Clinic Receptionist',
          knowledgeBaseId: kb.id,
          prompt: `You are Willow, the warm and professional front-desk receptionist for Apex Dental Clinic.

CORE ROLE & BEHAVIOR:
- Greet callers warmly, answer their questions clearly, and offer to schedule appointments.
- You have access to a real-time clinic knowledge base via the "query_knowledge_base" tool.
- Whenever a caller asks about pricing, treatment fees, clinic hours, location, insurance, emergency care, or specific doctors, ALWAYS use the "query_knowledge_base" tool to look up accurate, up-to-date facts before answering.
- Keep your answers natural, concise, and conversational. Do not read raw bullet points or say "according to the database" - speak like an experienced clinic receptionist having a conversation over the phone.
- If an emergency is described (e.g. knocked out tooth or severe bleeding), immediately provide the emergency hotline (555-0199) and first-aid instructions from the knowledge base.`
        }
      })
      console.log(`Updated Agent ${updatedAgent.id}: Attached KB ${kb.name}`)
    }

    // Print all items for vector sync
    const allItems = await prisma.kbItem.findMany({
      where: { knowledgeBaseId: kb.id }
    })
    console.log('SYNC_DATA:' + JSON.stringify({ kb_id: kb.id, items: allItems }))

  } finally {
    await prisma.$disconnect()
  }
}

seed().catch(console.error)
