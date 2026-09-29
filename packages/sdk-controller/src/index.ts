import { Client, type Room } from '@colyseus/sdk';
import type { SessionStateType } from '@platform/sdk-core';

export class ControllerSDK {
  private client: Client;
  private room?: Room<SessionStateType>;

  constructor(serverUrl: string = 'ws://localhost:2567') {
    this.client = new Client(serverUrl);
  }

  /** Mevcut bir odaya katılır */
  async joinSession(roomCode: string, nickname: string, avatar: string = 'default'): Promise<void> {
    try {
      this.room = await this.client.joinById<SessionStateType>(roomCode, {
        role: 'controller',
        nickname,
        avatar
      });

      this.room.onStateChange((state) => {
        this.onStateChange(state);
      });
      
    } catch (error) {
      console.error('[ControllerSDK] Odaya katılınamadı', error);
      throw error;
    }
  }

  public toggleReady() {
    this.room?.send('READY');
  }

  public startGame() {
    this.room?.send('START_GAME');
  }

  public press() {
    console.log('[ControllerSDK] room.send("PRESS") çağrılıyor...');
    this.room?.send('PRESS');
  }

  public selectGame(gameId: string) {
    this.room?.send('SELECT_GAME', { gameId });
  }

  public answerQuiz(optionIndex: number) {
    console.log(`[ControllerSDK] room.send("ANSWER_QUIZ", ${optionIndex})`);
    this.room?.send('ANSWER_QUIZ', { optionIndex });
  }

  public returnToLobby() {
    this.room?.send('RETURN_TO_LOBBY');
  }

  public get sessionId(): string | undefined {
    return this.room?.sessionId;
  }

  // Override this
  public onStateChange: (state: SessionStateType) => void = () => {};
}
