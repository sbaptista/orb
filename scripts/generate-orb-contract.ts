import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

const SPEC_PATH = path.join(process.cwd(), 'docs/api-spec.yaml')
const OUT_PATH = path.join(process.cwd(), 'lib/orb-contract.ts')

function resolveRef(ref: string, spec: any) {
    if (!ref.startsWith('#/')) throw new Error(`Only local refs supported: ${ref}`)
    const parts = ref.replace('#/', '').split('/')
    let current = spec
    for (const part of parts) {
        current = current[part]
        if (!current) throw new Error(`Could not resolve ref: ${ref}`)
    }
    return current
}

function processSchema(schema: any, spec: any): any {
    if (schema.$ref) {
        return processSchema(resolveRef(schema.$ref, spec), spec)
    }
    
    if (schema.type === 'object' && schema.properties) {
        const props: any = {}
        for (const [key, val] of Object.entries(schema.properties)) {
            props[key] = processSchema(val, spec)
        }
        return { ...schema, properties: props }
    }
    
    if (schema.type === 'array' && schema.items) {
        return { ...schema, items: processSchema(schema.items, spec) }
    }
    
    if (schema.oneOf) {
        const arraySchema = schema.oneOf.find((s: any) => s.type === 'array')
        if (arraySchema) return processSchema(arraySchema, spec)
        return processSchema(schema.oneOf[0], spec)
    }
    
    const { nullable, format, ...rest } = schema
    return rest
}

function generate() {
    const file = fs.readFileSync(SPEC_PATH, 'utf8')
    const spec = yaml.parse(file)
    
    const tools: any[] = []
    
    // 1. Process REST-mapped tools
    for (const [pathUrl, methods] of Object.entries(spec.paths || {})) {
        for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
            if (operation['x-orb-tool']) {
                const orbTool = operation['x-orb-tool']
                const description = orbTool.confidence 
                    ? `[Confidence: ${orbTool.confidence}] ${orbTool.description.trim()}`
                    : orbTool.description.trim()
                    
                const toolSchema: any = {
                    name: orbTool.name,
                    description: description,
                    input_schema: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                }
                
                if (orbTool.parameters) {
                    for (const p of orbTool.parameters) {
                        toolSchema.input_schema.properties[p.name] = {
                            type: p.schema?.type || 'string',
                            description: p.description
                        }
                        if (p.required) {
                            toolSchema.input_schema.required.push(p.name)
                        }
                    }
                }
                
                if (operation.requestBody?.content?.['application/json']?.schema) {
                    const bodySchema = processSchema(operation.requestBody.content['application/json'].schema, spec)
                    
                    if (bodySchema.properties) {
                        for (const [key, prop] of Object.entries(bodySchema.properties)) {
                            let targetKey = key
                            const finalProp: any = Object.assign({}, prop)
                            
                            if (orbTool.parameter_overrides?.[key]) {
                                const override = orbTool.parameter_overrides[key]
                                if (override.name) targetKey = override.name
                                if (override.description) finalProp.description = override.description
                            }
                            
                            toolSchema.input_schema.properties[targetKey] = finalProp
                        }
                    }
                    
                    if (bodySchema.required) {
                        for (const req of bodySchema.required) {
                            const override = orbTool.parameter_overrides?.[req]
                            const targetKey = override?.name || req
                            toolSchema.input_schema.required.push(targetKey)
                        }
                    }
                }
                
                if (toolSchema.input_schema.required.length === 0) {
                    delete toolSchema.input_schema.required
                }
                
                tools.push(toolSchema)
            }
        }
    }
    
    // 2. Process internal tools
    if (spec.info?.['x-orb-internal-tools']) {
        for (const [name, def] of Object.entries(spec.info['x-orb-internal-tools'] as Record<string, any>)) {
            const description = def.confidence
                ? `[Confidence: ${def.confidence}] ${def.description.trim()}`
                : def.description.trim()
                
            tools.push({
                name,
                description: description,
                input_schema: def.input_schema
            })
        }
    }
    
    const out = `import Anthropic from '@anthropic-ai/sdk'

// ──────────────────────────────────────────────────────────────────────────
// THIS FILE IS AUTO-GENERATED BY scripts/generate-orb-contract.ts
// DO NOT EDIT BY HAND! Edit docs/api-spec.yaml instead.
// ──────────────────────────────────────────────────────────────────────────

export const ORB_TOOLS: Anthropic.Tool[] = ${JSON.stringify(tools, null, 2)}

export const ORB_TOOL_LABELS: Record<string, string> = {
  create_todo: 'Creating task...',
  query_todos: 'Searching backlog...',
  query_projects: 'Checking projects...',
  update_todo: 'Updating task...',
  delete_todo: 'Deleting task...',
  move_todo: 'Moving task...',
  client_action: 'Navigating...',
  search_knowledge: 'Searching knowledge repository...',
  add_knowledge: 'Saving to knowledge repository...',
  update_knowledge: 'Updating knowledge entry...',
  query_audit_trail: 'Checking history...',
  create_project: 'Creating project...',
  update_project: 'Updating project...',
  delete_project: 'Deleting project...',
  confirm_mutation: 'Confirming...',
  set_dormancy: 'Updating project...',
  create_ticket: 'Noting observation...',
  query_db: 'Querying database...',
  query_repository: 'Inspecting source...',
  get_preferences: 'Loading preferences...',
  set_preference: 'Saving preference...',
  query_capabilities: 'Checking capabilities...',
  send_to_developer: 'Sending to developer...',
  save_memory: 'Remembering...',
  recall_memories: 'Recalling...',
  propose_adaptation: 'Proposing adaptation...',
}
`
    
    fs.writeFileSync(OUT_PATH, out)
    console.log(`Generated ${tools.length} tools to ${OUT_PATH}`)
}

generate()
