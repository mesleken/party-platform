import { Client, type Room } from '@colyseus/sdk';
import type { SessionStateType, FootballInput } from '@platform/sdk-core';

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

      this.room.onMessage('BLUFF_ERROR', (payload: { error: string }) => {
        this.onBluffError(payload?.error || 'Geçersiz blöf.');
      });

      this.room.onMessage('BLUFF_SUCCESS', (payload: any) => {
        this.onBluffSuccess(payload);
      });

      this.room.onMessage('SHOWDOWN_SNAPSHOT', (payload: any) => {
        this.onShowdownState(payload);
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

  public sendFootballInput(input: FootballInput) {
    this.room?.send('FOOTBALL_INPUT', input);
  }

  public switchFootballPlayer() {
    this.room?.send('FOOTBALL_SWITCH');
  }

  public chooseFootballTeam(team: 'blue' | 'red') {
    this.room?.send('FOOTBALL_CHOOSE_TEAM', { team });
  }

  public submitBluff(answer: string) {
    this.room?.send('SUBMIT_BLUFF', { answer });
  }

  public updateBluffSettings(settings: any) {
    this.room?.send('BLUFF_SETTINGS', settings);
  }

  public voteBluff(choiceId: string) {
    this.room?.send('VOTE_BLUFF', { choiceId });
  }

  public sendTetrisInput(input: any) {
    this.room?.send('INPUT', input);
  }

  public sendLostAndFoundInput(input: any) {
    this.room?.send('LOST_AND_FOUND_INPUT', input);
  }

  public sendRcRushInput(input: any) {
    this.room?.send('RC_RUSH_INPUT', input);
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

  public customizePlayer(data: { color?: string; costume?: string; avatar?: string }) {
    this.room?.send('CUSTOMIZE_PLAYER', data);
  }

  public updateGameSettings(settings: any) {
    this.room?.send('UPDATE_GAME_SETTINGS', settings);
  }

  public send(type: string, message?: any) {
    this.room?.send(type, message);
  }

  public onMessage(type: string, callback: (message: any) => void) {
    this.room?.onMessage(type, callback);
  }

  public sendShowdownBid(action: any) {
    this.room?.send('SHOWDOWN_BID', action);
  }

  public sendShowdownPickCard(cardId: string) {
    this.room?.send('SHOWDOWN_PICK_CARD', { cardId });
  }

  public sendShowdownTactics(submission: any) {
    this.room?.send('SHOWDOWN_TACTICS', submission);
  }

  public sendShowdownHalftime(adjustment: any) {
    this.room?.send('SHOWDOWN_HALFTIME', adjustment);
  }

  public sendShowdownAllOutAttack() {
    this.room?.send('SHOWDOWN_ALL_OUT_ATTACK');
  }

  public sendShowdownLiveTactics(action: any) {
    this.room?.send('SHOWDOWN_LIVE_TACTICS', action);
  }

  public sendShowdownShout(shout: string) {
    this.room?.send('SHOWDOWN_SHOUT', { shout });
  }

  public get sessionId(): string | undefined {
    return this.room?.sessionId;
  }

  // Override this
  public onStateChange: (state: SessionStateType) => void = () => {};
  public onTetrisState: (state: any) => void = () => {};
  public onLostAndFoundState: (state: any) => void = () => {};
  public onRcRushState: (state: any) => void = () => {};
  public onRcRushEvent: (event: any) => void = () => {};
  public onBluffError: (error: string) => void = () => {};
  public onBluffSuccess: (data: any) => void = () => {};
  public onShowdownState: (state: any) => void = () => {};
}

