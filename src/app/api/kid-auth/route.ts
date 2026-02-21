import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Use service role to bypass RLS for kid login lookup
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { familyCode, kidPin } = await request.json();

    if (!familyCode || !kidPin) {
      return NextResponse.json(
        { success: false, error: 'Family code and PIN are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Call the kid_login database function
    const { data, error } = await supabase.rpc('kid_login', {
      p_family_code: familyCode,
      p_kid_pin: kidPin,
    });

    if (error) {
      console.error('Kid login RPC error:', error);
      return NextResponse.json(
        { success: false, error: 'Login failed. Please try again.' },
        { status: 500 }
      );
    }

    // The function returns a JSON object
    if (!data || !data.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Invalid family code or PIN' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      child_id: data.child_id,
      child_name: data.child_name,
      avatar_emoji: data.avatar_emoji,
      parent_id: data.parent_id,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
