import assert from 'node:assert/strict'
import { ORB_TOOLS } from '../lib/orb-contract'
import { sanitizeGeminiSchema, toGeminiFunctionDeclarations } from '../lib/orb-model/gemini'

const canonicalSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    filters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          column: { type: 'string' },
        },
      },
    },
    additionalProperties: { type: 'string' },
    variants: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          properties: { name: { type: 'string' } },
          not: { type: 'object', additionalProperties: false },
        },
      ],
    },
  },
} as const

const sanitized = sanitizeGeminiSchema(canonicalSchema)

assert.deepEqual(sanitized, {
  type: 'object',
  properties: {
    filters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          column: { type: 'string' },
        },
      },
    },
    additionalProperties: { type: 'string' },
    variants: {
      anyOf: [
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          not: { type: 'object' },
        },
      ],
    },
  },
})

assert.equal(canonicalSchema.additionalProperties, false)
assert.equal(canonicalSchema.properties.filters.items.additionalProperties, false)

const canonicalToolsJson = JSON.stringify(ORB_TOOLS)
const geminiToolsJson = JSON.stringify(toGeminiFunctionDeclarations(ORB_TOOLS))

assert.match(canonicalToolsJson, /"additionalProperties":false/)
assert.doesNotMatch(geminiToolsJson, /"additionalProperties":/)

console.log('Gemini schema sanitizer verification passed.')
