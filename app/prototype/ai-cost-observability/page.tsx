import { notFound } from 'next/navigation'
import AiCostObservabilityPrototype from '@/components/prototype/AiCostObservabilityPrototype'
import './prototype.css'

export default function AiCostObservabilityPrototypePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return <AiCostObservabilityPrototype />
}
