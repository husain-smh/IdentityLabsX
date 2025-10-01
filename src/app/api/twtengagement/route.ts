import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweetUrl } = body;

    // Validate tweet URL
    if (!tweetUrl || typeof tweetUrl !== 'string') {
      return NextResponse.json(
        { error: 'Tweet URL is required' },
        { status: 400 }
      );
    }

    // Basic Twitter URL validation
    const twitterUrlPattern = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
    if (!twitterUrlPattern.test(tweetUrl)) {
      return NextResponse.json(
        { error: 'Please provide a valid Twitter/X tweet URL' },
        { status: 400 }
      );
    }

    // Send to your N8N webhook for engagement analysis
    const webhookUrl = 'https://yuvaanjoshua.app.n8n.cloud/webhook-test/analyzeTwtEngagement';
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // N8N workflow expects tweetUrl nested under 'body' property
      body: JSON.stringify({ 
        body: { tweetUrl }
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook responded with status: ${webhookResponse.status}`);
    }

    const webhookData = await webhookResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Tweet engagement analysis completed successfully',
      data: webhookData,
    });

  } catch (error) {
    console.error('Error analyzing tweet engagement:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze tweet engagement',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
