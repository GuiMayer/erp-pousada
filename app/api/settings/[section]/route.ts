import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/server/auth'
import { handleRoute } from '@/lib/server/http'
import { prisma } from '@/lib/db/client'
import { readSettings } from '@/lib/server/settings'
export async function GET(request: NextRequest, context: { params: Promise<{ section: string }> }) {
  return handleRoute(async () => NextResponse.json(await readSettings(prisma, await authorize(request), (await context.params).section), { headers: { 'Cache-Control': 'no-store' } }), request)
}
