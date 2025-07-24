# Feature: Manual Translation Control

## Overview
Add an alternative translation flow where teachers can manually control when translations are sent to students, instead of the current automatic real-time translation system.

## Current Flow Analysis

### Existing Real-Time Flow
1. Teacher clicks "Start Recording"
2. Audio is captured continuously
3. Translation happens automatically after voice activity detection
4. Students receive translations immediately with small delay
5. Process repeats seamlessly

### Pain Points with Current Flow
- Teachers have no control over what gets translated
- Background noise or unintended speech gets translated
- No ability to review before sending
- Difficult to pause for explanations without triggering translations
- Students might receive partial or incorrect translations

## Proposed Feature: Manual Send Mode

### Core Concept
- **Feature Flag Driven**: Toggle between "Auto Mode" (current) and "Manual Mode" (new)
- **Teacher Control**: Teachers record, review, then explicitly send translations
- **Sequential Delivery**: Students receive translations in the order teachers send them
- **Quality Control**: Teachers can re-record or skip poor audio segments

## UI/UX Design Analysis

### Teacher Interface Changes

#### 1. Mode Toggle
```
┌─────────────────────────────────────┐
│ Translation Mode                    │
│ ○ Auto (Real-time)  ● Manual Send  │
└─────────────────────────────────────┘
```

#### 2. Manual Mode Controls
```
┌─────────────────────────────────────┐
│ [🎤 Start Recording]                │
│                                     │
│ ┌─ Recording Status ─────────────┐  │
│ │ ● Recording... 00:05           │  │
│ │ [⏹️ Stop] [⏸️ Pause]            │  │
│ └───────────────────────────────────┘  │
│                                     │
│ ┌─ Recorded Segments ────────────┐  │
│ │ 1. "Guten Morgen Klasse" 00:03 │  │
│ │    [▶️ Play] [🗑️ Delete] [📤 Send] │  │
│ │                                │  │
│ │ 2. "Heute lernen wir..." 00:07 │  │
│ │    [▶️ Play] [🗑️ Delete] [📤 Send] │  │
│ └───────────────────────────────────┘  │
│                                     │
│ [📤 Send All] [🗑️ Clear All]        │
└─────────────────────────────────────┘
```

#### 3. Send Queue Status
```
┌─ Translation Queue ──────────────┐
│ Pending: 2 segments              │
│ Sent: 5 segments                 │
│ [📋 View History]                │
└─────────────────────────────────────┘
```

### Student Interface Changes

#### Current Student View
- Receives translations immediately
- No indication of teacher's recording state

#### Enhanced Student View (Manual Mode)
```
┌─────────────────────────────────────┐
│ 🔴 Teacher is recording...          │
│ ⏳ Waiting for teacher to send...   │
│                                     │
│ ┌─ Translation History ─────────┐   │
│ │ 1. "Good morning class"       │   │
│ │    [🔊 Play Audio]             │   │
│ │                               │   │
│ │ 2. "Today we will learn..."   │   │
│ │    [🔊 Play Audio]             │   │
│ └───────────────────────────────────┘   │
│                                     │
│ Next translation arriving...        │
└─────────────────────────────────────┘
```

## Technical Implementation Analysis

### 1. Feature Flag System

#### Environment Configuration
```typescript
// .env
FEATURE_MANUAL_TRANSLATION_CONTROL=true

// config/features.ts
export const FEATURES = {
  MANUAL_TRANSLATION_CONTROL: process.env.FEATURE_MANUAL_TRANSLATION_CONTROL === 'true'
};
```

#### Runtime Toggle
```typescript
// Teacher session state
interface TeacherSession {
  sessionId: string;
  translationMode: 'auto' | 'manual';
  recordedSegments: AudioSegment[];
  sendQueue: PendingTranslation[];
}
```

### 2. Audio Segment Management

#### New Data Structures
```typescript
interface AudioSegment {
  id: string;
  audioData: ArrayBuffer;
  duration: number;
  timestamp: Date;
  status: 'recorded' | 'queued' | 'sent' | 'failed';
  transcription?: string;
  translation?: Translation;
}

interface PendingTranslation {
  segmentId: string;
  teacherSessionId: string;
  sequenceNumber: number;
  priority: 'normal' | 'high';
}
```

### 3. WebSocket Protocol Extensions

#### New Message Types
```typescript
// Teacher → Server
interface ManualModeMessage {
  type: 'set_translation_mode';
  mode: 'auto' | 'manual';
}

interface SendSegmentMessage {
  type: 'send_audio_segment';
  segmentId: string;
  targetLanguages: string[];
}

interface SendAllSegmentsMessage {
  type: 'send_all_segments';
  targetLanguages: string[];
}

// Server → Students
interface TranslationQueuedMessage {
  type: 'translation_queued';
  sequenceNumber: number;
  estimatedDelay: number;
}

interface TranslationSequenceMessage {
  type: 'translation_delivered';
  sequenceNumber: number;
  translation: Translation;
  isLastInSequence: boolean;
}
```

### 4. Backend Service Changes

#### Translation Queue Service
```typescript
class TranslationQueueService {
  private queues: Map<string, AudioSegment[]> = new Map();
  
  async queueSegment(sessionId: string, segment: AudioSegment): Promise<void> {
    // Add to teacher's queue
  }
  
  async processQueue(sessionId: string, segmentIds: string[]): Promise<void> {
    // Process segments in order
    // Send to translation service
    // Deliver to students sequentially
  }
  
  async getQueueStatus(sessionId: string): Promise<QueueStatus> {
    // Return queue statistics
  }
}
```

#### Audio Storage Service
```typescript
class AudioSegmentStorage {
  async storeSegment(segment: AudioSegment): Promise<string> {
    // Store audio temporarily for manual mode
  }
  
  async retrieveSegment(segmentId: string): Promise<AudioSegment> {
    // Retrieve for processing/replay
  }
  
  async cleanupExpiredSegments(): Promise<void> {
    // Clean up old segments (24hr retention)
  }
}
```

### 5. Database Schema Extensions

#### New Tables
```sql
-- Audio segments for manual mode
CREATE TABLE audio_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    teacher_id INTEGER NOT NULL,
    audio_data BYTEA NOT NULL,
    duration_ms INTEGER NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'recorded',
    sequence_number INTEGER,
    transcription TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Translation queue tracking
CREATE TABLE translation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    segment_id UUID REFERENCES audio_segments(id),
    sequence_number INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    sent_at TIMESTAMP
);
```

## User Experience Flow

### Teacher Workflow (Manual Mode)

1. **Setup**
   - Toggle to "Manual Mode"
   - System shows recording controls and segment queue

2. **Recording**
   - Click "Start Recording"
   - Speak naturally (can pause, continue)
   - Click "Stop Recording" to create segment

3. **Review & Send**
   - Preview recorded segment
   - Optionally play back audio
   - Click "Send" for individual segment or "Send All"

4. **Queue Management**
   - View pending segments
   - Delete poor recordings
   - Monitor send status

### Student Experience (Manual Mode)

1. **Waiting State**
   - See "Teacher is recording..." indicator
   - View previous translations in history

2. **Receiving Translations**
   - Get notification: "New translation incoming..."
   - Receive translation with sequence number
   - Audio and text delivered together

3. **History Navigation**
   - Scroll through previous translations
   - Replay audio segments
   - Clear understanding of sequence

## Technical Challenges & Solutions

### 1. Audio Storage & Memory Management
**Challenge**: Storing multiple audio segments temporarily
**Solution**: 
- Use temporary file storage with 24hr expiration
- Implement LRU cache for active segments
- Compress audio data

### 2. Sequence Ordering
**Challenge**: Ensuring translations arrive in correct order
**Solution**:
- Assign sequence numbers to each segment
- Use message queuing with ordered delivery
- Handle out-of-order scenarios gracefully

### 3. Error Handling
**Challenge**: Failed translations, network issues
**Solution**:
- Retry mechanism for failed sends
- Queue persistence across disconnections
- Clear error messaging to teachers

### 4. Performance Impact
**Challenge**: Additional storage and processing overhead
**Solution**:
- Lazy loading of segments
- Background cleanup processes
- Feature flag to disable when not needed

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Feature flag system
- Basic UI toggle
- Audio segment storage
- WebSocket protocol extensions

### Phase 2: Queue Management (Week 3)
- Translation queue service
- Sequence number system
- Basic send functionality

### Phase 3: Enhanced UI (Week 4)
- Segment preview/playback
- Queue status display
- Error handling UI

### Phase 4: Polish & Testing (Week 5)
- Performance optimization
- Edge case handling
- Comprehensive testing

## Success Metrics

### Teacher Satisfaction
- Reduction in "accidental translations"
- Increased control satisfaction score
- Usage adoption rate of manual mode

### Translation Quality
- Fewer incomplete translations sent
- Higher accuracy scores (teacher review before send)
- Reduced re-recording frequency

### System Performance
- No degradation in auto mode performance
- Acceptable latency in manual mode
- Storage usage within limits

## Risk Assessment

### High Risk
- **Complexity**: Significant feature complexity could introduce bugs
- **Performance**: Additional storage/processing overhead

### Medium Risk
- **User Confusion**: Two different modes might confuse users
- **Network Issues**: Queue persistence across disconnections

### Low Risk
- **Feature Flag**: Can be disabled if issues arise
- **Backwards Compatibility**: Auto mode remains unchanged

## Conclusion

This feature provides significant value by giving teachers granular control over translation delivery while maintaining the existing seamless experience as the default. The feature flag approach allows for safe rollout and rollback, while the phased implementation ensures manageable development complexity.

The manual mode addresses real pedagogical needs where teachers want to control pacing and ensure translation quality, making it a valuable addition to the platform's capabilities.
