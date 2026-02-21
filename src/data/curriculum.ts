// Static curriculum catalog derived from curriculum-catalog.md
// Used as fallback when no lessons are in the database

export interface CurriculumModule {
  id: number;
  title: string;
  subject: 'math' | 'reading';
  grades: string;
  icon: string;
  duration: string;
  activities: number;
  chapters: string[];
}

export const CURRICULUM_CATALOG: CurriculumModule[] = [
  {
    id: 1,
    title: 'Number Explorers',
    subject: 'math' as const,
    grades: 'K',
    icon: '🔢',
    duration: '4 weeks',
    activities: 20,
    chapters: [
      'Counting 1-20',
      'Number Recognition',
      'One-to-One Correspondence',
      'Counting Treasure Hunt',
      'Number Matching Games',
    ],
  },
  {
    id: 2,
    title: 'Addition Adventures',
    subject: 'math' as const,
    grades: 'Grade 1',
    icon: '➕',
    duration: '6 weeks',
    activities: 25,
    chapters: [
      'Addition Facts to 10',
      'Addition Facts to 20',
      'Number Bonds',
      'Word Problems',
      'Real-World Shopping Scenarios',
    ],
  },
  {
    id: 3,
    title: 'Subtraction Safari',
    subject: 'math' as const,
    grades: 'Grade 1-2',
    icon: '➖',
    duration: '6 weeks',
    activities: 25,
    chapters: [
      'Subtraction Facts to 10',
      'Subtraction Facts to 20',
      'Comparing Numbers',
      'Fact Families',
      'Mystery Number Challenges',
    ],
  },
  {
    id: 4,
    title: 'Multiplication Masters',
    subject: 'math' as const,
    grades: 'Grade 3',
    icon: '✖️',
    duration: '8 weeks',
    activities: 30,
    chapters: [
      'Times Tables 1-6',
      'Times Tables 7-12',
      'Arrays',
      'Word Problems',
      'Real-World Multiplication',
    ],
  },
  {
    id: 5,
    title: 'Fraction Fundamentals',
    subject: 'math' as const,
    grades: 'Grade 3-4',
    icon: '🍕',
    duration: '10 weeks',
    activities: 35,
    chapters: [
      'Part-Whole Relationships',
      'Equivalent Fractions',
      'Comparing Fractions',
      'Pizza Fraction Games',
      'Fraction Number Line',
    ],
  },
  {
    id: 6,
    title: 'Decimal Discoveries',
    subject: 'math' as const,
    grades: 'Grade 4-5',
    icon: '📐',
    duration: '8 weeks',
    activities: 30,
    chapters: [
      'Understanding Decimal Place Value',
      'Comparing and Ordering Decimals',
      'Adding Decimals',
      'Subtracting Decimals',
      'Multiplying Decimals',
    ],
  },
  {
    id: 7,
    title: 'Geometry Genius',
    subject: 'math' as const,
    grades: 'Grade 4-6',
    icon: '📏',
    duration: '10 weeks',
    activities: 35,
    chapters: [
      'Shapes and Angles',
      'Area and Perimeter',
      'Volume',
      '3D Shape Explorations',
      'Shape Building Challenges',
    ],
  },
  {
    id: 16,
    title: 'Phonics Foundations',
    subject: 'reading' as const,
    grades: 'K',
    icon: '🔤',
    duration: '12 weeks',
    activities: 40,
    chapters: [
      'Letter Sounds',
      'Blending',
      'CVC Words',
      'Rhyming Challenges',
      'Word Building Games',
    ],
  },
  {
    id: 17,
    title: 'Beginning Readers',
    subject: 'reading' as const,
    grades: 'Grade 1',
    icon: '📖',
    duration: '10 weeks',
    activities: 35,
    chapters: [
      'Sight Words',
      'Simple Sentences',
      'Fluency Practice',
      'Sight Word Treasure Hunt',
      'Sentence Building',
    ],
  },
  {
    id: 18,
    title: 'Reading Comprehension Basics',
    subject: 'reading' as const,
    grades: 'Grade 1-2',
    icon: '📚',
    duration: '8 weeks',
    activities: 30,
    chapters: [
      'Main Idea',
      'Sequencing',
      'Making Predictions',
      'Story Sequencing Puzzles',
      'Main Idea Detectives',
    ],
  },
  {
    id: 19,
    title: 'Reading Detectives',
    subject: 'reading' as const,
    grades: 'Grade 3',
    icon: '🕵️',
    duration: '10 weeks',
    activities: 35,
    chapters: [
      'Text Evidence',
      'Making Inferences',
      "Author's Purpose",
      'Evidence Hunting',
      'Inference Mysteries',
    ],
  },
  {
    id: 20,
    title: 'Vocabulary Builders',
    subject: 'reading' as const,
    grades: 'Grade 3-5',
    icon: '📝',
    duration: '8 weeks',
    activities: 30,
    chapters: [
      'Context Clues',
      'Word Parts',
      'Synonyms and Antonyms',
      'Word Part Puzzles',
      'Context Clue Challenges',
    ],
  },
  {
    id: 21,
    title: 'Fiction Analysis',
    subject: 'reading' as const,
    grades: 'Grade 4-5',
    icon: '📕',
    duration: '10 weeks',
    activities: 35,
    chapters: [
      'Character Analysis',
      'Plot Structure',
      'Theme',
      'Point of View',
      'Character Trait Detectives',
    ],
  },
];

// ============================================
// GRADE MATCHING HELPERS
// ============================================

// Map grade strings to numeric values for comparison
function gradeToNumber(grade: string): number {
  const g = grade.trim().toLowerCase();
  if (g === 'k' || g === 'pre-k') return 0;
  const num = parseInt(g.replace(/[^0-9]/g, ''));
  return isNaN(num) ? 0 : num;
}

// Check if a module's grade range matches a child's grade
export function matchesGrade(moduleGrades: string, childGrade: string): boolean {
  const childNum = gradeToNumber(childGrade);

  // Handle ranges like "Grade 1-2", "Grade 3-4"
  const rangeMatch = moduleGrades.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1]);
    const high = parseInt(rangeMatch[2]);
    return childNum >= low && childNum <= high;
  }

  // Handle single grades like "K", "Grade 1", "Grade 3"
  const moduleNum = gradeToNumber(moduleGrades);
  // Allow modules at the child's level or one below (review)
  return childNum >= moduleNum && childNum <= moduleNum + 1;
}

// Get all modules matching a grade, optionally filtered by subject
export function getModulesForGrade(grade: string, subject?: string): CurriculumModule[] {
  return CURRICULUM_CATALOG.filter((m) => {
    const gradeMatch = matchesGrade(m.grades, grade);
    const subjectMatch = !subject || m.subject === subject;
    return gradeMatch && subjectMatch;
  });
}

// Get a specific module by ID
export function getModuleById(moduleId: number): CurriculumModule | undefined {
  return CURRICULUM_CATALOG.find((m) => m.id === moduleId);
}

// Get the next module in sequence for a subject
export function getNextModule(currentModuleId: number, subject: string): CurriculumModule | null {
  const subjectModules = CURRICULUM_CATALOG.filter((m) => m.subject === subject);
  const idx = subjectModules.findIndex((m) => m.id === currentModuleId);
  return idx >= 0 && idx < subjectModules.length - 1 ? subjectModules[idx + 1] : null;
}

// Auto-assign: pick the first grade-appropriate module for a subject
// Optionally exclude completed module IDs
export function getAutoAssignModule(
  grade: string,
  subject: string,
  completedModuleIds: number[] = []
): CurriculumModule | null {
  const candidates = getModulesForGrade(grade, subject).filter(
    (m) => !completedModuleIds.includes(m.id)
  );
  return candidates.length > 0 ? candidates[0] : null;
}
