import type {
  LostAndFoundConfig,
  LostAndFoundPhase,
  LostAndFoundSnapshot,
  PlayerInput,
  PlayerSnapshot,
  PhysicsCrate,
  PowerCore,
  Platform,
  PressurePlate,
  Lever,
  AnchorRing,
  MiniGameSession,
} from '../shared/types.js';
import { DEFAULT_CONFIG } from '../shared/types.js';

export interface RoomAdapter {
  broadcast(type: string, payload: any): void;
  sendToPlayer(sessionId: string, type: string, payload: any): void;
}

interface PlayerRuntime {
  id: string;
  nickname: string;
  role: 'milo' | 'nia';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  isGrounded: boolean;
  facingRight: boolean;
  abilityActive: boolean;
  abilityTarget?: { x: number; y: number; active: boolean };
  score: number;
  input: PlayerInput;
}

export class LostAndFoundGame {
  readonly config: LostAndFoundConfig;
  private readonly room: RoomAdapter;
  private readonly players = new Map<string, PlayerRuntime>();

  private tickTimer?: ReturnType<typeof setInterval>;
  private tickId = 0;
  private startedAt = 0;
  private phase: LostAndFoundPhase = 'intro';
  private objectiveText = 'Atölyeye Hoş Geldiniz! İlerleyin.';

  // World Entities
  private platforms: Platform[] = [];
  private crates: PhysicsCrate[] = [];
  private powerCore: PowerCore = { x: 42, y: 18, vx: 0, vy: 0, isHeld: false, isInserted: false };
  private pressurePlates: PressurePlate[] = [];
  private levers: Lever[] = [];
  private anchorRings: AnchorRing[] = [];
  private miniGame: MiniGameSession = {
    targetFrequency: 72,
    targetPhase: 180,
    miloFrequency: 10,
    niaPhase: 45,
    syncProgress: 0,
    isUnlocked: false,
  };
  private vaultDoorOpen = false;
  private completionTimeMs?: number;

  constructor(room: RoomAdapter, config: Partial<LostAndFoundConfig> = {}) {
    this.room = room;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initLevel();
  }

  private initLevel(): void {
    // Level 1: "The Workshop" (Atölye)
    this.platforms = [
      // Bölge 1: Başlangıç Zemin & Yüksek Raf
      { id: 'floor_1', x: 0, y: 0, width: 28, height: 2, type: 'static' },
      { id: 'shelf_1', x: 14, y: 6, width: 10, height: 1, type: 'static' },
      { id: 'gate_1', x: 27, y: 2, width: 1.5, height: 8, type: 'gate', isOpen: false },

      // Bölge 2: Çukur & Asansör (Jeneratör gücü gelince çalışır)
      { id: 'elevator', x: 34, y: 2, width: 8, height: 1.5, type: 'moving_v', minCoord: 2, maxCoord: 14, speed: 3.5, active: false },
      { id: 'bridge_high', x: 46, y: 14, width: 28, height: 2, type: 'static' },

      // Bölge 3: Buhar Pistonları (İkili Basınç Plakasıyla açılır)
      { id: 'piston_1', x: 74, y: 14, width: 2.2, height: 8, type: 'piston', isOpen: false },

      // Bölge 4: Büyük Kasa Salonu
      { id: 'vault_hall', x: 76, y: 14, width: 44, height: 2, type: 'static' },
      { id: 'vault_door', x: 105, y: 14, width: 2.5, height: 11, type: 'gate', isOpen: false },
    ];

    // Sandıklar: Rafta metal bir sandık var (Mıknatısla çekilebilir)
    this.crates = [
      { id: 'metal_crate_1', x: 18, y: 7, width: 2.6, height: 2.6, vx: 0, vy: 0, isMetal: true, isHeld: false },
    ];

    // Basınç Plakaları
    this.pressurePlates = [
      { id: 'plate_gate_1', x: 23, y: 2, width: 3, isPressed: false },
      { id: 'plate_dual_a', x: 64, y: 14, width: 2.8, isPressed: false },
      { id: 'plate_dual_b', x: 70, y: 14, width: 2.8, isPressed: false },
    ];

    // Kollar
    this.levers = [
      { id: 'lever_core_dispenser', x: 52, y: 17, isOn: false },
    ];

    // Kanca Halkaları (Nia için)
    this.anchorRings = [
      { id: 'ring_1', x: 19, y: 12 },
      { id: 'ring_2', x: 38, y: 18 },
      { id: 'ring_3', x: 52, y: 20 },
      { id: 'ring_4', x: 74, y: 23 },
    ];
  }

  addPlayer(id: string, nickname: string): boolean {
    if (this.players.has(id)) return true;
    if (this.players.size >= 2) return false;

    // First player is Milo, second is Nia
    const role: 'milo' | 'nia' = this.players.size === 0 ? 'milo' : 'nia';
    const spawnX = role === 'milo' ? 4 : 8;

    this.players.set(id, {
      id,
      nickname,
      role,
      x: spawnX,
      y: 2,
      vx: 0,
      vy: 0,
      width: 1.6,
      height: 2.6,
      isGrounded: false,
      facingRight: true,
      abilityActive: false,
      score: 100,
      input: { moveX: 0 },
    });

    console.log(`[LostAndFound] Oyuncu eklendi: ${nickname} (Rol: ${role.toUpperCase()})`);
    return true;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    if (this.players.size === 0) {
      this.stop();
    }
  }

  handleInput(id: string, input: PlayerInput): void {
    const player = this.players.get(id);
    if (!player) return;

    player.input = input;

    // Mini-Game input forwarding
    if (this.phase === 'minigame' && input.miniGameInput) {
      if (player.role === 'milo' && input.miniGameInput.tunerValue !== undefined) {
        this.miniGame.miloFrequency = Math.max(0, Math.min(100, input.miniGameInput.tunerValue));
      }
      if (player.role === 'nia' && input.miniGameInput.phaseAngle !== undefined) {
        this.miniGame.niaPhase = Math.max(0, Math.min(360, input.miniGameInput.phaseAngle));
      }
    }
  }

  start(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.startedAt = Date.now();
    this.phase = 'playing';
    this.objectiveText = 'Atölyeyi keşfedin! Kapıyı açmak için ortak bulmacayı çözün.';

    this.tickTimer = setInterval(() => {
      this.updatePhysics();
    }, this.config.physicsTickMs);

    this.broadcastSnapshot();
    console.log('[LostAndFound] Oyun başladı!');
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    console.log('[LostAndFound] Oyun durduruldu.');
  }

  private updatePhysics(): void {
    const dt = this.config.physicsTickMs / 1000;
    this.tickId++;

    // 1. Oyuncu Hareketi ve Fizik
    for (const player of this.players.values()) {
      // Yatay hareket
      const moveX = player.input.moveX || 0;
      player.vx = moveX * this.config.moveSpeed;
      if (moveX > 0.05) player.facingRight = true;
      else if (moveX < -0.05) player.facingRight = false;

      // Zıplama
      if (player.input.jump && player.isGrounded) {
        player.vy = this.config.jumpVelocity;
        player.isGrounded = false;
      }

      // Yerçekimi
      player.vy += this.config.gravity * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      // Sınırlar
      player.x = Math.max(1, Math.min(116, player.x));
      if (player.y < -10) {
        // Çukura düştüyse en yakın güvenli zemine respawn
        player.x = player.x > 45 ? 48 : 4;
        player.y = player.x > 45 ? 16 : 4;
        player.vy = 0;
      }

      // Yetenek Yönetimi
      player.abilityActive = Boolean(player.input.abilityActive);
      this.processPlayerAbility(player);

      // Platform Çarpışmaları (AABB)
      player.isGrounded = false;
      this.resolvePlayerCollisions(player);
    }

    // 2. Sandık Fiziği ve Çarpışmalar
    this.updateCrates(dt);

    // 3. Güç Çekirdeği Fiziği
    this.updatePowerCore(dt);

    // 4. Mekanizmalar, Butonlar ve Platformlar
    this.updateMechanisms(dt);

    // 5. Mini Oyun ve Hedef Kontrolü
    this.checkObjectivesAndTriggers();

    // Snapshot Yayınla
    this.broadcastSnapshot();
  }

  private processPlayerAbility(player: PlayerRuntime): void {
    if (!player.abilityActive) {
      player.abilityTarget = undefined;
      return;
    }

    if (player.role === 'milo') {
      // 🧲 Mıknatıs Eldiveni: En yakın metal sandığı veya güç çekirdeğini kendine doğru çeker
      let targetX = player.x + (player.facingRight ? 10 : -10);
      let targetY = player.y;

      for (const crate of this.crates) {
        if (!crate.isMetal) continue;
        const dx = player.x - crate.x;
        const dy = player.y - crate.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.config.magnetRange) {
          // Sandığı kendine doğru çek
          crate.vx += (dx / dist) * 18;
          crate.vy += (dy / dist) * 12;
          crate.isHeld = true;
          targetX = crate.x;
          targetY = crate.y;
        } else {
          crate.isHeld = false;
        }
      }

      // Güç çekirdeğini çek
      if (!this.powerCore.isInserted) {
        const dx = player.x - this.powerCore.x;
        const dy = player.y - this.powerCore.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= this.config.magnetRange) {
          this.powerCore.vx += (dx / dist) * 22;
          this.powerCore.vy += (dy / dist) * 15;
          this.powerCore.isHeld = true;
          targetX = this.powerCore.x;
          targetY = this.powerCore.y;
        }
      }

      player.abilityTarget = { x: targetX, y: targetY, active: true };
    } else if (player.role === 'nia') {
      // 🪝 Kanca Fırlatıcı: En yakın halkaya veya kola tutunur
      let nearestDist = this.config.grappleRange;
      let targetPos: { x: number; y: number } | null = null;

      // Halkaları ara
      for (const ring of this.anchorRings) {
        const dx = ring.x - player.x;
        const dy = ring.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          targetPos = { x: ring.x, y: ring.y };
        }
      }

      // Kolları ara
      for (const lever of this.levers) {
        const dx = lever.x - player.x;
        const dy = lever.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          targetPos = { x: lever.x, y: lever.y };
          // Kolu aktif et!
          if (!lever.isOn) {
            lever.isOn = true;
            console.log(`[LostAndFound] Nia kanca ile ${lever.id} kolunu çekti!`);
          }
        }
      }

      if (targetPos) {
        // Nia'yı hedefe doğru süzülterek çek
        const dx = targetPos.x - player.x;
        const dy = targetPos.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        player.vx += (dx / dist) * 16;
        player.vy += (dy / dist) * 18;
        player.abilityTarget = { x: targetPos.x, y: targetPos.y, active: true };
      } else {
        player.abilityTarget = undefined;
      }
    }
  }

  private resolvePlayerCollisions(player: PlayerRuntime): void {
    const pw = player.width;
    const ph = player.height;

    // Platform çarpışmaları
    for (const plat of this.platforms) {
      if (plat.type === 'gate' && plat.isOpen) continue;
      if (plat.type === 'piston' && plat.isOpen) continue;

      // AABB overlap
      const pLeft = player.x - pw / 2;
      const pRight = player.x + pw / 2;
      const pBottom = player.y;
      const pTop = player.y + ph;

      const bLeft = plat.x;
      const bRight = plat.x + plat.width;
      const bBottom = plat.y;
      const bTop = plat.y + plat.height;

      if (pRight > bLeft && pLeft < bRight && pTop > bBottom && pBottom < bTop) {
        // Üstten zemin teması
        const prevBottom = pBottom - player.vy * (this.config.physicsTickMs / 1000);
        if (prevBottom >= bTop - 0.4 && player.vy <= 0) {
          player.y = bTop;
          player.vy = 0;
          player.isGrounded = true;

          // Asansör üstündeyse asansörle beraber yüksel
          if (plat.type === 'moving_v' && plat.active) {
            player.y = bTop;
          }
        } else if (pLeft < bLeft && player.vx > 0) {
          // Soldan çarpma
          player.x = bLeft - pw / 2;
          player.vx = 0;
        } else if (pRight > bRight && player.vx < 0) {
          // Sağdan çarpma
          player.x = bRight + pw / 2;
          player.vx = 0;
        } else if (pTop > bBottom && player.vy > 0) {
          // Alttan tavan çarpması
          player.y = bBottom - ph;
          player.vy = 0;
        }
      }
    }

    // Sandık üstüne basabilme ve itebilme
    for (const crate of this.crates) {
      const pLeft = player.x - pw / 2;
      const pRight = player.x + pw / 2;
      const pBottom = player.y;
      const pTop = player.y + ph;

      const cLeft = crate.x;
      const cRight = crate.x + crate.width;
      const cBottom = crate.y;
      const cTop = crate.y + crate.height;

      if (pRight > cLeft && pLeft < cRight && pTop > cBottom && pBottom < cTop) {
        if (pBottom >= cTop - 0.4 && player.vy <= 0) {
          player.y = cTop;
          player.vy = 0;
          player.isGrounded = true;
        } else if (player.x < crate.x) {
          // Sandığı sağa it
          crate.x += 0.2;
          crate.vx = Math.max(crate.vx, 3.5);
          player.x = cLeft - pw / 2;
        } else if (player.x > crate.x) {
          // Sandığı sola it
          crate.x -= 0.2;
          crate.vx = Math.min(crate.vx, -3.5);
          player.x = cRight + pw / 2;
        }
      }
    }
  }

  private updateCrates(dt: number): void {
    for (const crate of this.crates) {
      crate.vy += this.config.gravity * dt;
      crate.x += crate.vx * dt;
      crate.y += crate.vy * dt;
      crate.vx *= 0.88; // Sürtünme

      // Zemin ve platform kontrolü
      for (const plat of this.platforms) {
        if (plat.type === 'gate' && plat.isOpen) continue;
        const cLeft = crate.x;
        const cRight = crate.x + crate.width;
        const cBottom = crate.y;

        const bLeft = plat.x;
        const bRight = plat.x + plat.width;
        const bTop = plat.y + plat.height;

        if (cRight > bLeft && cLeft < bRight && cBottom < bTop && cBottom > bTop - 1.2) {
          crate.y = bTop;
          crate.vy = 0;
        }
      }
    }
  }

  private updatePowerCore(dt: number): void {
    if (this.powerCore.isInserted) return;

    // Kol çekildiyse çekirdek düşmeye başlar
    const lever = this.levers.find((l) => l.id === 'lever_core_dispenser');
    if (lever?.isOn) {
      this.powerCore.vy += this.config.gravity * dt;
      this.powerCore.x += this.powerCore.vx * dt;
      this.powerCore.y += this.powerCore.vy * dt;
      this.powerCore.vx *= 0.9;

      // Zemin kontrolü
      if (this.powerCore.y <= 2) {
        this.powerCore.y = 2;
        this.powerCore.vy = 0;
      }

      // Jeneratör soketine (x: 32, y: 2) yaklaşma kontrolü
      const distToSocket = Math.hypot(this.powerCore.x - 32, this.powerCore.y - 2);
      if (distToSocket < 2.5) {
        this.powerCore.isInserted = true;
        this.powerCore.x = 32;
        this.powerCore.y = 2.5;
        this.powerCore.vx = 0;
        this.powerCore.vy = 0;
        console.log('[LostAndFound] ⚡ Güç Çekirdeği Jeneratöre Yerleştirildi! Asansör Çalışıyor!');
      }
    }
  }

  private updateMechanisms(dt: number): void {
    // 1. Kapı 1 Basınç Plakası (Sandık veya oyuncu üstüne basınca açılır)
    const plateGate1 = this.pressurePlates.find((p) => p.id === 'plate_gate_1');
    if (plateGate1) {
      let pressed = false;
      // Oyuncular kontrolü
      for (const player of this.players.values()) {
        if (Math.abs(player.x - (plateGate1.x + plateGate1.width / 2)) < 2 && Math.abs(player.y - 2) < 0.8) {
          pressed = true;
        }
      }
      // Sandık kontrolü
      for (const crate of this.crates) {
        if (Math.abs(crate.x - plateGate1.x) < 2.5 && Math.abs(crate.y - 2) < 0.8) {
          pressed = true;
        }
      }
      plateGate1.isPressed = pressed;
      const gate1 = this.platforms.find((p) => p.id === 'gate_1');
      if (gate1) {
        gate1.isOpen = pressed;
      }
    }

    // 2. Asansör Hareketi (Güç çekirdeği takıldıysa)
    const elevator = this.platforms.find((p) => p.id === 'elevator');
    if (elevator && this.powerCore.isInserted) {
      elevator.active = true;
      const speed = elevator.speed || 3.5;
      const minC = elevator.minCoord || 2;
      const maxC = elevator.maxCoord || 14;

      // Sinüs dalgasıyla pürüzsüz hareket
      const elapsedSec = (Date.now() - this.startedAt) / 1000;
      elevator.y = minC + ((Math.sin(elapsedSec * 1.5) + 1) / 2) * (maxC - minC);
    }

    // 3. İkili Basınç Plakası (Buhar pistonlarını açar)
    const plateA = this.pressurePlates.find((p) => p.id === 'plate_dual_a');
    const plateB = this.pressurePlates.find((p) => p.id === 'plate_dual_b');
    if (plateA && plateB) {
      let pressedA = false;
      let pressedB = false;

      for (const p of this.players.values()) {
        if (Math.abs(p.x - plateA.x) < 2.2 && Math.abs(p.y - 14) < 1.2) pressedA = true;
        if (Math.abs(p.x - plateB.x) < 2.2 && Math.abs(p.y - 14) < 1.2) pressedB = true;
      }
      for (const c of this.crates) {
        if (Math.abs(c.x - plateA.x) < 2.2 && Math.abs(c.y - 14) < 1.2) pressedA = true;
        if (Math.abs(c.x - plateB.x) < 2.2 && Math.abs(c.y - 14) < 1.2) pressedB = true;
      }

      plateA.isPressed = pressedA;
      plateB.isPressed = pressedB;

      const piston = this.platforms.find((p) => p.id === 'piston_1');
      if (piston) {
        piston.isOpen = pressedA && pressedB;
      }
    }
  }

  private checkObjectivesAndTriggers(): void {
    // Mini-Game Tetikleyicisi (Büyük Kasa Konsolu: x: 92 ile 98 arası)
    const milo = [...this.players.values()].find((p) => p.role === 'milo');
    const nia = [...this.players.values()].find((p) => p.role === 'nia');

    if (milo && nia) {
      const miloAtConsole = milo.x >= 90 && milo.x <= 100;
      const niaAtConsole = nia.x >= 90 && nia.x <= 100;

      if (miloAtConsole && niaAtConsole && !this.miniGame.isUnlocked) {
        if (this.phase !== 'minigame') {
          this.phase = 'minigame';
          this.objectiveText = '🔐 Büyük Kasa Kilidi: Frekans ve Fazı Telefonlarınızdan Eşitleyin!';
          console.log('[LostAndFound] Mini Oyun Aktif!');
        }

        // Frekans & Faz Senkronizasyonu
        const freqDiff = Math.abs(this.miniGame.miloFrequency - this.miniGame.targetFrequency);
        const phaseDiff = Math.abs(this.miniGame.niaPhase - this.miniGame.targetPhase);

        if (freqDiff <= 6 && phaseDiff <= 20) {
          this.miniGame.syncProgress = Math.min(100, this.miniGame.syncProgress + 1.2);
          if (this.miniGame.syncProgress >= 100) {
            this.miniGame.isUnlocked = true;
            this.vaultDoorOpen = true;
            this.phase = 'playing';
            this.objectiveText = '🎉 Kasa Açıldı! Çıkış Portalı İçin İlerleyin!';
            const vault = this.platforms.find((p) => p.id === 'vault_door');
            if (vault) vault.isOpen = true;
            console.log('[LostAndFound] Kasa Açıldı!');
          }
        } else {
          this.miniGame.syncProgress = Math.max(0, this.miniGame.syncProgress - 0.4);
        }
      }

      // Seviye Tamamlama Portalı (x: 110 üzeri)
      if (this.vaultDoorOpen && milo.x >= 110 && nia.x >= 110 && this.phase !== 'completed') {
        this.phase = 'completed';
        this.completionTimeMs = Date.now() - this.startedAt;
        this.objectiveText = '🏆 BÖLÜM TAMAMLANDI! Tebrikler Partnerler!';
        milo.score += 250;
        nia.score += 250;
        console.log(`[LostAndFound] Bölüm Tamamlandı! Süre: ${Math.round(this.completionTimeMs / 1000)}s`);
      }
    }
  }

  private broadcastSnapshot(): void {
    const elapsedMs = this.phase === 'intro' ? 0 : Date.now() - this.startedAt;

    const playersSnap: PlayerSnapshot[] = [...this.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      role: p.role,
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      vx: Math.round(p.vx * 100) / 100,
      vy: Math.round(p.vy * 100) / 100,
      isGrounded: p.isGrounded,
      facingRight: p.facingRight,
      abilityActive: p.abilityActive,
      abilityTarget: p.abilityTarget,
      score: p.score,
    }));

    const snapshot: LostAndFoundSnapshot = {
      gameId: 'lost-and-found',
      phase: this.phase,
      tick: this.tickId,
      elapsedMs,
      objectiveText: this.objectiveText,
      players: playersSnap,
      crates: this.crates,
      powerCore: this.powerCore,
      platforms: this.platforms,
      pressurePlates: this.pressurePlates,
      levers: this.levers,
      anchorRings: this.anchorRings,
      miniGame: this.miniGame,
      vaultDoorOpen: this.vaultDoorOpen,
      completionTimeMs: this.completionTimeMs,
    };

    this.room.broadcast('STATE', {
      gameId: 'lost-and-found',
      state: snapshot,
    });
  }
}
