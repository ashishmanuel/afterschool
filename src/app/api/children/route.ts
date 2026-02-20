import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// Service role client bypasses RLS
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const supabaseAuth = await createServerSupabaseClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { name, age, grade, avatar_emoji, kid_pin } = await request.json();

    if (!name || !age || !grade) {
      return NextResponse.json(
        { error: 'Name, age, and grade are required' },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('children')
      .insert({
        parent_id: user.id,
        name,
        age: parseInt(age),
        grade,
        avatar_emoji: avatar_emoji || '🧒',
        kid_pin: kid_pin || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating child:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, child: data });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
