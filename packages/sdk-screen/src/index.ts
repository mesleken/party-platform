import { Client, type Room } from '@colyseus/sdk';
import type { SessionStateType } from '@platform/sdk-core';

export class ScreenSDK {
  private client: Client;
  private room?: Room<SessionStateType>;

  constructor(serverUrl: string = 'ws://localhost:2567') {
    this.client = new Client(serverUrl);
  }

  /** Yeni bir oturum (Oda) oluşturur */
  async createSession(): Promise<string> {
    try {
      this.room = await this.client.create<SessionStateType>('lobby', { role: 'screen' });
      
      this.room.onStateChange((state) => {
        this.onStateChange(state);
      });

      this.room.onMessage('STATE', (payload: any) => {
        if (payload?.gameId === 'mini-tetris') {
          this.onTetrisState(payload.state);
        } else if (payload?.gameId === 'lost-and-found') {
          this.onLostAndFoundState(payload.state);
        } else if (payload?.gameId === 'rc-rush') {
          this.onRcRushState(payload.state);
        }
      });

      this.room.onMessage('EVENT', (payload: any) => {
        if (payload?.gameId === 'rc-rush' && payload?.event) {
          this.onRcRushEvent(payload.event);
        }
      });

      this.room.onMessage('SHOWDOWN_SNAPSHOT', (payload: any) => {
        this.onShowdownState(payload);
      });

      return this.room.roomId; // 6 haneli kod
    } catch (error) {
      console.error('[ScreenSDK] Session oluşturulamadı', error);
      throw error;
    }
  }

  // Override this
  public onStateChange: (state: SessionStateType) => void = () => {};
  public onTetrisState: (state: any) => void = () => {};
  public onLostAndFoundState: (state: any) => void = () => {};
  public onRcRushState: (state: any) => void = () => {};
  public onRcRushEvent: (event: any) => void = () => {};
  public onShowdownState: (state: any) => void = () => {};

  public selectGame(gameId: string) {
    this.room?.send('SELECT_GAME', { gameId });
  }

  public startGame() {
    this.room?.send('START_GAME');
  }

  public returnToLobby() {
    this.room?.send('RETURN_TO_LOBBY');
  }

  public pauseGame() {
    this.room?.send('PAUSE_GAME');
  }

  public resumeGame() {
    this.room?.send('RESUME_GAME');
  }

  public launchMatch() {
    this.room?.send('LAUNCH_MATCH');
  }

  public updateGameSettings(settings: any) {
    this.room?.send('UPDATE_GAME_SETTINGS', settings);
  }

  public getRoomCode(): string | undefined {
    return this.room?.roomId;
  }

  public get sessionId(): string | undefined {
    return this.room?.sessionId;
  }
}
