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

/**
 * GET /api/ring-assignments?childId=xxx
 * Returns the ring assignments for a child
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabaseClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const childId = request.nextUrl.searchParams.get('childId');
    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // Use service client to fetch (works for both parent and kid sessions)
    const supabase = getServiceClient();

    // Verify the child belongs to this parent (if authenticated)
    if (user) {
      const { data: child } = await supabase
        .from('children')
        .select('parent_id')
        .eq('id', childId)
        .single();

      if (!child || child.parent_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const { data: rings, error } = await supabase
      .from('ring_assignments')
      .select('*')
      .eq('child_id', childId)
      .order('ring_slot');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rings: rings || [] });
  } catch (err) {
    console.error('Ring assignments GET error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

/**
 * PUT /api/ring-assignments
 * Updates ring assignments for a child
 * Body: { childId, rings: [{ slot, ring_type, module_id?, subject?, custom_label?, custom_icon?, color, daily_goal_minutes }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabaseClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { childId, rings } = await request.json();

    if (!childId || !rings || !Array.isArray(rings)) {
      return NextResponse.json(
        { error: 'childId and rings array are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Verify the child belongs to this parent
    const { data: child } = await supabase
      .from('children')
      .select('parent_id')
      .eq('id', childId)
      .single();

    if (!child || child.parent_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Upsert each ring assignment
    const results = await Promise.all(
      rings.map(async (ring: {
        slot: number;
        ring_type: string;
        module_id?: number | null;
        subject?: string | null;
        custom_label?: string | null;
        custom_icon?: string | null;
        color: string;
        daily_goal_minutes: number;
      }) => {
        const { data, error } = await supabase
          .from('ring_assignments')
          .upsert(
            {
              child_id: childId,
              ring_slot: ring.slot,
              ring_type: ring.ring_type,
              module_id: ring.module_id || null,
              subject: ring.subject || null,
              custom_label: ring.custom_label || null,
              custom_icon: ring.custom_icon || null,
              color: ring.color,
              daily_goal_minutes: ring.daily_goal_minutes,
              auto_assigned: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'child_id,ring_slot' }
          )
          .select()
          .single();

        if (error) {
          console.error(`Error upserting ring slot ${ring.slot}:`, error);
          return { slot: ring.slot, error: error.message };
        }
        return { slot: ring.slot, data };
      })
    );

    const errors = results.filter((r) => 'error' in r && r.error);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Some rings failed to update', details: errors },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, rings: results.map((r) => r.data || r) });
  } catch (err) {
    console.error('Ring assignments PUT error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
