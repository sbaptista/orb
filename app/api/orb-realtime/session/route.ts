import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getRealtimeVoiceAccess } from '@/lib/orb-realtime/access'

export const runtime = 'nodejs'

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  if (!getRealtimeVoiceAccess(user.email).enabled) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 })

  const sdp = await request.text()
  if (!sdp || sdp.length > 100_000) return Response.json({ error: 'Invalid SDP offer' }, { status: 400 })
  const session = {
    type: 'realtime',
    model: REALTIME_MODEL,
    include: ['item.input_audio_transcription.logprobs'],
    instructions: [
      'You are Orb in an isolated development voice architecture test.',
      'Be conversational and concise. Never invent counts, task facts, identifiers, ownership, or mutation results.',
      'For factual or next-step questions, call the matching fact tool before speaking. Use get_project_directory for the count or names of projects the user owns, get_todo_details for one todo name or code, and list_todos when the user asks which tasks match. A task request that names any project is always named_project scope. Use all_owned only when the user explicitly asks across all projects, all of their projects, or overall. Never widen an omitted or uncertain project scope to all projects.',
      'For todo creation, call propose_create_todo. For any todo update, delete, or move, call the matching proposal tool directly with the todo name or code and any project name the user supplied. Preserve the user’s complete title phrase in todo_reference instead of shortening it to topic keywords. The server resolves exactly one current database row or rejects ambiguity; do not require the user to know a task code and do not perform a separate detail read first.',
      'Todo updates may change title, priority, or a non-closed status. Priority values are 1=urgent, 2=high, 3=normal, and 4=low. Translate those natural priority labels directly; never ask the user to supply the number after they used a known label. Closing is not available in this Realtime operator because it requires resolution notes and knowledge handling; explain that limitation instead of trying another mutation.',
      'Never say a mutation happened until a proposal or confirmation tool returns a database receipt. A proposal without a receipt is still pending.',
      'The server—not you—decides whether the user granted permission in the requesting utterance or explicitly approved a pending proposal. Never call confirm_todo_mutation to resolve a complaint, discussion, or reminder about earlier permission.',
      'A proposal is not a completed action. Ask for confirmation exactly once.',
      'When a tool returns spokenText, say that exact factual core without changing any number, identifier, title, project, or completion state.',
      'Do not offer surveys or unrelated follow-up work.',
    ].join(' '),
    audio: {
      input: {
        noise_reduction: { type: 'far_field' },
        transcription: { model: 'gpt-4o-mini-transcribe' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.65,
          prefix_padding_ms: 300,
          silence_duration_ms: 450,
          create_response: false,
          interrupt_response: true,
        },
      },
      output: { voice: 'marin' },
    },
    tools: [
      {
        type: 'function',
        name: 'get_task_count',
        description: 'Get an exact live task count. Choose named_project whenever the user names a project; choose all_owned only for an explicit across-all-projects request. “Open” means status=open only; “active” means open plus in progress; “parked” means deferred plus on hold. The server rejects missing or inconsistent scope instead of widening it.',
        parameters: {
          type: 'object',
          properties: {
            project_scope: { type: 'string', enum: ['named_project', 'all_owned'], description: 'named_project if any project was named; all_owned only if the user explicitly requested a cross-project total.' },
            project_name: { type: 'string', description: 'User-facing project name. Required when project_scope is named_project; omit for all_owned.' },
            status_scope: { type: 'string', enum: ['open', 'active', 'parked', 'all'] },
          },
          required: ['project_scope', 'status_scope'],
          additionalProperties: false,
        },
      },
      { type: 'function', name: 'get_project_directory', description: 'Get the exact live count and names of current, non-dormant projects owned by the user.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
      { type: 'function', name: 'get_todo_details', description: 'Read one live todo by its natural title or code. Include the project name when the user supplies it. The server rejects ambiguous matches.', parameters: { type: 'object', properties: { todo_reference: { type: 'string', description: 'Todo title or exact code.' }, project_name: { type: 'string', description: 'Optional user-facing project name.' } }, required: ['todo_reference'], additionalProperties: false } },
      {
        type: 'function', name: 'list_todos',
        description: 'List matching live todos. Choose named_project whenever the user names a project; choose all_owned only for an explicit cross-project request. The server rejects missing or inconsistent project scope.',
        parameters: {
          type: 'object',
          properties: {
            project_scope: { type: 'string', enum: ['named_project', 'all_owned'] },
            project_name: { type: 'string', description: 'Required for named_project; omit for all_owned.' },
            status_scope: { type: 'string', enum: ['open', 'active', 'parked', 'all'] },
            text_match: { type: 'string', description: 'Optional title text filter.' },
            max_results: { type: 'integer', minimum: 1, maximum: 10 },
          },
          required: ['project_scope', 'status_scope'],
          additionalProperties: false,
        },
      },
      { type: 'function', name: 'get_next_step', description: 'Get one recommended next task from a live owned-project database snapshot.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
      { type: 'function', name: 'propose_create_todo', description: 'Prepare, but do not execute, one todo creation for confirmation.', parameters: { type: 'object', properties: { title: { type: 'string' }, project_id: { type: 'string' } }, required: ['title'], additionalProperties: false } },
      {
        type: 'function', name: 'propose_update_todo',
        description: 'Resolve and prepare an update from a natural todo title or code. Include the project name when supplied. At least one new value is required. Closed status is intentionally unavailable.',
        parameters: {
          type: 'object', properties: {
            todo_reference: { type: 'string', description: 'The user’s complete todo title phrase or exact code; do not shorten it to topic keywords.' },
            project_name: { type: 'string' },
            new_title: { type: 'string' },
            new_status: { type: 'string', enum: ['open', 'in progress', 'deferred', 'on hold'] },
            new_priority: { type: 'integer', minimum: 1, maximum: 4, description: '1=urgent, 2=high, 3=normal, 4=low.' },
          }, required: ['todo_reference'], additionalProperties: false,
        },
      },
      { type: 'function', name: 'propose_delete_todo', description: 'Resolve and prepare deletion from a natural todo title or code. Include the project name when supplied.', parameters: { type: 'object', properties: { todo_reference: { type: 'string' }, project_name: { type: 'string' } }, required: ['todo_reference'], additionalProperties: false } },
      { type: 'function', name: 'propose_move_todo', description: 'Resolve and prepare moving a natural todo title or code to a project named by the user.', parameters: { type: 'object', properties: { todo_reference: { type: 'string' }, project_name: { type: 'string', description: 'Current/source project name when supplied.' }, target_project_name: { type: 'string' } }, required: ['todo_reference', 'target_project_name'], additionalProperties: false } },
      { type: 'function', name: 'confirm_todo_mutation', description: 'Execute exactly one previously proposed create, update, delete, or move after the user explicitly confirms it.', parameters: { type: 'object', properties: { proposal_token: { type: 'string' } }, required: ['proposal_token'], additionalProperties: false } },
    ],
  }

  const form = new FormData()
  form.set('sdp', sdp)
  form.set('session', JSON.stringify(session))
  const response = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Safety-Identifier': createHash('sha256').update(user.id).digest('hex'),
    },
    body: form,
  })
  const body = await response.text()
  if (!response.ok) {
    console.error('[orb-realtime] session creation failed:', response.status, body.slice(0, 500))
    return Response.json({ error: 'Could not start the Realtime voice test.' }, { status: 502 })
  }
  return new Response(body, { headers: { 'Content-Type': 'application/sdp' } })
}
