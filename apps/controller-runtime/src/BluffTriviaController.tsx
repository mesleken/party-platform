import { useState, useEffect } from 'preact/hooks';
import type { ControllerSDK } from '@platform/sdk-controller';
import type {
  BluffTriviaMatchStateType,
  PlayerStateType,
  BluffChoiceEntityType,
  BluffRevealEntityType
} from '@platform/sdk-core';

interface BluffTriviaControllerProps {
  sdk: ControllerSDK;
  myNickname: string;
  myPlayer?: PlayerStateType;
  matchState?: BluffTriviaMatchStateType;
  totalScore: number;
  tick?: number;
}

/**
 * Türkçe baş harf büyütme / Title Case formatlayıcı
 * Örn: "istanbul" -> "İstanbul", "ANKARA" -> "Ankara", "bAŞ HARFİ" -> "Baş Harfi"
 */
function formatTurkishTitleCase(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .map((word) => {
      if (!word) return '';
      const first = word.charAt(0).toLocaleUpperCase('tr-TR');
      const rest = word.slice(1).toLocaleLowerCase('tr-TR');
      return first + rest;
    })
    .join(' ');
}

export function BluffTriviaController({
  sdk,
  myNickname,
  myPlayer,
  matchState,
  totalScore
}: BluffTriviaControllerProps) {
  const [inputText, setInputText] = useState('');
  const [localError, setLocalError] = useState('');
  const [lastRound, setLastRound] = useState(1);

  // Round değiştikçe girdi kutusunu ve hataları sıfırla
  useEffect(() => {
    if (matchState?.round && matchState.round !== lastRound) {
      setLastRound(matchState.round);
      setInputText('');
      setLocalError('');
    }
  }, [matchState?.round, lastRound]);

  // Server'dan gelen blöf hatalarını (mükerrerlik, gerçek cevap vb.) dinle
  useEffect(() => {
    sdk.onBluffError = (errMsg: string) => {
      setLocalError(errMsg);
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    };
    sdk.onBluffSuccess = () => {
      setLocalError('');
    };
    return () => {
      sdk.onBluffError = () => {};
      sdk.onBluffSuccess = () => {};
    };
  }, [sdk]);

  const handleSendBluff = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    const formatted = formatTurkishTitleCase(inputText);
    if (!formatted) {
      setLocalError('Lütfen bir cevap yazın.');
      return;
    }
    if (formatted.length < 2) {
      setLocalError('Cevap en az 2 karakter olmalıdır.');
      return;
    }
    if (formatted.length > 70) {
      setLocalError('Cevap en fazla 70 karakter olabilir.');
      return;
    }

    if (navigator.vibrate) {
      navigator.vibrate(40);
    }
    setInputText(formatted);
    setLocalError('');
    sdk.submitBluff(formatted);
  };

  const handleVote = (choiceId: string, isMyBluff: boolean) => {
    if (isMyBluff || myPlayer?.hasVotedBluff) return;

    if (navigator.vibrate) {
      navigator.vibrate(40);
    }
    sdk.voteBluff(choiceId);
  };

  if (!matchState) {
    return (
      <div class="container">
        <h2>Oyun Yükleniyor...</h2>
      </div>
    );
  }

  const phase = matchState.phase;
  const timeLeft = Math.max(0, matchState.timeLeft || 0);

  // Arkadaş Modunda konu olan oyuncu mu kontrolü
  const isSubjectPlayer = Boolean(
    matchState.isFriendsMode &&
    matchState.subjectPlayerId &&
    (myPlayer?.id === matchState.subjectPlayerId || myNickname === matchState.subjectPlayerName)
  );

  // Choices list
  const choicesArray: BluffChoiceEntityType[] = [];
  if (matchState.choices) {
    matchState.choices.forEach((c) => choicesArray.push(c));
  }

  // Reveals list
  const revealsArray: BluffRevealEntityType[] = [];
  if (matchState.reveals) {
    matchState.reveals.forEach((r) => revealsArray.push(r));
  }

  // ─── 1. SUBMITTING EVRESİ (BLÖF VEYA GERÇEK CEVAP YAZMA) ───
  if (phase === 'submitting') {
    const isSubmitted = Boolean(myPlayer?.bluffSubmitted);

    return (
      <div class="container" style={{ padding: '1rem', justifyContent: 'flex-start', overflowY: 'auto' }}>
        {/* Top Status Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '420px',
            marginBottom: '0.8rem',
            color: '#94a3b8',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          <span
            style={{
              background: matchState.isFriendsMode ? '#ec4899' : '#8b5cf6',
              color: 'white',
              padding: '0.2rem 0.7rem',
              borderRadius: '1rem',
              fontSize: '0.85rem'
            }}
          >
            {matchState.isFriendsMode
              ? '🌟 ARKADAŞ MODU'
              : matchState.questionCategory || 'GENEL KÜLTÜR'}
          </span>
          <span>ROUND {matchState.round} / {matchState.totalRounds}</span>
          <span style={{ color: timeLeft <= 5 ? '#ef4444' : '#38bdf8', fontSize: '1.2rem', fontWeight: 900 }}>
            ⏱️ {timeLeft}s
          </span>
        </div>

        {/* Özel Arkadaş Modu Bilgilendirme Rozeti */}
        {matchState.isFriendsMode && (
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: isSubjectPlayer
                ? 'linear-gradient(135deg, #ec4899, #be185d)'
                : 'rgba(236, 72, 153, 0.15)',
              border: '2px solid #ec4899',
              borderRadius: '0.8rem',
              padding: '0.6rem 0.8rem',
              marginBottom: '0.8rem',
              textAlign: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.95rem'
            }}
          >
            {isSubjectPlayer ? (
              <div>
                👑 <strong>BU SORU SENİN HAKKINDA!</strong>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, marginTop: '0.2rem' }}>
                  Lütfen <strong>GERÇEK</strong> cevabını yaz. Arkadaşların seni taklit etmeye çalışacak!
                </div>
              </div>
            ) : (
              <div>
                🎭 <strong>{matchState.subjectPlayerName || 'Arkadaşın'}</strong> hakkında soru!
                <div style={{ fontSize: '0.85rem', fontWeight: 500, marginTop: '0.2rem' }}>
                  Onun vereceği gerçek cevabı taklit eden bir blöf yaz!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Soru Kartı */}
        <div
          style={{
            background: '#1e293b',
            border: '2px solid #334155',
            borderRadius: '1rem',
            padding: '1rem 1.2rem',
            width: '100%',
            maxWidth: '420px',
            marginBottom: '1rem',
            textAlign: 'center'
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 600 }}>
            SORU
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.3 }}>
            {matchState.questionText}
          </div>
        </div>

        {isSubmitted ? (
          <div class="success-box" style={{ width: '100%', maxWidth: '420px', marginTop: '0.5rem' }}>
            {isSubjectPlayer ? '✓ GERÇEK CEVABIN ALINDI!' : '✓ BLÖFÜN ALINDI!'}
            <div style={{ fontSize: '1.2rem', marginTop: '0.6rem', color: '#f8fafc', fontStyle: 'italic', fontWeight: 700 }}>
              "{myPlayer?.bluffAnswer}"
            </div>
            <div style={{ fontSize: '0.95rem', marginTop: '0.8rem', color: '#cbd5e1' }}>
              Diğer oyuncuların yazması bekleniyor... ({matchState.submittedCount} / {matchState.totalPlayersCount} hazır)
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>
              {isSubjectPlayer
                ? 'Bakalım arkadaşların seni ne kadar iyi tanıyor? 😉'
                : 'Bakalım senin blöfüne kimler kanacak? 😉'}
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ color: '#facc15', fontSize: '1.05rem', fontWeight: 700, textAlign: 'left' }}>
              {isSubjectPlayer
                ? 'Gerçek cevabını yaz:'
                : 'İnandırıcı bir sahte cevap yaz:'}
            </div>

            <textarea
              rows={3}
              value={inputText}
              placeholder={
                isSubjectPlayer
                  ? 'Gerçek cevabını buraya yaz (örn: Mavi, 2 Kedi)...'
                  : 'Örn: Diğer oyuncuların gerçek sanacağı bir cevap...'
              }
              onInput={(e) => {
                setInputText(e.currentTarget.value);
                if (localError) setLocalError('');
              }}
              style={{
                width: '100%',
                padding: '0.9rem',
                borderRadius: '0.75rem',
                border: localError ? '2px solid #ef4444' : '2px solid #334155',
                background: '#1e293b',
                color: 'white',
                fontSize: '1.15rem',
                fontFamily: 'inherit',
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />

            {/* Hata Uyarısı Kutusu (Gerçek Cevap Engeli / Mükerrer Cevap) */}
            {localError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '2px solid #ef4444',
                  borderRadius: '0.75rem',
                  padding: '0.8rem',
                  color: '#fca5a5',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textAlign: 'left',
                  animation: 'pulse 1.5s infinite'
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div>{localError}</div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSendBluff}
              style={{
                background: isSubjectPlayer
                  ? 'linear-gradient(135deg, #ec4899, #be185d)'
                  : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.25rem',
                height: '62px',
                borderRadius: '0.8rem',
                margin: '0.3rem 0 0 0',
                boxShadow: isSubjectPlayer
                  ? '0 4px 15px rgba(236, 72, 153, 0.4)'
                  : '0 4px 15px rgba(139, 92, 246, 0.4)'
              }}
            >
              {isSubjectPlayer ? 'GERÇEK CEVABIMI GÖNDER 👑' : 'BLÖFÜ GÖNDER 🚀'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── 2. VOTING EVRESİ (OYLAMA) ───
  if (phase === 'voting') {
    const hasVoted = Boolean(myPlayer?.hasVotedBluff);
    const myBluffClean = (myPlayer?.bluffAnswer || '').trim().toLowerCase();

    // Özel Arkadaş Modunda konu olan oyuncu oy kullanmaz, izler
    if (isSubjectPlayer) {
      return (
        <div class="container" style={{ padding: '1rem', justifyContent: 'flex-start' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              maxWidth: '420px',
              marginBottom: '0.8rem',
              color: '#94a3b8',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}
          >
            <span style={{ background: '#ec4899', color: 'white', padding: '0.2rem 0.7rem', borderRadius: '1rem' }}>
              🌟 ARKADAŞ MODU
            </span>
            <span>ROUND {matchState.round} / {matchState.totalRounds}</span>
            <span style={{ color: timeLeft <= 5 ? '#ef4444' : '#38bdf8', fontSize: '1.2rem', fontWeight: 900 }}>
              ⏱️ {timeLeft}s
            </span>
          </div>

          <div
            style={{
              background: 'rgba(236, 72, 153, 0.15)',
              border: '2px solid #ec4899',
              borderRadius: '1rem',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '420px',
              textAlign: 'center',
              marginTop: '1rem'
            }}
          >
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f472b6' }}>
              👑 BU SORU SENİN HAKKINDA!
            </div>
            <div style={{ fontSize: '1.1rem', color: '#f8fafc', marginTop: '1rem' }}>
              Senin Gerçek Cevabın:
            </div>
            <div style={{ fontSize: '1.5rem', color: '#facc15', fontWeight: 800, marginTop: '0.3rem' }}>
              "{myPlayer?.bluffAnswer}"
            </div>
            <div style={{ fontSize: '1rem', color: '#cbd5e1', marginTop: '1.2rem' }}>
              Arkadaşların senin cevabını tahmin etmeye çalışıyor... ({matchState.votedCount} / {Math.max(1, matchState.totalPlayersCount - 1)} oy)
            </div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.8rem' }}>
              Bakalım kimler seni gerçekten tanıyor, kimler sahte blöflere kanacak? 😉
            </div>
          </div>
        </div>
      );
    }

    return (
      <div class="container" style={{ padding: '1rem', justifyContent: 'flex-start', overflowY: 'auto' }}>
        {/* Top Status Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '420px',
            marginBottom: '0.8rem',
            color: '#94a3b8',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          <span
            style={{
              background: matchState.isFriendsMode ? '#ec4899' : '#8b5cf6',
              color: 'white',
              padding: '0.2rem 0.7rem',
              borderRadius: '1rem'
            }}
          >
            {matchState.isFriendsMode
              ? '🌟 ARKADAŞ MODU'
              : matchState.questionCategory || 'GENEL KÜLTÜR'}
          </span>
          <span>ROUND {matchState.round} / {matchState.totalRounds}</span>
          <span style={{ color: timeLeft <= 5 ? '#ef4444' : '#38bdf8', fontSize: '1.2rem', fontWeight: 900 }}>
            ⏱️ {timeLeft}s
          </span>
        </div>

        {/* Question Display Card */}
        <div
          style={{
            background: '#1e293b',
            border: '2px solid #334155',
            borderRadius: '1rem',
            padding: '0.9rem 1.2rem',
            width: '100%',
            maxWidth: '420px',
            marginBottom: '1rem',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.3 }}>
            {matchState.questionText}
          </div>
        </div>

        {hasVoted ? (
          <div class="success-box" style={{ width: '100%', maxWidth: '420px', marginTop: '1rem' }}>
            ✓ SEÇİMİN KAYDEDİLDİ!
            <div style={{ fontSize: '1.1rem', marginTop: '0.8rem', color: '#cbd5e1' }}>
              Diğer oyuncuların oylaması bekleniyor... ({matchState.votedCount} / {matchState.totalPlayersCount} oy)
            </div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.6rem', opacity: 0.8 }}>
              Sonuçlar ve ifşalar birazdan açıklanacak! 🤞
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem', textAlign: 'left' }}>
              Gerçek cevabı seçin (kendi blöfünüze oy veremezsiniz):
            </div>

            {choicesArray.map((choice) => {
              const isMyBluff = myBluffClean !== '' && choice.text.trim().toLowerCase() === myBluffClean;

              if (isMyBluff) {
                return (
                  <button
                    key={choice.id}
                    disabled
                    type="button"
                    style={{
                      background: '#1e293b',
                      border: '2px dashed #475569',
                      color: '#64748b',
                      borderRadius: '0.8rem',
                      padding: '0.9rem 1rem',
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'not-allowed',
                      opacity: 0.7,
                      margin: 0
                    }}
                  >
                    🔒 {choice.text} <span style={{ fontSize: '0.85rem' }}>(✍️ Senin Blöfün)</span>
                  </button>
                );
              }

              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleVote(choice.id, isMyBluff)}
                  style={{
                    background: '#1e293b',
                    border: '2px solid #38bdf8',
                    color: 'white',
                    borderRadius: '0.8rem',
                    padding: '1rem 1.1rem',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    textAlign: 'left',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                    transition: 'all 0.15s ease',
                    margin: 0
                  }}
                >
                  👉 {choice.text}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── 3. REVEAL EVRESİ (İFŞALAR VE KİM KİMİ KANDIRDI GÖRÜNÜMÜ) ───
  if (phase === 'reveal') {
    // Find what the user voted for
    const myVotedReveal = revealsArray.find((r) => r.id === myPlayer?.votedBluffId);
    const guessedCorrect = Boolean(myVotedReveal?.isCorrect);
    const trickedCount = myPlayer?.trickedCount || 0;
    const isBluffMaster = matchState.bluffMasterName === myNickname && matchState.bluffMasterCount > 0;
    const realChoice = revealsArray.find((r) => r.isCorrect);

    return (
      <div class="container" style={{ padding: '1rem', justifyContent: 'flex-start', overflowY: 'auto' }}>
        <h2 style={{ color: '#facc15', margin: '0 0 0.8rem 0', fontSize: '1.6rem' }}>
          SONUÇLAR VE İFŞALAR! 🎭
        </h2>

        {/* Bluff Master Banner */}
        {isBluffMaster && (
          <div
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              padding: '0.8rem 1rem',
              borderRadius: '0.8rem',
              fontWeight: 900,
              fontSize: '1.15rem',
              marginBottom: '0.8rem',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)'
            }}
          >
            👑 TEBRİKLER! TURUN BLÖF USTASISIN!
          </div>
        )}

        {/* 1. Kişisel Durum Kutusu */}
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '0.8rem' }}>
          {isSubjectPlayer ? (
            <div
              style={{
                background: 'rgba(236, 72, 153, 0.2)',
                border: '2px solid #ec4899',
                borderRadius: '0.8rem',
                padding: '0.9rem',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f472b6' }}>
                👑 Soru Senin Hakkındaydı!
              </div>
              <div style={{ fontSize: '1rem', color: '#f8fafc', marginTop: '0.4rem' }}>
                Gerçek cevabın: <strong>"{myPlayer?.bluffAnswer}"</strong>
              </div>
              <div style={{ fontSize: '1.1rem', color: '#facc15', marginTop: '0.4rem', fontWeight: 800 }}>
                {realChoice && realChoice.votes > 0
                  ? `🎉 ${realChoice.votes} arkadaşın seni doğru bildi! (+${realChoice.votes * 100} Puan)`
                  : '😅 Bu tur kimse senin cevabını bilemedi!'}
              </div>
            </div>
          ) : guessedCorrect ? (
            <div class="success-box" style={{ width: '100%' }}>
              🎉 BİLDİN! Gerçek cevabı buldun!
              <div style={{ fontSize: '1.2rem', color: '#fde047', marginTop: '0.4rem', fontWeight: 800 }}>
                +100 Puan
              </div>
            </div>
          ) : (
            <div class="foul-box" style={{ width: '100%' }}>
              ❌ YANLIŞ!
              <div style={{ fontSize: '1rem', color: '#fca5a5', marginTop: '0.4rem' }}>
                {myVotedReveal
                  ? `Seçtiğin "${myVotedReveal.text}" bir blöftü! (${myVotedReveal.authorName} seni kandırdı)`
                  : 'Bu tur gerçek cevabı seçemedin.'}
              </div>
            </div>
          )}
        </div>

        {/* 2. Kendi Blöfünle Kandırdıkların */}
        {!isSubjectPlayer && (
          <div style={{ width: '100%', maxWidth: '420px', marginBottom: '0.8rem' }}>
            {trickedCount > 0 ? (
              <div
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '2px solid #8b5cf6',
                  borderRadius: '1rem',
                  padding: '0.9rem',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc' }}>
                  😈 {trickedCount} kişiyi kandırdın!
                </div>
                <div style={{ fontSize: '1.15rem', color: '#facc15', marginTop: '0.3rem', fontWeight: 800 }}>
                  +{trickedCount * 150} Puan
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.8rem',
                  padding: '0.7rem',
                  color: '#94a3b8',
                  fontSize: '0.9rem'
                }}
              >
                😅 Bu tur senin blöfüne kimse kanmadı.
              </div>
            )}
          </div>
        )}

        {/* 3. Kim Kimi Kandırdı? Detaylı Liste */}
        <div style={{ width: '100%', maxWidth: '420px', marginTop: '0.5rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'left' }}>
            📋 Kim Kimi Kandırdı? (Tüm Cevaplar)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {revealsArray.map((r) => {
              if (r.isCorrect) {
                return (
                  <div
                    key={r.id}
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '2px solid #22c55e',
                      borderRadius: '0.8rem',
                      padding: '0.8rem',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.85rem' }}>
                      ✓ GERÇEK CEVAP
                    </div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1.15rem', margin: '0.2rem 0' }}>
                      "{r.text}"
                    </div>
                    <div style={{ color: '#86efac', fontSize: '0.85rem' }}>
                      {r.votersList ? `🎉 Doğru Bilenler: ${r.votersList}` : 'Kimse bulamadı'}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={r.id}
                  style={{
                    background: '#1e293b',
                    border: '1.5px solid #475569',
                    borderRadius: '0.8rem',
                    padding: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem' }}>
                    ✍️ {r.authorName}'in Blöfü
                  </div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', margin: '0.2rem 0' }}>
                    "{r.text}"
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                    {r.votes > 0
                      ? `😈 Kananlar (${r.votes}): ${r.votersList}`
                      : '😅 Kimse kanmadı'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Toplam Puan */}
        <div style={{ fontSize: '1.5rem', color: '#facc15', fontWeight: 900, marginTop: '1rem', marginBottom: '0.5rem' }}>
          Toplam Puanın: {totalScore}
        </div>
      </div>
    );
  }

  // ─── 4. ROUND RESULT EVRESİ ───
  if (phase === 'round_result') {
    return (
      <div class="container">
        <h2 style={{ color: '#38bdf8', fontSize: '2rem' }}>
          ROUND {matchState.round} BİTTİ
        </h2>

        <div style={{ fontSize: '1.4rem', color: '#22c55e', margin: '1rem 0', fontWeight: 800 }}>
          Bu Tur Kazancın: +{myPlayer?.roundBluffGains || 0} Puan
        </div>

        <div style={{ fontSize: '2rem', color: '#facc15', margin: '0.5rem 0', fontWeight: 900 }}>
          Toplam Puanın: {totalScore}
        </div>

        <div style={{ color: '#94a3b8', marginTop: '1.5rem', fontSize: '1.1rem' }}>
          Sonraki soru hazırlanıyor...
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <h3>Blöf Oyunu Devam Ediyor...</h3>
    </div>
  );
}
