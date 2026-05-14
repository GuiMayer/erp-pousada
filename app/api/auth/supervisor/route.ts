import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, DEFAULT_PASSWORD_HASHES } from '@/lib/utils/auth'

/**
 * POST /api/auth/supervisor
 * Secure supervisor authentication endpoint
 * 
 * This replaces the client-side password validation with a secure server-side check
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Verify password against hashed supervisor password
    const isValid = await verifyPassword(password, DEFAULT_PASSWORD_HASHES.supervisor)

    if (!isValid) {
      // Add a small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Return success with a token or session identifier
    // In a production system, you would generate a JWT or session token here
    return NextResponse.json(
      { 
        success: true,
        message: 'Authentication successful',
        // In production, return a secure token here
        token: 'supervisor-authenticated'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Supervisor authentication error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
