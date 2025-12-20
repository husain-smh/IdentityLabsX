/**
 * Twitter OAuth Authorization Route
 * 
 * Initiates the OAuth 2.0 flow for a client.
 * 
 * Query parameters:
 * - client_email: The email of the client who needs to authorize
 * 
 * Flow:
 * 1. Generate PKCE codes and state
 * 2. Store state temporarily
 * 3. Redirect client to Twitter authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAuthorizationUrl } from '@/lib/socap/twitter-oauth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientEmail = searchParams.get('client_email');

    if (!clientEmail) {
      return NextResponse.json(
        { success: false, error: 'client_email query parameter is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate authorization URL with PKCE
    const { url } = generateAuthorizationUrl({ clientEmail });

    // Redirect to Twitter
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('[OAuth Authorize] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Redirect to error page
    const errorUrl = process.env.TWITTER_OAUTH_ERROR_URL || '/socap/auth/error';
    return NextResponse.redirect(`${errorUrl}?error=${encodeURIComponent(errorMessage)}`);
  }
}
