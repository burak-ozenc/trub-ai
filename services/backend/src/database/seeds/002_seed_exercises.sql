-- Seed exercises table (trumpet practice exercises)

-- Optional but recommended: ensure title is unique so ON CONFLICT works.
-- If you already have it, this will do nothing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ux_exercises_title'
  ) THEN
CREATE UNIQUE INDEX ux_exercises_title ON exercises (title);
END IF;
END $$;

INSERT INTO exercises (
    title,
    description,
    technique,
    difficulty,
    instructions,
    duration_minutes,
    sheet_music_url,
    is_active,
    order_index,
    created_at
)
VALUES
    (
        'Basic Breath Control',
        'Learn to take deep, consistent breaths',
        'breathing',
        'beginner',
        '1. Stand or sit with good posture
      2. Breathe in through your nose for 4 counts
      3. Hold for 2 counts
      4. Breathe out through your mouth for 6 counts
      5. Repeat 10 times
      6. Now try with the trumpet - play a long tone on middle C
      7. Focus on steady, controlled air flow',
        5,
        NULL,
        true,
        1,
        NOW()
    ),
    (
        'Breath Support Exercise',
        'Develop strong breath support from the diaphragm',
        'breathing',
        'intermediate',
        '1. Place your hand on your stomach
      2. Breathe deeply - your hand should move out
      3. Play a crescendo on a single note (start soft, get loud)
      4. Focus on pushing air from your diaphragm
      5. Do this on: G, C, E, G (low to high)
      6. Each note for 8 counts',
        10,
        NULL,
        true,
        2,
        NOW()
    ),
    (
        'Long Tones - Foundation',
        'Build a beautiful, consistent tone',
        'tone',
        'beginner',
        '1. Play middle C
      2. Hold the note for 10 seconds
      3. Focus on: steady pitch, consistent volume, clear tone
      4. Repeat on: D, E, F, G
      5. Rest between each note
      6. Listen carefully to your tone quality',
        8,
        NULL,
        true,
        3,
        NOW()
    ),
    (
        'Tone Quality Development',
        'Refine your tone with varied dynamics',
        'tone',
        'intermediate',
        '1. Play G (middle of staff)
      2. Start soft (p), crescendo to loud (f), decrescendo back to soft
      3. Keep pitch and tone quality consistent throughout
      4. Repeat on: F, E, D, C
      5. Focus on not letting tone get harsh when loud
      6. Don''t let tone get breathy when soft',
        12,
        NULL,
        true,
        4,
        NOW()
    ),
    (
        'Steady Beat Foundation',
        'Develop rock-solid rhythm',
        'rhythm',
        'beginner',
        '1. Set metronome to 80 BPM
      2. Clap quarter notes with the metronome for 16 beats
      3. Now play quarter notes on middle C
      4. Focus on hitting exactly with the click
      5. Try half notes (2 beats each)
      6. Try whole notes (4 beats each)
      7. Keep the beat steady and consistent',
        10,
        NULL,
        true,
        5,
        NOW()
    )
    ON CONFLICT (title) DO UPDATE SET
    description = EXCLUDED.description,
                               technique = EXCLUDED.technique,
                               difficulty = EXCLUDED.difficulty,
                               instructions = EXCLUDED.instructions,
                               duration_minutes = EXCLUDED.duration_minutes,
                               sheet_music_url = EXCLUDED.sheet_music_url,
                               is_active = EXCLUDED.is_active,
                               order_index = EXCLUDED.order_index;
