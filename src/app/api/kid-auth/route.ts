import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Service role client bypasses RLS — same pattern as all other API routes
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

    // Step 1: Find parent by family code (direct query, no RPC needed)
    const { data: parent, error: parentError } = await supabase
      .from('profiles')
      .select('id')
      .eq('family_code', familyCode)
      .eq('role', 'parent')
      .single();

    if (parentError || !parent) {
      return NextResponse.json(
        { success: false, error: 'Invalid family code' },
        { status: 401 }
      );
    }

    // Step 2: Find child by parent_id + PIN
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, name, avatar_emoji')
      .eq('parent_id', parent.id)
      .eq('kid_pin', kidPin)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Invalid PIN. Ask your parent for help!' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      child_id: child.id,
      child_name: child.name,
      avatar_emoji: child.avatar_emoji,
      parent_id: parent.id,
    });
  } catch (err) {
    console.error('Kid auth error:', err);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
