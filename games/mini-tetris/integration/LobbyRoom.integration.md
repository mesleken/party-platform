# Mini Tetris integration into the existing LobbyRoom

The current Party Platform server accepts game selection inside `apps/server/src/rooms/LobbyRoom.ts`.
The least disruptive integration is to keep `LobbyRoom` as the platform coordinator and delegate Tetris runtime to `MiniTetrisGame`.

## 1. Import

Add:

```ts
import { MiniTetrisGame } from '@platform/mini-tetris/server/MiniTetrisGame.js';
import type { TetrisInput } from '@platform/mini-tetris/shared/types.js';
```

## 2. Private field

Add:

```ts
private miniTetrisGame?: MiniTetrisGame;
```

## 3. Allow game selection

Change the existing `SELECT_GAME` validation so `mini-tetris` is accepted:

```ts
const allowedGames = new Set([
  'reaction-rush',
  'quiz-arena',
  'mini-tetris',
]);

if (message && allowedGames.has(message.gameId)) {
  this.state.selectedGameId = message.gameId;
}
```

## 4. Start routing

Extend the current `START_GAME` branch:

```ts
if (this.state.selectedGameId === 'quiz-arena') {
  this.startQuizGame();
} else if (this.state.selectedGameId === 'mini-tetris') {
  this.startMiniTetrisGame();
} else {
  this.startReactionRushGame();
}
```

## 5. Add the adapter

```ts
private startMiniTetrisGame() {
  this.state.activeGameId = 'mini-tetris';
  this.state.status = 'loading';

  this.miniTetrisGame = new MiniTetrisGame({
    broadcast: (type, payload) => {
      this.broadcast(type, payload);
    },
    sendToPlayer: (sessionId, type, payload) => {
      const client = this.clients.find(
        (candidate) => candidate.sessionId === sessionId,
      );
      client?.send(type, payload);
    },
  });

  this.state.players.forEach((player: PlayerStateType) => {
    if (player.isConnected) {
      this.miniTetrisGame?.addPlayer(
        player.id,
        player.nickname,
      );
    }
  });

  this.miniTetrisGame.start();
}
```

## 6. Handle generic INPUT

The existing `sdk-core` protocol already defines an `INPUT` message, so no new protocol type is required.

Add:

```ts
this.onMessage('INPUT', (client, message) => {
  if (this.state.activeGameId !== 'mini-tetris') return;
  this.miniTetrisGame?.handleInput(
    client.sessionId,
    message as TetrisInput,
  );
});
```

## 7. Cleanup

Inside `resetToLobby()` add:

```ts
this.miniTetrisGame?.stop();
this.miniTetrisGame = undefined;
```

Also add the same cleanup to `onDispose()`.

## 8. Player lifecycle

When a controller disconnects during a Tetris match, decide whether the platform should remove them immediately or preserve them for reconnect. The existing LobbyRoom already uses a 60-second reconnection window; the cleanest next step is to keep the existing session and tell `MiniTetrisGame` only when the reconnect grace period expires.
