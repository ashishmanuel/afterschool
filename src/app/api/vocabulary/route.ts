import { NextRequest, NextResponse } from 'next/server';

// ─── Fallback word pools (used when APIs are unavailable) ─────────────────────

interface FallbackWord {
  word: string;
  definition: string;
  sentence: string;
  emoji: string;
}

const FALLBACK_POOLS: Record<string, FallbackWord[]> = {
  easy: [
    { word: 'JOURNEY', definition: 'A long trip from one place to another.', sentence: 'The brave adventurer set off on a long journey through the mountains.', emoji: '🗺️' },
    { word: 'SUMMIT', definition: 'The very top of a mountain.', sentence: 'After hours of climbing, they finally reached the summit of the hill.', emoji: '🏔️' },
    { word: 'VANISH', definition: 'To disappear suddenly.', sentence: 'The magician made the coin vanish right before everyone\'s eyes.', emoji: '✨' },
    { word: 'ISLAND', definition: 'Land with water all around it.', sentence: 'The tiny island was surrounded by sparkling blue water.', emoji: '🏝️' },
    { word: 'TREASURE', definition: 'Very valuable things like gold or gems.', sentence: 'The pirates buried their treasure deep under the old oak tree.', emoji: '💎' },
    { word: 'SWIFT', definition: 'Moving very, very fast.', sentence: 'The swift falcon dove toward the ground to catch its meal.', emoji: '🦅' },
    { word: 'FOREST', definition: 'A large area filled with many trees.', sentence: 'The children explored the dark and mysterious forest near their village.', emoji: '🌲' },
    { word: 'BRIDGE', definition: 'Something built to go over a river or road.', sentence: 'They crossed the old wooden bridge to reach the other side of the river.', emoji: '🌉' },
    { word: 'QUEST', definition: 'A long search for something special.', sentence: 'The young hero began her quest to find the magical golden key.', emoji: '⚔️' },
    { word: 'CAVE', definition: 'A large hole in the side of a hill or underground.', sentence: 'The explorers found ancient paintings inside the dark cave.', emoji: '🦇' },
    { word: 'STREAM', definition: 'A small, narrow river.', sentence: 'They followed the babbling stream through the meadow to find their camp.', emoji: '💧' },
    { word: 'GLOW', definition: 'To give off a soft, steady light.', sentence: 'The fireflies began to glow softly as the sun went down.', emoji: '✨' },
    { word: 'HIDDEN', definition: 'Kept out of sight.', sentence: 'A hidden door behind the bookcase led to a secret room.', emoji: '🚪' },
    { word: 'MAP', definition: 'A drawing that shows where places are.', sentence: 'She unfolded the old map to find the path to the waterfall.', emoji: '🗺️' },
    { word: 'BRAVE', definition: 'Being ready to face something scary.', sentence: 'The brave little mouse stood up to the much bigger cat.', emoji: '🦁' },
  ],
  medium: [
    { word: 'ANCIENT', definition: 'Something from a very, very long time ago.', sentence: 'The ancient temple had stood for thousands of years in the jungle.', emoji: '🏛️' },
    { word: 'LUMINOUS', definition: 'Shining brightly in the dark.', sentence: 'The luminous jellyfish looked like floating lanterns in the deep sea.', emoji: '🪼' },
    { word: 'VENTURE', definition: 'To go somewhere new or a bit dangerous.', sentence: 'They decided to venture into the unknown forest beyond the village.', emoji: '🧭' },
    { word: 'NAVIGATE', definition: 'Finding the right way to travel somewhere.', sentence: 'The captain used the stars to navigate across the wide ocean.', emoji: '⭐' },
    { word: 'TERRAIN', definition: 'The type of land, like rocky, sandy, or muddy ground.', sentence: 'The rocky terrain made the hike much harder than expected.', emoji: '🪨' },
    { word: 'COURAGE', definition: 'The strength to do something difficult or scary.', sentence: 'It took a lot of courage to speak in front of the whole school.', emoji: '🦁' },
    { word: 'DISCOVER', definition: 'To find something for the very first time.', sentence: 'The children were thrilled to discover a nest of baby robins in the garden.', emoji: '🔍' },
    { word: 'HORIZON', definition: 'The line where the earth meets the sky in the distance.', sentence: 'They watched the sun slowly sink below the horizon at the beach.', emoji: '🌅' },
    { word: 'FRAGILE', definition: 'Something that is easily broken or damaged.', sentence: 'The fragile glass ornament shattered when it fell off the shelf.', emoji: '🏺' },
    { word: 'OBSERVE', definition: 'To watch something very carefully and closely.', sentence: 'The scientist used a magnifying glass to observe the tiny insects.', emoji: '🔬' },
    { word: 'SHELTER', definition: 'A place that keeps you safe from the weather.', sentence: 'The hikers quickly built a shelter to stay dry during the rainstorm.', emoji: '⛺' },
    { word: 'THRIVE', definition: 'To grow strong and healthy over time.', sentence: 'With plenty of sunlight and water, the plants began to thrive in the garden.', emoji: '🌱' },
    { word: 'REMOTE', definition: 'A place far away from other people or cities.', sentence: 'The remote cabin in the mountains had no electricity or running water.', emoji: '🏚️' },
    { word: 'VIBRANT', definition: 'Full of energy and very bright colors.', sentence: 'The vibrant market was filled with colorful stalls and lively music.', emoji: '🎨' },
    { word: 'ENDURE', definition: 'To keep going even when things are very hard.', sentence: 'The team had to endure three days of rain before reaching the summit.', emoji: '💪' },
    { word: 'WILDERNESS', definition: 'A wild place where no people live, full of nature.', sentence: 'The wilderness stretched for hundreds of miles without a single road.', emoji: '🌿' },
    { word: 'CURIOUS', definition: 'Wanting to learn about or know more about something.', sentence: 'The curious puppy sniffed every corner of the new backyard.', emoji: '🐾' },
  ],
  hard: [
    { word: 'PRECARIOUS', definition: 'Not safe; likely to fall or collapse at any moment.', sentence: 'The hiker stood in a precarious position on the edge of the crumbly cliff.', emoji: '🪨' },
    { word: 'RESILIENT', definition: 'Able to bounce back quickly after a tough time.', sentence: 'The resilient little flower grew right through the crack in the cold pavement.', emoji: '🌸' },
    { word: 'TREACHEROUS', definition: 'Very dangerous, usually because of ice, mud, or hidden traps.', sentence: 'The icy mountain path became treacherous as the sun began to set.', emoji: '⚠️' },
    { word: 'LABYRINTH', definition: 'A complicated maze that is very hard to exit.', sentence: 'The explorer got lost for hours inside the stone labyrinth beneath the castle.', emoji: '🌀' },
    { word: 'EXPEDITION', definition: 'A journey made for a specific and important purpose, like science.', sentence: 'The scientists began their underwater expedition to find the sunken ship.', emoji: '🚢' },
    { word: 'FORAGE', definition: 'To search widely for food or useful supplies.', sentence: 'The bear began to forage for berries along the riverbank every morning.', emoji: '🐻' },
    { word: 'SOLITUDE', definition: 'The peaceful state of being completely alone.', sentence: 'The explorer cherished the solitude of the mountain peak at dawn.', emoji: '🧘' },
    { word: 'UNCHARTED', definition: 'A place that has never been explored or put on any map.', sentence: 'The sailors steered their boat into uncharted waters, hoping to find a new island.', emoji: '🗺️' },
    { word: 'SPECTACULAR', definition: 'Something so beautiful or impressive it takes your breath away.', sentence: 'The view from the top of the waterfall was absolutely spectacular.', emoji: '🌊' },
    { word: 'VIGILANT', definition: 'Keeping a very careful watch for any sign of danger.', sentence: 'The owl remained vigilant, scanning the dark forest for any movement.', emoji: '🦉' },
    { word: 'PERILOUS', definition: 'Full of great danger or serious risk.', sentence: 'The mountain climbers faced a perilous crossing over the icy ridge.', emoji: '🏔️' },
    { word: 'OBSCURE', definition: 'Hard to see, find, or understand because it is hidden away.', sentence: 'The treasure was hidden in an obscure corner of the ancient ruins.', emoji: '🔍' },
    { word: 'FORMIDABLE', definition: 'Something that inspires awe or fear because it is so powerful.', sentence: 'The giant snow-covered peak was a formidable challenge for the climbers.', emoji: '❄️' },
    { word: 'PIONEER', definition: 'The very first person to explore or settle in a new place.', sentence: 'The pioneer carved a new path through the dense jungle for others to follow.', emoji: '🪓' },
    { word: 'DECIPHER', definition: 'To figure out a secret code or very difficult writing.', sentence: 'It took the team days to decipher the symbols carved into the cave wall.', emoji: '🔑' },
    { word: 'ENDURANCE', definition: 'The power to last through a long and difficult struggle.', sentence: 'Crossing the desert required incredible endurance from every member of the team.', emoji: '💪' },
    { word: 'VAST', definition: 'Extremely large or wide, almost impossible to measure.', sentence: 'The vast ocean seemed to stretch on forever in every direction.', emoji: '🌊' },
    { word: 'PIONEER', definition: 'The very first person to explore or settle in a new area.', sentence: 'She was a true pioneer, discovering the hidden valley no one had seen before.', emoji: '🌟' },
  ],
};

// ─── Emoji keyword map ────────────────────────────────────────────────────────

const EMOJI_MAP: [string[], string][] = [
  [['ocean', 'sea', 'water', 'fish', 'wave', 'swim'], '🌊'],
  [['mountain', 'hill', 'summit', 'peak', 'climb'], '🏔️'],
  [['forest', 'tree', 'wood', 'jungle', 'leaf'], '🌲'],
  [['star', 'space', 'sky', 'moon', 'sun', 'light', 'glow', 'luminous'], '⭐'],
  [['fire', 'flame', 'burn', 'hot'], '🔥'],
  [['animal', 'bird', 'beast', 'creature', 'wildlife'], '🦁'],
  [['treasure', 'gold', 'gem', 'jewel', 'riches'], '💎'],
  [['map', 'path', 'route', 'direction', 'navigate'], '🗺️'],
  [['brave', 'courage', 'hero', 'bold'], '🦸'],
  [['ancient', 'old', 'history', 'ruin', 'temple'], '🏛️'],
  [['danger', 'risk', 'peril', 'treacherous', 'precarious'], '⚠️'],
  [['plant', 'flower', 'grow', 'nature', 'garden'], '🌸'],
  [['cave', 'dark', 'underground', 'tunnel'], '🦇'],
  [['journey', 'travel', 'trip', 'adventure', 'expedition'], '🧭'],
  [['maze', 'labyrinth', 'puzzle', 'mystery'], '🌀'],
  [['rain', 'storm', 'weather', 'snow', 'ice'], '⛈️'],
];

function getEmoji(word: string, definition: string): string {
  const text = (word + ' ' + definition).toLowerCase();
  for (const [keywords, emoji] of EMOJI_MAP) {
    if (keywords.some((kw) => text.includes(kw))) return emoji;
  }
  return '📚';
}

// ─── Shuffle helper ───────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ─── Build blank sentence ─────────────────────────────────────────────────────

function makeBlankSentence(sentence: string, word: string): string {
  return sentence.replace(new RegExp(word, 'gi'), '________');
}

// ─── Datamuse frequency thresholds ───────────────────────────────────────────

const FREQ_THRESHOLDS: Record<string, { min: number; max: number }> = {
  easy:   { min: 15, max: 9999 },
  medium: { min: 4,  max: 15   },
  hard:   { min: 0,  max: 4    },
};

// ─── Main API handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = (searchParams.get('level') || 'medium') as 'easy' | 'medium' | 'hard';

  try {
    const words = await fetchWordsFromAPI(level);
    return NextResponse.json({ words, source: 'api' });
  } catch (err) {
    console.error('Vocabulary API error, using fallback:', err);
    // Fallback: shuffle the pool and return 10
    const pool = FALLBACK_POOLS[level] || FALLBACK_POOLS.medium;
    const selected = shuffle(pool).slice(0, 10).map((w) => ({
      word: w.word,
      definition: w.definition,
      sentence: w.sentence,
      blankSentence: makeBlankSentence(w.sentence, w.word),
      emoji: w.emoji,
    }));
    return NextResponse.json({ words: selected, source: 'fallback' });
  }
}

async function fetchWordsFromAPI(level: 'easy' | 'medium' | 'hard') {
  const { min, max } = FREQ_THRESHOLDS[level];

  // Step 1: Fetch candidate words from Datamuse
  // Topics: adventure + nature = engaging for kids; md=f = frequency metadata
  const topics = level === 'easy'
    ? 'adventure,animals,nature,home'
    : level === 'medium'
    ? 'adventure,nature,science,exploration'
    : 'exploration,science,geography,survival';

  const datamuseUrl =
    `https://api.datamuse.com/words?topics=${encodeURIComponent(topics)}&max=80&md=f`;

  const datamuseRes = await fetch(datamuseUrl, { next: { revalidate: 0 } });
  if (!datamuseRes.ok) throw new Error('Datamuse fetch failed');

  const datamuseWords: { word: string; tags?: string[]; score?: number }[] =
    await datamuseRes.json();

  // Step 2: Filter by frequency and word characteristics
  const candidates = datamuseWords
    .filter((w) => {
      // Get frequency tag value (format: "f:12.34")
      const freqTag = w.tags?.find((t) => t.startsWith('f:'));
      const freq = freqTag ? parseFloat(freqTag.slice(2)) : 0;

      // Only include words in the right frequency band
      if (freq < min || freq > max) return false;

      // Only alphabetic words, 3–14 chars
      if (!/^[a-z]+$/.test(w.word)) return false;
      if (w.word.length < 3 || w.word.length > 14) return false;

      return true;
    })
    .map((w) => w.word);

  if (candidates.length < 10) throw new Error('Not enough candidates from Datamuse');

  // Step 3: Shuffle candidates and look up definitions
  const shuffled = shuffle(candidates);
  const results: {
    word: string;
    definition: string;
    sentence: string;
    blankSentence: string;
    emoji: string;
  }[] = [];

  // Try up to 30 candidates to find 10 with good definitions + sentences
  for (const candidate of shuffled.slice(0, 30)) {
    if (results.length >= 10) break;

    try {
      const dictRes = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(candidate)}`,
        { next: { revalidate: 3600 } }
      );
      if (!dictRes.ok) continue;

      const dictData = await dictRes.json();
      if (!Array.isArray(dictData) || dictData.length === 0) continue;

      const entry = dictData[0];
      const meanings = entry.meanings || [];

      // Find first meaning with a definition
      let definition = '';
      let exampleSentence = '';

      for (const meaning of meanings) {
        for (const def of meaning.definitions || []) {
          if (!definition && def.definition) {
            definition = def.definition;
          }
          if (!exampleSentence && def.example) {
            exampleSentence = def.example;
          }
          if (definition && exampleSentence) break;
        }
        if (definition && exampleSentence) break;
      }

      if (!definition || !exampleSentence) continue;

      // Check the sentence actually contains the word (for blanking)
      const wordRegex = new RegExp(candidate, 'i');
      if (!wordRegex.test(exampleSentence)) continue;

      const upperWord = candidate.toUpperCase();
      const blankSentence = makeBlankSentence(exampleSentence, candidate);

      results.push({
        word: upperWord,
        definition,
        sentence: exampleSentence,
        blankSentence,
        emoji: getEmoji(candidate, definition),
      });
    } catch {
      // Skip this word if dictionary lookup fails
      continue;
    }
  }

  if (results.length < 5) {
    // Not enough API results — use fallback pool to top up
    const pool = FALLBACK_POOLS[level] || FALLBACK_POOLS.medium;
    const fallbackWords = shuffle(pool)
      .slice(0, 10 - results.length)
      .map((w) => ({
        word: w.word,
        definition: w.definition,
        sentence: w.sentence,
        blankSentence: makeBlankSentence(w.sentence, w.word),
        emoji: w.emoji,
      }));
    results.push(...fallbackWords);
  }

  return results.slice(0, 10);
}
