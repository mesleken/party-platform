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
      this.room = await this.client.joinOrCreate<SessionStateType>('lobby', { role: 'screen' });
      
      this.room.onStateChange((state) => {
        this.onStateChange(state);
      });

      return this.room.roomId; // 6 haneli kod
    } catch (error) {
      console.error('[ScreenSDK] Session oluşturulamadı', error);
      throw error;
    }
  }

  // Override this
  public onStateChange: (state: SessionStateType) => void = () => {};

  public selectGame(gameId: string) {
    this.room?.send('SELECT_GAME', { gameId });
  }

  public startGame() {
    this.room?.send('START_GAME');
  }

  public returnToLobby() {
    this.room?.send('RETURN_TO_LOBBY');
  }

  public getRoomCode(): string | undefined {
    return this.room?.roomId;
  }

  public get sessionId(): string | undefined {
    return this.room?.sessionId;
  }
}
