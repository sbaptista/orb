import { createHmac, timingSafeEqual } from 'node:crypto'

export type OrbProposalCapability = {
  type: 'proposal'
  proposalId: string
  userId: string
  expiresAt: number
}

export type OrbTodoReferenceCapability = {
  type: 'todo_reference'
  todoId: string
  userId: string
  expiresAt: number
}

export type OrbOperationCapability = OrbProposalCapability | OrbTodoReferenceCapability

function signingKey() {
  const key = process.env.ORB_REALTIME_PROPOSAL_SECRET
    || process.env.ORB_API_SECRET
    || process.env.OPENAI_API_KEY
  if (!key) throw new Error('Orb operation proposal signing is not configured')
  return key
}

export function signOrbOperationCapability(payload: OrbOperationCapability): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', signingKey()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function readOrbOperationCapability(token: string): OrbOperationCapability {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) throw new Error('Invalid proposal')
  const expected = createHmac('sha256', signingKey()).update(encoded).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('Invalid proposal')
  }
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as OrbOperationCapability
  if (payload.type !== 'proposal' && payload.type !== 'todo_reference') {
    throw new Error('Invalid signed token')
  }
  if (payload.expiresAt < Date.now()) throw new Error('Proposal expired')
  return payload
}

export function readOrbProposalCapability(token: string): OrbProposalCapability {
  const payload = readOrbOperationCapability(token)
  if (payload.type !== 'proposal') throw new Error('Invalid proposal')
  return payload
}

export function readOrbTodoReferenceCapability(token: string): OrbTodoReferenceCapability {
  const payload = readOrbOperationCapability(token)
  if (payload.type !== 'todo_reference') throw new Error('Invalid todo reference')
  return payload
}

