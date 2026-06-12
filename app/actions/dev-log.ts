'use server'

export async function logToTerminal(message: string) {
  console.log(`[CLIENT-DEV-LOG] ${message}`)
}
