/** A legacy command must not accidentally start the whole paid corpus. */
export function diagnosticRunCount(args: string[]): number {
  if (!args.includes('--allow-paid') || !args.includes('--id')) {
    throw new Error('Paid diagnostics are opt-in: Stan must approve the issue, case IDs, and budget. Use --allow-paid --id <ids>; routine verification is npm run verify:interaction.')
  }
  const index = args.indexOf('--runs')
  const value = index === -1 ? '1' : args[index + 1]
  if (!value || !/^[1-9]\d*$/.test(value) || Number(value) > 100) throw new Error('--runs must be an explicitly approved integer from 1 to 100.')
  const ids = args[args.indexOf('--id') + 1]
  if (!ids || ids.startsWith('--')) throw new Error('--id requires an explicit case selection.')
  return Number(value)
}
