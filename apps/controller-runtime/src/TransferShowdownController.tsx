import { useState, useEffect } from 'preact/hooks';
import type { ControllerSDK } from '@platform/sdk-controller';
import {
  SquadValidator,
  getFormationSlots,
  checkPositionAffinity,
  autoAssignLineup,
  calculateTeamSynergy,
  type BidAction,
  type DefensiveLineType,
  type FormationType,
  type ManagerBudgetState,
  type ManagerTactics,
  type PlayerCard,
  type PlaystyleType,
  type ShowdownSnapshot,
  type TacticsSubmission
} from '@games/transfer-showdown';

interface Props {
  sdk: ControllerSDK;
  playerId: string;
}

// Güvenilir Oyuncu Fotoğrafı & Fallback Rozet Bileşeni
function PlayerAvatar({ url, name, flag, size = 44 }: { url?: string; name: string; flag?: string; size?: number }) {
  const [hasError, setHasError] = useState(false);
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  if (!url || hasError) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        border: '1.5px solid #38bdf8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: `${Math.max(10, Math.round(size * 0.35))}px`,
        color: '#f8fafc',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
      }}>
        <span>{initials}</span>
        {flag && <span style={{ fontSize: `${Math.max(8, Math.round(size * 0.28))}px`, lineHeight: 1 }}>{flag}</span>}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setHasError(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        objectFit: 'cover',
        background: '#1e293b',
        border: '1.5px solid #38bdf8',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
      }}
    />
  );
}

export function TransferShowdownController({ sdk, playerId }: Props) {
  const [snapshot, setSnapshot] = useState<ShowdownSnapshot | null>(null);

  // Taktik Arayüzü Durumları
  const [selectedFormation, setSelectedFormation] = useState<FormationType>('4-3-3');
  const [selectedPlaystyle, setSelectedPlaystyle] = useState<PlaystyleType>('balanced');
  const [selectedDefLine, setSelectedDefLine] = useState<DefensiveLineType>('balanced');
  const [lineup, setLineup] = useState<Record<number, string>>({});
  const [tacticsConfirmed, setTacticsConfirmed] = useState(false);
  const [hasInitializedTactics, setHasInitializedTactics] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Modal ve Sekme Durumları
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [allOutUsed, setAllOutUsed] = useState(false);
  const [activePackCardTab, setActivePackCardTab] = useState<number>(0); // 0=GK, 1=DEF, 2=MID, 3=FWD
  const [activeDugoutShout, setActiveDugoutShout] = useState<string | null>(null);

  useEffect(() => {
    const handleSnapshot = (snap: ShowdownSnapshot) => {
      setSnapshot(snap);

      // Taktik aşamasına geçildiğinde SADECE İLK KEZ state'i sunucudan al (200ms reset bug fix)
      if (snap.phase === 'TACTICS' || snap.phase === 'HALFTIME') {
        const myTac = snap.managerTactics[playerId];
        const myMan = snap.managers[playerId];
        if (myTac && !hasInitializedTactics) {
          setSelectedFormation(myTac.formation);
          setSelectedPlaystyle(myTac.playstyle);
          setSelectedDefLine(myTac.defensiveLine);

          // Eğer lineup boşsa otomatik doldur
          if (myTac.lineup && Object.keys(myTac.lineup).length > 0) {
            setLineup(myTac.lineup);
          } else if (myMan && myMan.cards.length > 0) {
            const autoLineup = autoAssignLineup(myTac.formation, myMan.cards);
            setLineup(autoLineup);
          }

          setTacticsConfirmed(myTac.isReady);
          setHasInitializedTactics(true);
        } else if (myTac?.isReady) {
          setTacticsConfirmed(true);
        }
      } else {
        if (hasInitializedTactics) {
          setHasInitializedTactics(false);
        }
      }
    };

    sdk.onShowdownState = handleSnapshot;

    return () => {
      // SDK otomatik temizler
    };
  }, [sdk, playerId, hasInitializedTactics]);

  if (!snapshot) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#fff',
        background: 'linear-gradient(135deg, #090d16, #111827)',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>⚽</div>
        <h2 style={{ margin: 0, fontWeight: 800 }}>TRANSFER SHOWDOWN</h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>Maç verileri yükleniyor...</p>
      </div>
    );
  }

  const myManager: ManagerBudgetState | undefined = snapshot.managers[playerId];
  const currentLot = snapshot.currentLot;

  const isHighestBidder = currentLot?.highestBidderId === playerId;
  const isMyTurnToStart = currentLot?.turnStarterId === playerId;
  const isBidLocked = Boolean(currentLot && !currentLot.allowedBidders.includes(playerId));
  const isAffordablePlus1 = Boolean(myManager && currentLot ? currentLot.currentBid + 1 <= myManager.availableMaxBid && !isBidLocked : false);
  const isAffordablePlus5 = Boolean(myManager && currentLot ? currentLot.currentBid + 5 <= myManager.availableMaxBid && !isBidLocked : false);

  // Açık artırma teklif gönderme
  const handleBid = (inc: 1 | 5) => {
    if (!myManager || !currentLot || isBidLocked) return;
    const action: BidAction = {
      type: 'BID_INCREMENT',
      incrementAmount: inc
    };
    sdk.send('SHOWDOWN_BID', action);
  };

  // Pas / Rakibe Bırak
  const handleForfeit = () => {
    const action: BidAction = {
      type: 'FORFEIT_LOT'
    };
    sdk.send('SHOWDOWN_BID', action);
  };

  // Paketten Futbolcu Seçme (Draft Pick)
  const handlePickCard = (cardId: string) => {
    sdk.send('SHOWDOWN_PICK_CARD', { cardId });
  };

  // Taktik Güncelleme (Anında sunucuya yayınlar, isReady false)
  const broadcastTacticsChange = (
    formation: FormationType,
    playstyle: PlaystyleType,
    defLine: DefensiveLineType,
    newLineup: Record<number, string>,
    ready = false
  ) => {
    const submission: TacticsSubmission = {
      formation,
      playstyle,
      defensiveLine: defLine,
      lineup: newLineup,
      isReady: ready
    };
    sdk.send('SHOWDOWN_TACTICS', submission);
  };

  // Formasyon Değiştirme
  const handleSelectFormation = (f: FormationType) => {
    setSelectedFormation(f);
    // Formasyon değişince slotları otomatik olarak yeni formasyona adapte et
    let updatedLineup = { ...lineup };
    if (myManager?.cards) {
      updatedLineup = autoAssignLineup(f, myManager.cards);
      setLineup(updatedLineup);
    }
    broadcastTacticsChange(f, selectedPlaystyle, selectedDefLine, updatedLineup, false);
  };

  // Oyun Stili Değiştirme
  const handleSelectPlaystyle = (p: PlaystyleType) => {
    setSelectedPlaystyle(p);
    broadcastTacticsChange(selectedFormation, p, selectedDefLine, lineup, false);
  };

  // Savunma Çizgisi Değiştirme
  const handleSelectDefLine = (d: DefensiveLineType) => {
    setSelectedDefLine(d);
    broadcastTacticsChange(selectedFormation, selectedPlaystyle, d, lineup, false);
  };

  // Slot Tıklama: Oyuncu Seçim Çekmecesi Aç
  const handleSlotClick = (slotIdx: number) => {
    if (tacticsConfirmed) return;
    setSelectedSlotIndex(slotIdx);
  };

  // Oyuncuyu Slota Yerleştir / Takas Et
  const handleAssignPlayerToSlot = (cardId: string) => {
    if (selectedSlotIndex === null) return;
    const updatedLineup = { ...lineup };

    // Eğer bu oyuncu zaten başka bir slottaysa, iki slotu takas et!
    const existingSlotKey = Object.keys(updatedLineup).find((k) => updatedLineup[Number(k)] === cardId);
    const currentPlayerInTarget = updatedLineup[selectedSlotIndex];

    if (existingSlotKey !== undefined) {
      const existingSlotIdx = Number(existingSlotKey);
      if (currentPlayerInTarget) {
        updatedLineup[existingSlotIdx] = currentPlayerInTarget;
      } else {
        delete updatedLineup[existingSlotIdx];
      }
    }

    updatedLineup[selectedSlotIndex] = cardId;
    setLineup(updatedLineup);
    setSelectedSlotIndex(null);
    broadcastTacticsChange(selectedFormation, selectedPlaystyle, selectedDefLine, updatedLineup, false);
  };

  // Taktik Onaylama
  const handleConfirmTactics = () => {
    if (!myManager) return;
    broadcastTacticsChange(selectedFormation, selectedPlaystyle, selectedDefLine, lineup, true);
    setTacticsConfirmed(true);
  };

  // Devre Arası Taktik Değişikliği
  const handleHalftimeAdjustment = () => {
    sdk.send('SHOWDOWN_HALFTIME', {
      formation: selectedFormation,
      playstyle: selectedPlaystyle,
      defensiveLine: selectedDefLine
    });
    setTacticsConfirmed(true);
  };

  // FM Taktik Seslenişi (Dug-out shout)
  const handleDugoutShout = (shout: string) => {
    setActiveDugoutShout(shout);
    setTimeout(() => setActiveDugoutShout(null), 3000);
  };

  // Son 15 Dakika Agresif Oyna
  const handleAllOutAttack = () => {
    sdk.send('SHOWDOWN_ALL_OUT_ATTACK', {});
    setAllOutUsed(true);
  };

  // ==========================================
  // RENDER: PHASE 1 - AUCTION (AÇIK ARTIRMA)
  // ==========================================
  if (snapshot.phase === 'AUCTION') {
    const packCards = currentLot?.pack?.cards || (currentLot?.card ? [currentLot.card] : []);
    const previewCard = packCards[activePackCardTab] || packCards[0];
    const isWinnerPicking = currentLot?.isPickingPlayer && currentLot.winnerId === playerId;
    const isOpponentPicking = currentLot?.isPickingPlayer && currentLot.winnerId !== playerId;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090d16',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden'
      }}>
        {/* Üst Yönetici Bilgi Çubuğu */}
        <div style={{
          background: 'linear-gradient(180deg, #1e293b, #0f172a)',
          padding: '10px 14px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              {myManager?.nickname || 'Menajer'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#38bdf8' }}>
              💰 {myManager?.budget || 0} <span style={{ fontSize: '11px', color: '#94a3b8' }}>kredi</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
              KADRO: <span style={{ color: '#f59e0b', fontWeight: 800 }}>{myManager?.rosterCount || 0}/11</span>
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
              Maks Teklif: {myManager?.availableMaxBid || 0} cr
            </div>
          </div>
        </div>

        {/* Kullanıcının İstediği Zorunlu Pozisyon Göstergesi (GK 1/1, DEF 3-5, MID 3-5, FWD 1-3) */}
        {myManager && (
          <div style={{
            background: '#0f172a',
            padding: '6px 10px',
            display: 'flex',
            justifyContent: 'space-around',
            borderBottom: '1px solid #1e293b',
            fontSize: '11px',
            fontWeight: 800
          }}>
            <span style={{ color: myManager.positionCounts.GK === 1 ? '#10b981' : '#f59e0b' }}>
              🧤 GK: {myManager.positionCounts.GK}/1
            </span>
            <span style={{ color: myManager.positionCounts.DEF >= 3 ? '#10b981' : '#f59e0b' }}>
              🛡️ DEF: {myManager.positionCounts.DEF}/5 {myManager.positionCounts.DEF < 3 ? '(en az 3)' : ''}
            </span>
            <span style={{ color: myManager.positionCounts.MID >= 3 ? '#10b981' : '#f59e0b' }}>
              🎯 MID: {myManager.positionCounts.MID}/5 {myManager.positionCounts.MID < 3 ? '(en az 3)' : ''}
            </span>
            <span style={{ color: myManager.positionCounts.FWD >= 1 ? '#10b981' : '#f59e0b' }}>
              ⚡ FWD: {myManager.positionCounts.FWD}/3 {myManager.positionCounts.FWD < 1 ? '(en az 1)' : ''}
            </span>
          </div>
        )}

        {/* Sıra Kimde Göstergesi */}
        {currentLot && !currentLot.isPickingPlayer && (
          <div style={{
            background: isMyTurnToStart ? 'linear-gradient(90deg, #065f46, #047857)' : '#1e293b',
            color: '#fff',
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: 800,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            {isMyTurnToStart ? (
              <span>🎯 Sıra Sizde! Açılış Teklifi 1 Kredi ile yapıldı.</span>
            ) : (
              <span style={{ color: '#cbd5e1' }}>⏳ Açılış Sırası Rakipte (1 Kredi)</span>
            )}
          </div>
        )}

        {/* Ortadaki Aktif Paket & Kartlar */}
        <div style={{ flex: 1, padding: '10px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {currentLot ? (
            <div>
              {/* Paket Başlığı (Standard/Iconic yazısı kaldırıldı) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#38bdf8' }}>
                    {currentLot.pack?.packName || `PAKET #${currentLot.lotIndex + 1}`}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Açılış Teklifi: <b style={{ color: '#10b981' }}>1 cr</b>
                </div>
              </div>

              {/* ═══ EĞER KAZANAN OYUNCU SEÇİYORSA (DRAFTING VIEW) ═══ */}
              {isWinnerPicking ? (
                <div style={{
                  background: 'linear-gradient(145deg, #064e3b 0%, #022c22 100%)',
                  border: '2px solid #10b981',
                  borderRadius: '14px',
                  padding: '12px',
                  marginBottom: '10px',
                  boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#34d399' }}>
                      🎉 PAKETİ KAZANDINIZ! ({currentLot.finalPrice} Kredi)
                    </div>
                    <div style={{ fontSize: '11px', color: '#a7f3d0' }}>
                      Kadronuza katmak için 1 futbolcu seçin • Süre: <b>{Math.ceil(currentLot.pickingTimeLeft)}s</b>
                    </div>
                  </div>

                  {/* 4 Kart Listesi - Gerçek Resimlerle */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {packCards.map((card) => {
                      const check = myManager ? SquadValidator.canPickCard(myManager, card) : { canPick: true };
                      return (
                        <div key={card.id} style={{
                          background: '#0f172a',
                          border: `1.5px solid ${check.canPick ? '#10b981' : '#475569'}`,
                          borderRadius: '10px',
                          padding: '8px 10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          opacity: check.canPick ? 1 : 0.45
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <PlayerAvatar url={card.photoUrl} name={card.name} flag={card.countryFlag} size={42} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '15px', fontWeight: 900, color: '#f59e0b' }}>{card.ovr}</span>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8' }}>{card.position}</span>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{card.name}</span>
                              </div>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                {card.countryFlag} {card.club} • {card.specificRole}
                              </div>
                            </div>
                          </div>

                          {check.canPick ? (
                            <button
                              onClick={() => handlePickCard(card.id)}
                              style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              ⚽ KADROYA AL
                            </button>
                          ) : (
                            <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 700 }}>
                              {card.position === 'GK' ? '🧤 Kaleci Dolu' : '⚠️ Kota Sınırı'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : isOpponentPicking ? (
                <div style={{
                  background: '#1e293b',
                  border: '1.5px solid #64748b',
                  borderRadius: '14px',
                  padding: '16px',
                  textAlign: 'center',
                  marginBottom: '10px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#f59e0b' }}>
                    ⏳ {currentLot.highestBidderName || 'Rakip'} bir futbolcu seçiyor...
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Kalan süre: {Math.ceil(currentLot.pickingTimeLeft)}s
                  </div>
                </div>
              ) : (
                /* ═══ NORMAL TEKLİF AŞAMASI (PAKETTEKİ 4 FUTBOLCU TABLARI) ═══ */
                <div>
                  {/* 4 Pozisyon Sekmesi (GK, DEF, MID, FWD) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '4px',
                    marginBottom: '8px'
                  }}>
                    {packCards.map((c, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePackCardTab(idx)}
                        style={{
                          background: activePackCardTab === idx ? '#2563eb' : '#1e293b',
                          color: activePackCardTab === idx ? '#fff' : '#94a3b8',
                          border: activePackCardTab === idx ? '1px solid #60a5fa' : '1px solid #334155',
                          borderRadius: '8px',
                          padding: '6px 2px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '9px', opacity: 0.8 }}>{c.position}</span>
                        <span style={{ color: activePackCardTab === idx ? '#facc15' : '#cbd5e1' }}>{c.ovr}</span>
                      </button>
                    ))}
                  </div>

                  {/* Seçili Sekmedeki Kart Detayı - Gerçek Fotoğrafla */}
                  {previewCard && (
                    <div style={{
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      borderRadius: '14px',
                      border: `2px solid ${isHighestBidder ? '#10b981' : previewCard.accentColor || '#3b82f6'}`,
                      padding: '12px',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <PlayerAvatar url={previewCard.photoUrl} name={previewCard.name} flag={previewCard.countryFlag} size={54} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '17px', fontWeight: 900, color: '#fff' }}>
                            {previewCard.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {previewCard.countryFlag} {previewCard.club} • {previewCard.specificRole}
                          </div>
                        </div>

                        <div style={{
                          background: '#0f172a',
                          borderRadius: '10px',
                          padding: '4px 10px',
                          textAlign: 'center',
                          border: '1px solid #334155'
                        }}>
                          <div style={{ fontSize: '20px', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>
                            {previewCard.ovr}
                          </div>
                          <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>
                            {previewCard.position}
                          </div>
                        </div>
                      </div>

                      {/* 6 Yetenek İstatistiği */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: '4px',
                        marginTop: '10px',
                        background: '#090d16',
                        padding: '6px',
                        borderRadius: '6px'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>HIZ</div>
                          <div style={{ fontSize: '12px', fontWeight: 800 }}>{previewCard.stats.pac}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>ŞUT</div>
                          <div style={{ fontSize: '12px', fontWeight: 800 }}>{previewCard.stats.sho}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>PAS</div>
                          <div style={{ fontSize: '12px', fontWeight: 800 }}>{previewCard.stats.pas}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>DRİ</div>
                          <div style={{ fontSize: '12px', fontWeight: 800 }}>{previewCard.stats.dri}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>DEF</div>
                          <div style={{ fontSize: '12px', fontWeight: 800 }}>{previewCard.stats.def}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>FİZ</div>
                          <div style={{ fontSize: '12px', fontWeight: 800 }}>{previewCard.stats.phy}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Teklif ve Süre Bilgisi */}
                  <div style={{
                    marginTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#0284c715',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #0284c730'
                  }}>
                    <div>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>MEVCUT PAKET TEKLİFİ</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#38bdf8' }}>
                        {currentLot.currentBid} Kredi
                      </div>
                      <div style={{ fontSize: '10px', color: isHighestBidder ? '#10b981' : '#cbd5e1', fontWeight: 700 }}>
                        {currentLot.highestBidderName ? (isHighestBidder ? '👑 En Yüksek Teklif Sende!' : `Lider: ${currentLot.highestBidderName}`) : 'Henüz teklif yok'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        background: currentLot.timeLeft <= 2 ? '#ef4444' : '#1e293b',
                        color: '#fff',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontWeight: 900,
                        fontSize: '13px',
                        border: '1px solid #475569'
                      }}>
                        ⏱️ {Math.ceil(currentLot.timeLeft)}s
                      </div>
                      {currentLot.extensionCount > 0 && (
                        <div style={{ fontSize: '9px', color: '#f59e0b', marginTop: '2px', fontWeight: 700 }}>
                          +{currentLot.extensionCount * 2}s Uzatma
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Yeni transfer paketi hazırlanıyor...
            </div>
          )}

          {/* Kadromu Gör Butonu */}
          <button
            onClick={() => setShowRosterModal(true)}
            style={{
              marginTop: '10px',
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '7px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            📋 Alınan Oyuncuları Gör ({myManager?.cards.length || 0}/11)
          </button>
        </div>

        {/* Alt Butonlar: +1, +5, Pas / Rakibe Bırak */}
        {!currentLot?.isPickingPlayer && (
          <div style={{
            background: '#0f172a',
            padding: '10px 14px',
            borderTop: '1px solid #1e293b',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px'
          }}>
            <button
              disabled={Boolean(!isAffordablePlus1 || isHighestBidder || myManager?.hasPassedCurrentLot || isBidLocked)}
              onClick={() => handleBid(1)}
              style={{
                background: !isAffordablePlus1 || isHighestBidder || myManager?.hasPassedCurrentLot || isBidLocked
                  ? '#334155'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                opacity: !isAffordablePlus1 || isHighestBidder || myManager?.hasPassedCurrentLot || isBidLocked ? 0.5 : 1
              }}
            >
              +1 Kredi
            </button>

            <button
              disabled={Boolean(!isAffordablePlus5 || isHighestBidder || myManager?.hasPassedCurrentLot || isBidLocked)}
              onClick={() => handleBid(5)}
              style={{
                background: !isAffordablePlus5 || isHighestBidder || myManager?.hasPassedCurrentLot || isBidLocked
                  ? '#334155'
                  : 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                opacity: !isAffordablePlus5 || isHighestBidder || myManager?.hasPassedCurrentLot || isBidLocked ? 0.5 : 1
              }}
            >
              +5 Hızlı Teklif
            </button>

            <button
              onClick={handleForfeit}
              disabled={Boolean(myManager?.hasPassedCurrentLot)}
              style={{
                gridColumn: 'span 2',
                background: myManager?.hasPassedCurrentLot
                  ? '#334155'
                  : (currentLot?.highestBidderId && !isHighestBidder ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#475569'),
                color: '#fff',
                border: 'none',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                opacity: myManager?.hasPassedCurrentLot ? 0.6 : 1
              }}
            >
              {myManager?.hasPassedCurrentLot
                ? 'Pas Geçildi ⏳'
                : (currentLot?.highestBidderId && !isHighestBidder
                    ? `🤝 Rakibe Bırak (${currentLot.currentBid} cr)`
                    : '🛑 Bu Paketi Pas Geç')}
            </button>
          </div>
        )}

        {/* Modal: Alınan Oyuncular Listesi */}
        {showRosterModal && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>KADROM ({myManager?.cards.length || 0}/11)</h3>
              <button
                onClick={() => setShowRosterModal(false)}
                style={{ background: '#334155', border: 'none', color: '#fff', borderRadius: '50%', width: '30px', height: '30px', fontWeight: 900 }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {myManager?.cards.map((c, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1e293b',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: `1px solid ${c.accentColor || '#334155'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PlayerAvatar url={c.photoUrl} name={c.name} flag={c.countryFlag} size={36} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800 }}>{c.name}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                        {c.countryFlag} {c.club} • {c.specificRole}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#f59e0b' }}>{c.ovr}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>{c.position}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: PHASE 2 - TACTICS (FIFA FUT SQUAD BUILDER STİLİ)
  // ==========================================
  if (snapshot.phase === 'TACTICS') {
    const formationSlots = getFormationSlots(selectedFormation);
    const myCards = myManager?.cards || [];
    const cardMap = new Map<string, PlayerCard>();
    myCards.forEach((c) => cardMap.set(c.id, c));

    // Canlı Sinerji Hesaplaması
    const tempTactics: ManagerTactics = {
      formation: selectedFormation,
      playstyle: selectedPlaystyle,
      defensiveLine: selectedDefLine,
      lineup,
      isReady: tacticsConfirmed,
      allOutAttack: false
    };
    const liveSynergy = calculateTeamSynergy(tempTactics, myCards);

    const allManagersList = Object.values(snapshot.managers);
    const rivalManager = allManagersList.find((m) => m.sessionId !== playerId);
    const rivalTactics = rivalManager ? snapshot.managerTactics[rivalManager.sessionId] : null;

    const activeSlot = selectedSlotIndex !== null ? formationSlots.find((s) => s.slotIndex === selectedSlotIndex) : null;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#070d18',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Üst Başlık & Kalan Süre */}
        <div style={{
          background: 'linear-gradient(180deg, #0f172a, #070d18)',
          padding: '8px 14px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 800, letterSpacing: '0.05em' }}>
              FIFA FUT KADRO KURUCU
            </div>
            <div style={{ fontSize: '14px', fontWeight: 900 }}>DİZİLİŞ & OYUNCU YERLEŞİMİ</div>
          </div>
          <div style={{
            background: snapshot.phaseTimeLeft <= 5 ? '#ef4444' : '#1e293b',
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 900,
            color: '#facc15',
            border: '1px solid #334155'
          }}>
            ⏱️ {snapshot.phaseTimeLeft}s
          </div>
        </div>

        {/* Canlı Takım Reyting ve Kimya Göstergesi */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          padding: '6px 10px',
          background: '#090e1a',
          borderBottom: '1px solid #1e293b',
          fontSize: '11px',
          textAlign: 'center'
        }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '9px' }}>HÜCUM</span>
            <div style={{ fontWeight: 900, color: '#38bdf8' }}>{liveSynergy.attack}</div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '9px' }}>ORTA SAHA</span>
            <div style={{ fontWeight: 900, color: '#38bdf8' }}>{liveSynergy.midfield}</div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '9px' }}>SAVUNMA</span>
            <div style={{ fontWeight: 900, color: '#38bdf8' }}>{liveSynergy.defense}</div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '9px' }}>KİMYA</span>
            <div style={{ fontWeight: 900, color: '#10b981' }}>%{liveSynergy.chemistry}</div>
          </div>
        </div>

        {/* Taktik Ayarları: Formasyon, Oyun Stili & Çizgi */}
        <div style={{ padding: '6px 10px', background: '#0b1120', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Formasyon Butonları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'] as FormationType[]).map((f) => (
              <button
                key={f}
                disabled={tacticsConfirmed}
                onClick={() => handleSelectFormation(f)}
                style={{
                  background: selectedFormation === f ? '#0284c7' : '#1e293b',
                  color: '#fff',
                  border: selectedFormation === f ? '1.5px solid #38bdf8' : '1px solid #334155',
                  padding: '5px 2px',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Oyun Stili & Savunma Çizgisi Seçicileri */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <select
              disabled={tacticsConfirmed}
              value={selectedPlaystyle}
              onChange={(e) => handleSelectPlaystyle((e.target as HTMLSelectElement).value as PlaystyleType)}
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 6px',
                fontSize: '10px',
                fontWeight: 700
              }}
            >
              <option value="balanced">⚖️ Stil: Dengeli</option>
              <option value="possession">🎯 Stil: Topa Sahip Olma</option>
              <option value="counter">⚡ Stil: Kontra Atak</option>
              <option value="high_press">🔥 Stil: Yüksek Pres</option>
            </select>

            <select
              disabled={tacticsConfirmed}
              value={selectedDefLine}
              onChange={(e) => handleSelectDefLine((e.target as HTMLSelectElement).value as DefensiveLineType)}
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 6px',
                fontSize: '10px',
                fontWeight: 700
              }}
            >
              <option value="balanced">⚖️ Hat: Dengeli</option>
              <option value="low">🛡️ Hat: Alçak Savunma</option>
              <option value="high">⚔️ Hat: Yüksek Savunma</option>
            </select>
          </div>
        </div>

        {/* ═══ 2D FUT FUTBOL SAHASI & 11 POZİSYON SLOTU ═══ */}
        <div style={{
          flex: 1,
          margin: '6px 10px',
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #1e3a1e 0%, #152d15 100%)',
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)'
        }}>
          {/* Saha Çizgileri */}
          <div style={{ position: 'absolute', inset: '4px', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: '8px', pointerEvents: 'none' }} />
          {/* Orta Saha Çizgisi & Çemberi */}
          <div style={{ position: 'absolute', top: '50%', left: '4px', right: '4px', height: '1.5px', background: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.25)',
            pointerEvents: 'none'
          }} />
          {/* Ceza Sahaları */}
          <div style={{ position: 'absolute', top: '4px', left: '25%', right: '25%', height: '35px', border: '1.5px solid rgba(255,255,255,0.25)', borderTop: 'none', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '4px', left: '25%', right: '25%', height: '35px', border: '1.5px solid rgba(255,255,255,0.25)', borderBottom: 'none', pointerEvents: 'none' }} />

          {/* 11 Futbolcu Kart Yuvaları */}
          {formationSlots.map((slot) => {
            const assignedCardId = lineup[slot.slotIndex];
            const assignedCard = assignedCardId ? cardMap.get(assignedCardId) : undefined;
            const affinity = assignedCard ? checkPositionAffinity(slot.requiredPosition, assignedCard.position) : 1;
            const isSelected = selectedSlotIndex === slot.slotIndex;

            return (
              <div
                key={slot.slotIndex}
                onClick={() => handleSlotClick(slot.slotIndex)}
                style={{
                  position: 'absolute',
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: tacticsConfirmed ? 'default' : 'pointer',
                  zIndex: isSelected ? 20 : 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                {assignedCard ? (
                  /* Atanmış Kart Düğümü (Mini FUT Kartı) */
                  <div style={{
                    width: '44px',
                    height: '56px',
                    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                    border: isSelected
                      ? '2.5px solid #facc15'
                      : (affinity === 1 ? '1.5px solid #10b981' : (affinity >= 0.75 ? '1.5px solid #f59e0b' : '1.5px solid #ef4444')),
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px',
                    boxShadow: isSelected ? '0 0 15px #facc15' : '0 2px 6px rgba(0,0,0,0.5)',
                    transition: 'all 0.2s ease'
                  }}>
                    {/* Kart Üst Başlık (OVR ve Rol) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{assignedCard.ovr}</span>
                      <span style={{ fontSize: '8px', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{slot.role}</span>
                    </div>

                    {/* Resim */}
                    <PlayerAvatar url={assignedCard.photoUrl} name={assignedCard.name} flag={assignedCard.countryFlag} size={28} />

                    {/* İsim */}
                    <div style={{
                      fontSize: '7.5px',
                      fontWeight: 800,
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '40px',
                      textAlign: 'center',
                      lineHeight: 1
                    }}>
                      {assignedCard.shortName || assignedCard.name}
                    </div>
                  </div>
                ) : (
                  /* Boş Slot Düğümü */
                  <div style={{
                    width: '42px',
                    height: '52px',
                    borderRadius: '8px',
                    border: '1.5px dashed rgba(255,255,255,0.4)',
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px'
                  }}>
                    <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 900 }}>+</span>
                    <span style={{ fontSize: '8px', fontWeight: 800, color: '#cbd5e1' }}>{slot.role}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Onay Butonu & Rakip Hazır Durumu */}
        <div style={{ padding: '8px 12px', background: '#090d16', borderTop: '1px solid #1e293b' }}>
          {rivalManager && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              fontSize: '11px',
              fontWeight: 800,
              padding: '6px 10px',
              background: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #1e293b'
            }}>
              <span style={{ color: tacticsConfirmed ? '#10b981' : '#f59e0b' }}>
                {tacticsConfirmed ? '✅ Siz: Hazırsınız' : '⏳ Siz: Taktik Ayarlıyor'}
              </span>
              <span style={{ color: rivalTactics?.isReady ? '#10b981' : '#94a3b8' }}>
                {rivalTactics?.isReady ? `✅ ${rivalManager.nickname}: Hazır` : `⏳ ${rivalManager.nickname}: Ayarlıyor...`}
              </span>
            </div>
          )}
          <button
            onClick={handleConfirmTactics}
            disabled={tacticsConfirmed}
            style={{
              width: '100%',
              background: tacticsConfirmed ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              border: 'none',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 900,
              cursor: tacticsConfirmed ? 'default' : 'pointer'
            }}
          >
            {tacticsConfirmed
              ? (rivalTactics?.isReady ? '🔥 Her İki Menajer Hazır! Maç Başlıyor...' : 'Kadro Onaylandı! Rakip Bekleniyor... ⏳')
              : 'Kadro & Taktiği Onayla ✅'}
          </button>
        </div>

        {/* ═══ FIFA FUT OYUNCU DEĞİŞTİRME / SEÇİM ÇEKMECESİ (DRAWER) ═══ */}
        {activeSlot && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
          }}>
            <div style={{
              background: '#0f172a',
              borderTop: '2px solid #38bdf8',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '14px',
              maxHeight: '65%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 800 }}>MEVKİ SEÇİMİ</div>
                  <div style={{ fontSize: '15px', fontWeight: 900 }}>
                    {activeSlot.role} ({activeSlot.requiredPosition}) İçin Futbolcu Seçin
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSlotIndex(null)}
                  style={{ background: '#334155', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', fontWeight: 900 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {myCards.map((c) => {
                  const affinity = checkPositionAffinity(activeSlot.requiredPosition, c.position);
                  const isCurrent = lineup[activeSlot.slotIndex] === c.id;
                  const currentSlotOfPlayer = Object.keys(lineup).find((k) => lineup[Number(k)] === c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleAssignPlayerToSlot(c.id)}
                      style={{
                        background: isCurrent ? '#064e3b' : '#1e293b',
                        border: isCurrent ? '1.5px solid #10b981' : '1px solid #334155',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <PlayerAvatar url={c.photoUrl} name={c.name} flag={c.countryFlag} size={36} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: '#f59e0b' }}>{c.ovr}</span>
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8' }}>{c.position}</span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{c.name}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {c.countryFlag} {c.club}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: affinity === 1 ? '#10b981' : (affinity >= 0.75 ? '#f59e0b' : '#ef4444')
                        }}>
                          {affinity === 1 ? 'Tam Uyum %100' : (affinity >= 0.75 ? 'Yakın Mevki %75' : 'Ters Mevki %20')}
                        </div>
                        {isCurrent ? (
                          <span style={{ fontSize: '9px', color: '#34d399', fontWeight: 800 }}>Şu anki oyuncu</span>
                        ) : currentSlotOfPlayer !== undefined ? (
                          <span style={{ fontSize: '9px', color: '#facc15', fontWeight: 800 }}>Takas Et</span>
                        ) : (
                          <span style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 800 }}>Yerleştir</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: PHASE 3 - MATCH (FOOTBALL MANAGER - FM STİLİ)
  // ==========================================
  if (snapshot.phase === 'MATCH_FIRST_HALF' || snapshot.phase === 'MATCH_SECOND_HALF' || snapshot.phase === 'HALFTIME') {
    const isLateGame = snapshot.currentMinute >= 75;
    const managers = Object.values(snapshot.managers || {});
    const m0 = managers.find((m) => m.teamIndex === 0) || managers[0];
    const m1 = managers.find((m) => m.teamIndex === 1) || managers[1];

    const currentScore = snapshot.matchScore || [0, 0];

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#070d18',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden'
      }}>
        {/* FM TV Scoreboard Header */}
        <div style={{
          background: 'linear-gradient(180deg, #0b1120, #070d18)',
          padding: '12px 16px',
          borderBottom: '2px solid #1e293b'
        }}>
          {/* FM Digital Match Clock */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>CANLI MAÇ MERKEZİ</span>
            </div>
            <div style={{
              background: '#0284c725',
              border: '1px solid #0284c760',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 900,
              color: '#38bdf8'
            }}>
              {snapshot.phase === 'HALFTIME' ? 'DEVRE ARASI (45\')' : `${snapshot.currentMinute}' : 00"`}
            </div>
          </div>

          {/* Skor */}
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8' }}>{m0?.nickname || 'TAKIM A'}</div>
              <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1, marginTop: '2px' }}>{currentScore[0]}</div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#475569' }}>VS</div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#f59e0b' }}>{m1?.nickname || 'TAKIM B'}</div>
              <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1, marginTop: '2px' }}>{currentScore[1]}</div>
            </div>
          </div>
        </div>

        {/* FM Live Momentum & Statistics */}
        <div style={{ padding: '10px 14px', background: '#090e1a', borderBottom: '1px solid #1e293b' }}>
          {/* Topla Oynama */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, marginBottom: '3px' }}>
            <span style={{ color: '#38bdf8' }}>%{snapshot.matchStats ? snapshot.matchStats.possession[0] : 50}</span>
            <span style={{ color: '#94a3b8', fontSize: '9px' }}>TOPLA OYNAMA</span>
            <span style={{ color: '#f59e0b' }}>%{snapshot.matchStats ? snapshot.matchStats.possession[1] : 50}</span>
          </div>
          <div style={{ height: '5px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
            <div style={{ width: `${snapshot.matchStats ? snapshot.matchStats.possession[0] : 50}%`, background: '#38bdf8' }} />
            <div style={{ width: `${snapshot.matchStats ? snapshot.matchStats.possession[1] : 50}%`, background: '#f59e0b' }} />
          </div>

          {/* xG Beklenen Gol */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
            <span style={{ color: '#38bdf8' }}>xG: {snapshot.matchStats ? snapshot.matchStats.xg[0] : '0.00'}</span>
            <span style={{ color: '#94a3b8', fontSize: '9px' }}>BEKLENEN GOL (xG)</span>
            <span style={{ color: '#f59e0b' }}>xG: {snapshot.matchStats ? snapshot.matchStats.xg[1] : '0.00'}</span>
          </div>
        </div>

        {/* FM Play-by-Play Spiker ve Olay Akışı */}
        <div style={{ flex: 1, padding: '12px 14px', overflowY: 'auto' }}>
          {snapshot.currentHighlight ? (
            <div style={{
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '2px solid #38bdf8',
              borderRadius: '12px',
              padding: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  background: snapshot.currentHighlight.type === 'GOAL' ? '#10b981' : (snapshot.currentHighlight.type === 'SAVE' ? '#2563eb' : '#f59e0b'),
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {snapshot.currentHighlight.type === 'GOAL' ? '⚽ GOOOL!' : (snapshot.currentHighlight.type === 'SAVE' ? '🧤 KURTARIŞ' : '💥 POZİSYON')}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
                  Dakika {snapshot.currentHighlight.minute}'
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.3 }}>
                {snapshot.currentHighlight.commentary}
              </div>
              {snapshot.currentHighlight.subText && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  {snapshot.currentHighlight.subText}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
              Pozisyon gelişiyor...
            </div>
          )}

          {/* Devre Arası Taktik Ayarları */}
          {snapshot.phase === 'HALFTIME' && (
            <div style={{
              background: '#1e293b',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid #f59e0b',
              marginTop: '10px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#f59e0b', marginBottom: '6px' }}>
                ☕ SOYUNMA ODASI TALİMATI (Kalan: {snapshot.phaseTimeLeft}s)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                {(['balanced', 'possession', 'counter', 'high_press'] as PlaystyleType[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedPlaystyle(st)}
                    style={{
                      background: selectedPlaystyle === st ? '#10b981' : '#0f172a',
                      color: '#fff',
                      border: 'none',
                      padding: '6px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 800
                    }}
                  >
                    {st.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={handleHalftimeAdjustment}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 900
                }}
              >
                2. Yarı Talimatını Ver 🚀
              </button>
            </div>
          )}
        </div>

        {/* FM Dug-out Menajer Taktik Seslenişleri */}
        <div style={{
          background: '#0b1120',
          padding: '10px 14px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            FM KULÜBE TALİMATLARI (DUG-OUT SHOUTS)
          </div>

          {activeDugoutShout && (
            <div style={{
              background: '#0284c725',
              border: '1px solid #0284c7',
              color: '#38bdf8',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 800,
              textAlign: 'center'
            }}>
              📣 Takıma iletildi: "{activeDugoutShout}"
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <button
              onClick={() => handleDugoutShout('Daha Fazla Baskı!')}
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                padding: '8px 4px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              🔥 Daha Fazla Baskı
            </button>
            <button
              onClick={() => handleDugoutShout('Hücuma Çıkın!')}
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                padding: '8px 4px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ⚔️ Hücuma Çıkın
            </button>
            <button
              onClick={() => handleDugoutShout('Sakin Kalın / Pas Yapın!')}
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                padding: '8px 4px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              🎯 Sakin Kalın
            </button>
          </div>

          {/* Son 15 Dakika: Agresif Oyna Butonu */}
          {snapshot.phase === 'MATCH_SECOND_HALF' && isLateGame && (
            <button
              onClick={handleAllOutAttack}
              disabled={allOutUsed}
              style={{
                marginTop: '4px',
                width: '100%',
                background: allOutUsed
                  ? '#334155'
                  : 'linear-gradient(135deg, #dc2626, #991b1b)',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: allOutUsed ? 'none' : '0 0 15px rgba(220, 38, 38, 0.5)'
              }}
            >
              {allOutUsed ? '🔥 TÜM HATLARIYLA HÜCUM DEVREDE!' : '🚨 TÜM HATLARIYLA HÜCUM ET!'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: PHASE 4 - ANALYSIS (MAÇ ANALİZİ)
  // ==========================================
  if (snapshot.phase === 'ANALYSIS' && snapshot.matchStats) {
    const stats = snapshot.matchStats;
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090d16',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '16px',
        overflowY: 'auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800 }}>DÜELLO TAMAMLANDI</div>
          <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: 900 }}>MAÇ ANALİZİ</h2>
          <div style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
            {stats.score[0]} - {stats.score[1]}
          </div>
        </div>

        {/* Maçın Adamı (MVP) */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          borderRadius: '12px',
          padding: '12px',
          border: '1px solid #eab308',
          marginBottom: '14px'
        }}>
          <div style={{ fontSize: '11px', color: '#eab308', fontWeight: 800 }}>🏆 MAÇIN ADAMI (MVP)</div>
          <div style={{ fontSize: '18px', fontWeight: 900, marginTop: '2px' }}>
            {stats.mvp.name} ({stats.mvp.rating})
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            {stats.mvp.reason}
          </div>
        </div>

        {/* İstatistik Çubukları */}
        <div style={{
          background: '#0f172a',
          borderRadius: '12px',
          padding: '12px',
          border: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>%{stats.possession[0]}</span>
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>TOPLA OYNAMA</span>
            <span>%{stats.possession[1]}</span>
          </div>
          <div style={{ height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '12px' }}>
            <div style={{ width: `${stats.possession[0]}%`, background: '#38bdf8' }} />
            <div style={{ width: `${stats.possession[1]}%`, background: '#f59e0b' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>{stats.xg[0]}</span>
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>BEKLENEN GOL (xG)</span>
            <span>{stats.xg[1]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>{stats.shots[0]} ({stats.shotsOnTarget[0]})</span>
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>ŞUT (İSABET)</span>
            <span>{stats.shots[1]} ({stats.shotsOnTarget[1]})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>{stats.saves[0]}</span>
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>KURTARIŞ</span>
            <span>{stats.saves[1]}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', color: '#fff', textAlign: 'center' }}>
      Transfer Showdown Yükleniyor...
    </div>
  );
}
