import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaignById,
  updateCampaignStatus,
  updateCampaign,
  deleteCampaign,
} from '@/lib/models/socap/campaigns';

/**
 * GET /socap/campaigns/:id
 * Get campaign details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await getCampaignById(id);
    
    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch campaign',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /socap/campaigns/:id
 * Update campaign (status, preferences, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Handle status update separately
    if (body.status) {
      const success = await updateCampaignStatus(id, body.status);
      
      if (!success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Campaign not found or update failed',
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Campaign status updated',
      });
    }
    
    // Handle other updates
    const success = await updateCampaign(id, body);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found or update failed',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Campaign updated',
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update campaign',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /socap/campaigns/:id
 * Delete campaign
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteCampaign(id);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Campaign deleted',
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete campaign',
      },
      { status: 500 }
    );
  }
}

