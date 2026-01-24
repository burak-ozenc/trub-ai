# MIDI Playback Debugging Guide

## Changes Made

### 1. Fixed MIDI Playback Issues
- **Transport Reset**: MIDI now properly resets Transport to 0 when loading
- **Part Scheduling**: Part is scheduled once during MIDI load (not on every play)
- **Play Logic**: Simplified - just starts Transport (part already scheduled)
- **Time Tracking**: Added tolerance to prevent premature ending
- **Volume**: Increased synth volume to -6dB for better audibility

### 2. Disabled Auto-Redirect
- Session completion no longer automatically redirects to /songs
- User can stay on the play-along page after finishing

### 3. Enhanced Debugging
- Added detailed console logs for MIDI loading
- Log first 3 notes to verify data
- Log first 5 note triggers to verify playback
- Log AudioContext and Transport states when playing

## Testing Steps

1. **Open Browser Console** (F12)
2. **Navigate to Play-Along Page**
3. **Select a Song and Difficulty**
4. **Watch for these logs**:

### Expected Console Output

```
📥 Loading MIDI: songId=1, difficulty=beginner
✅ MIDI loaded: { duration: X, tracks: Y, tempo: Z }
🎺 Synthesizer created and connected to destination
📝 Track 0: N notes
🎼 Total notes to schedule: N
📋 First 3 notes: [...]
✅ MIDI playback ready { duration: X, tempo: Y, noteCount: N }
```

5. **Click Play Button**:

```
▶️ Starting MIDI playback... { duration: X, currentPosition: 0, transportState: 'stopped' }
🎵 AudioContext state: running
🎵 Tone.Transport state: stopped
▶️ MIDI playback started
🎵 Triggering note 0: { note: 'F4', duration: 0.5, time: ..., velocity: 0.8 }
🎵 Triggering note 1: { note: 'G4', duration: 0.5, time: ..., velocity: 0.8 }
... (up to 5 notes)
```

## Debugging Checklist

If you still don't hear sound:

### ✅ Check 1: MIDI Loaded
- Look for "✅ MIDI playback ready" with valid duration
- Verify "Total notes to schedule" > 0
- Check "First 3 notes" shows actual note data

### ✅ Check 2: Notes Triggering
- Look for "🎵 Triggering note" logs (should see 5 of them)
- If missing, notes aren't being scheduled correctly

### ✅ Check 3: AudioContext Running
- "🎵 AudioContext state: running"
- If "suspended", click anywhere on page to activate

### ✅ Check 4: Transport Running
- After play, should see Transport.state changing to 'started'
- If stuck at 'stopped', transport isn't starting

### ✅ Check 5: Browser Audio
- Check browser volume is not muted
- Check system volume is up
- Try playing a YouTube video to verify audio works

### ✅ Check 6: Duration Issue
- If "🏁 MIDI reached end" appears immediately
- Check the duration value - should be > 0
- If duration is 0 or very small, MIDI file parsing failed

## Common Issues & Solutions

### Issue: "MIDI reached end" immediately
**Cause**: Duration is 0 or invalid
**Solution**: Check MIDI file is valid, re-fetch if needed

### Issue: No "Triggering note" logs
**Cause**: Part not scheduled or Transport not advancing
**Solution**: Verify Transport.start() is called and state becomes 'started'

### Issue: AudioContext suspended
**Cause**: Browser autoplay policy
**Solution**: User must interact with page first (already handled by play button)

### Issue: Notes trigger but no sound
**Cause**: Synth not connected or volume too low
**Solution**:
- Check synth.toDestination() is called
- Try uncommenting test tone in code (line 106-111 in useMidiPlayer.ts)

## Manual Test Tone (if needed)

Uncomment lines 106-111 in `useMidiPlayer.ts`:
```typescript
setTimeout(() => {
  if (synthRef.current) {
    synthRef.current.triggerAttackRelease('C4', '8n');
    console.log('🔊 Test tone played');
  }
}, 500);
```

This will play a test "beep" 500ms after loading. If you hear this, the synth works!

## Next Steps

If MIDI still doesn't work after these fixes:
1. Share the full console log output
2. Check browser developer tools Network tab for failed MIDI requests
3. Verify the MIDI file path is correct
4. Try a different browser (Chrome vs Firefox)
