import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { getModuleById, getNextModule } from '@/data/curriculum';

// Service role client bypasses RLS
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/quiz?moduleId=xxx
 * Returns quiz questions for a module
 */
export async function GET(request: NextRequest) {
  try {
    const moduleIdStr = request.nextUrl.searchParams.get('moduleId');
    if (!moduleIdStr) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
    }

    const moduleId = parseInt(moduleIdStr);
    const supabase = getServiceClient();

    // Try to get quiz from database first
    const { data: quiz } = await supabase
      .from('placement_quizzes')
      .select('*')
      .eq('module_id', moduleId)
      .single();

    if (quiz) {
      const module = getModuleById(moduleId);
      return NextResponse.json({
        moduleId,
        moduleTitle: module?.title || 'Unknown Module',
        questions: quiz.questions,
        passingScore: quiz.passing_score,
      });
    }

    // No quiz data — return "Coming Soon" indicator
    const module = getModuleById(moduleId);
    return NextResponse.json({
      moduleId,
      moduleTitle: module?.title || 'Unknown Module',
      questions: [],
      passingScore: 4,
      comingSoon: true,
    });
  } catch (err) {
    console.error('Quiz GET error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

/**
 * POST /api/quiz
 * Submit quiz result — if passing, skip module and advance ring
 * Body: { childId, moduleId, score }
 */
export async function POST(request: NextRequest) {
  try {
    const { childId, moduleId, score } = await request.json();

    if (!childId || !moduleId || score === undefined) {
      return NextResponse.json(
        { error: 'childId, moduleId, and score are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Get the quiz passing score
    const { data: quiz } = await supabase
      .from('placement_quizzes')
      .select('passing_score')
      .eq('module_id', moduleId)
      .single();

    const passingScore = quiz?.passing_score || 4;
    const passed = score >= passingScore;

    if (!passed) {
      return NextResponse.json({
        passed: false,
        score,
        passingScore,
        message: "Let's learn this together! You'll get it next time.",
      });
    }

    // Passed! Mark module as skipped
    const { error: progressError } = await supabase
      .from('module_progress')
      .upsert(
        {
          child_id: childId,
          module_id: moduleId,
          current_chapter: 0,
          is_completed: true,
          skipped_via_quiz: true,
          quiz_score: score,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'child_id,module_id' }
      );

    if (progressError) {
      console.error('Error saving quiz progress:', progressError);
      return NextResponse.json({ error: progressError.message }, { status: 500 });
    }

    // Find which ring has this module and advance it
    const { data: rings } = await supabase
      .from('ring_assignments')
      .select('*')
      .eq('child_id', childId)
      .eq('module_id', moduleId);

    let nextModuleId: number | null = null;
    let nextModuleTitle: string | null = null;

    const ring = rings?.[0];
    if (ring) {
      const currentModule = getModuleById(moduleId);
      if (currentModule) {
        const nextModule = getNextModule(moduleId, currentModule.subject);
        if (nextModule) {
          nextModuleId = nextModule.id;
          nextModuleTitle = nextModule.title;

          // Update the ring to point to the next module
          await supabase
            .from('ring_assignments')
            .update({
              module_id: nextModule.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', ring.id);
        }
      }
    }

    return NextResponse.json({
      passed: true,
      score,
      passingScore,
      nextModuleId,
      nextModuleTitle,
      message: nextModuleTitle
        ? `Skipped! Moving on to ${nextModuleTitle}`
        : 'Congratulations! Subject complete!',
    });
  } catch (err) {
    console.error('Quiz POST error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
