# Mini Tetris

A simple server-authoritative multiplayer Tetris mode for Party Platform.

## Game model

- 10 x 20 board per player.
- 2–8 players in a match.
- All players play simultaneously.
- One player clears 2/3/4 lines -> opponents receive 1/2/4 garbage lines.
- Last surviving player wins.
- If the match time limit is reached, highest score wins.
- Single-player is supported; it becomes a normal Tetris score run.
- The phone is only a controller.
- The big screen renders all boards.
- The server owns board state, piece movement, collision, line clearing, scoring and garbage.

## Controls

- Left
- Right
- Rotate
- Soft drop
- Hard drop

## Server authority

Clients do not send board coordinates or piece positions.

Client -> `INPUT` -> server -> simulation -> `STATE` -> screen.

The server is intentionally simple and deterministic in structure so that a future version can add hold-piece, T-spin scoring, targeting, replay data, or spectators without changing the public gameplay contract.

## Current implementation boundary

This package is delivered as a drop-in game module because the GitHub repository is not writable from this environment. The included `integration/LobbyRoom.integration.md` contains the exact integration points for the current repository.
