import { LiveTickerMessage, TimelineMarker } from '../../../shared/types.js';

export type MatchEventType =
  | 'PASS_ATTEMPTED'
  | 'PASS_COMPLETED'
  | 'PASS_INTERCEPTED'
  | 'SHOT_TAKEN'
  | 'GOAL'
  | 'SAVE'
  | 'WOODWORK'
  | 'OFFSIDE'
  | 'FOUL'
  | 'RESTART'
  | 'SHOUT';

export interface MatchEventData {
  type: MatchEventType;
  teamIndex: 0 | 1 | -1;
  matchSecond: number;
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  xg?: number;
  commentary?: string;
  details?: Record<string, any>;
}

export interface EventEnvelope {
  sequence: number;
  matchSecond: number;
  event: MatchEventData;
}

export class MatchEventLog {
  private sequenceCounter = 0;
  private events: EventEnvelope[] = [];
  private liveTicker: LiveTickerMessage[] = [];
  private timelineMarkers: TimelineMarker[] = [];

  public logEvent(event: MatchEventData): EventEnvelope {
    this.sequenceCounter++;
    const envelope: EventEnvelope = {
      sequence: this.sequenceCounter,
      matchSecond: event.matchSecond,
      event
    };
    this.events.push(envelope);

    // Live Ticker bildirimi oluştur
    if (event.commentary) {
      const min = Math.floor(event.matchSecond / 60);
      const sec = Math.floor(event.matchSecond % 60);
      let tickerType: LiveTickerMessage['type'] = 'NORMAL';
      if (event.type === 'GOAL') tickerType = 'GOAL';
      else if (event.type === 'SAVE') tickerType = 'SAVE';
      else if (event.type === 'SHOT_TAKEN') tickerType = 'DANGER';
      else if (event.type === 'SHOUT') tickerType = 'SHOUT';
      else if (event.type === 'OFFSIDE') tickerType = 'EVENT';

      const tickerItem: LiveTickerMessage = {
        id: `evt-${envelope.sequence}`,
        minute: min,
        second: sec,
        text: event.commentary,
        teamIndex: event.teamIndex,
        type: tickerType
      };

      this.liveTicker.unshift(tickerItem);
      if (this.liveTicker.length > 25) {
        this.liveTicker.pop();
      }
    }

    // Timeline Marker ekle
    const minute = Math.min(90, Math.floor(event.matchSecond / 60) + 1);
    if (event.type === 'GOAL' && event.playerName) {
      this.timelineMarkers.push({
        minute,
        type: 'GOAL',
        teamIndex: event.teamIndex as 0 | 1,
        label: `⚽ ${event.playerName}`
      });
    } else if (event.type === 'SAVE' && event.playerName) {
      this.timelineMarkers.push({
        minute,
        type: 'SAVE',
        teamIndex: event.teamIndex as 0 | 1,
        label: `🧤 ${event.playerName}`
      });
    } else if (event.type === 'WOODWORK' && event.playerName) {
      this.timelineMarkers.push({
        minute,
        type: 'WOODWORK',
        teamIndex: event.teamIndex as 0 | 1,
        label: `💥 ${event.playerName}`
      });
    } else if (event.type === 'OFFSIDE' && event.playerName) {
      this.timelineMarkers.push({
        minute,
        type: 'OFFSIDE',
        teamIndex: event.teamIndex as 0 | 1,
        label: `🚩 OFSAYT (${event.playerName})`
      });
    }

    return envelope;
  }

  public getEvents(): readonly EventEnvelope[] {
    return this.events;
  }

  public getLiveTicker(): LiveTickerMessage[] {
    return this.liveTicker;
  }

  public getTimelineMarkers(): TimelineMarker[] {
    return this.timelineMarkers;
  }

  public clear() {
    this.sequenceCounter = 0;
    this.events = [];
    this.liveTicker = [];
    this.timelineMarkers = [];
  }
}
