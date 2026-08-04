import React from 'react'

// Stili locali (duplicati da ProfitTrackerClient.jsx per rendere questo file autonomo)
const panelTitle = { margin: 0, color: '#f8fafc', fontSize: 22 }
const panelSubtitle = { margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }
const primaryButtonGreen = { border: 'none', background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: '#f8fafc', fontWeight: 800, padding: '12px 16px', borderRadius: 14, cursor: 'pointer' }
const input = { width: '100%', boxSizing: 'border-box', background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 14, padding: '12px 14px', outline: 'none', marginBottom: 12 }

// ==========================================================================
// TAB "Post-it" a pagina intera (activeTab === 'post-it')
// ==========================================================================
export function PostItTab({
  postItNotes,
  nuovoPostIt,
  setNuovoPostIt,
  postItEditingId,
  postItEditText,
  setPostItEditText,
  addPostIt,
  togglePostIt,
  deletePostIt,
  startEditPostIt,
  cancelEditPostIt,
  saveEditPostIt,
}) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={panelTitle}>📌 Post-it — Cose da fare</h2>
      <p style={panelSubtitle}>Appunti veloci, tipo post-it attaccato allo schermo. Spunta quando fatto, elimina quando non ti serve più.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          type='text'
          value={nuovoPostIt}
          onChange={(e) => setNuovoPostIt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addPostIt() }}
          placeholder='Scrivi qualcosa da ricordare per domani...'
          style={{ ...input, flex: 1 }}
        />
        <button style={primaryButtonGreen} onClick={addPostIt}>+ Aggiungi</button>
      </div>

      {postItNotes.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>Nessun post-it. Scrivine uno qui sopra.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {postItNotes.map((nota) => (
            <div key={nota.id} style={{
              background: nota.fatto ? 'rgba(100,116,139,0.12)' : 'linear-gradient(160deg, #fde68a, #fbbf24)',
              border: nota.fatto ? '1px solid rgba(100,116,139,0.3)' : '1px solid rgba(217,119,6,0.4)',
              borderRadius: 8,
              padding: '16px 14px',
              minHeight: 110,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: nota.fatto ? 'none' : '0 4px 12px rgba(251,191,36,0.15)',
              transform: nota.fatto ? 'none' : 'rotate(-1deg)'
            }}>
              {postItEditingId === nota.id ? (
                <>
                  <textarea
                    value={postItEditText}
                    onChange={(e) => setPostItEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditPostIt(nota.id) } if (e.key === 'Escape') cancelEditPostIt() }}
                    autoFocus
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(217,119,6,0.5)', background: 'rgba(255,255,255,0.7)', color: '#1c1917', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
                    <button onClick={cancelEditPostIt} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(28,25,23,0.15)', color: '#1c1917' }}>Annulla</button>
                    <button onClick={() => saveEditPostIt(nota.id)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.25)', color: '#15803d' }}>Salva</button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    onClick={() => startEditPostIt(nota)}
                    title='Click per modificare'
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: nota.fatto ? '#64748b' : '#1c1917',
                      textDecoration: nota.fatto ? 'line-through' : 'none',
                      cursor: 'text',
                      wordBreak: 'break-word'
                    }}
                  >
                    {nota.testo}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <button
                      onClick={() => togglePostIt(nota.id, nota.fatto)}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: nota.fatto ? 'rgba(34,197,94,0.15)' : 'rgba(28,25,23,0.15)',
                        color: nota.fatto ? '#22c55e' : '#1c1917'
                      }}
                    >
                      {nota.fatto ? '✓ Fatto' : 'Segna come fatto'}
                    </button>
                    <button
                      onClick={() => deletePostIt(nota.id)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==========================================================================
// WIDGET FLOTTANTE — visibile su tutte le tab, trascinabile
// ==========================================================================
export function PostItFloatingWidget({
  postItFloatPos,
  postItMinimized,
  postItDragging,
  postItNotes,
  nuovoPostIt,
  setNuovoPostIt,
  postItEditingId,
  postItEditText,
  setPostItEditText,
  addPostIt,
  togglePostIt,
  deletePostIt,
  startEditPostIt,
  cancelEditPostIt,
  saveEditPostIt,
  startPostItDrag,
  togglePostItMinimized,
}) {
  return (
    <div style={{
      position: 'fixed',
      left: postItFloatPos.x != null ? postItFloatPos.x : 'auto',
      top: postItFloatPos.y != null ? postItFloatPos.y : 'auto',
      right: postItFloatPos.x != null ? 'auto' : 24,
      bottom: postItFloatPos.y != null ? 'auto' : 170,
      zIndex: 2500,
      width: postItMinimized ? 'auto' : 240,
      background: 'linear-gradient(160deg, #fde68a, #fbbf24)',
      border: '1px solid rgba(217,119,6,0.5)',
      borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      userSelect: postItDragging ? 'none' : 'auto'
    }}>
      <div
        onMouseDown={startPostItDrag}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '8px 10px', cursor: postItDragging ? 'grabbing' : 'grab',
          borderBottom: postItMinimized ? 'none' : '1px solid rgba(217,119,6,0.35)'
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1c1917' }}>
          📌 {postItMinimized ? (postItNotes.filter(n => !n.fatto).length || '') : 'Post-it'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={togglePostItMinimized}
            style={{ fontSize: 11, fontWeight: 800, border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', background: 'rgba(28,25,23,0.15)', color: '#1c1917' }}
            title={postItMinimized ? 'Espandi' : 'Riduci'}
          >
            {postItMinimized ? '▢' : '—'}
          </button>
        </div>
      </div>

      {!postItMinimized && (
        <div style={{ padding: 10, maxHeight: 320, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type='text'
              value={nuovoPostIt}
              onChange={(e) => setNuovoPostIt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addPostIt() }}
              placeholder='Nuovo post-it...'
              style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(217,119,6,0.4)', background: 'rgba(255,255,255,0.5)', color: '#1c1917', outline: 'none' }}
            />
            <button onClick={addPostIt} style={{ fontSize: 12, fontWeight: 800, border: 'none', borderRadius: 6, padding: '6px 9px', cursor: 'pointer', background: '#1c1917', color: '#fde68a' }}>+</button>
          </div>

          {postItNotes.length === 0 ? (
            <div style={{ fontSize: 12, color: '#78350f', textAlign: 'center', padding: '8px 0' }}>Nessun post-it</div>
          ) : (
            postItNotes.map(nota => (
              <div key={nota.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 4px',
                borderBottom: '1px solid rgba(217,119,6,0.2)'
              }}>
                {postItEditingId === nota.id ? (
                  <>
                    <input
                      type='text'
                      value={postItEditText}
                      onChange={(e) => setPostItEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditPostIt(nota.id); if (e.key === 'Escape') cancelEditPostIt() }}
                      autoFocus
                      style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 5, border: '1px solid rgba(217,119,6,0.5)', background: 'rgba(255,255,255,0.7)', color: '#1c1917', outline: 'none' }}
                    />
                    <button onClick={() => saveEditPostIt(nota.id)} style={{ fontSize: 10, border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', background: 'rgba(34,197,94,0.25)', color: '#15803d', flexShrink: 0 }}>✓</button>
                    <button onClick={cancelEditPostIt} style={{ fontSize: 10, border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', background: 'rgba(100,116,139,0.25)', color: '#334155', flexShrink: 0 }}>✕</button>
                  </>
                ) : (
                  <>
                    <input type='checkbox' checked={!!nota.fatto} onChange={() => togglePostIt(nota.id, nota.fatto)} style={{ marginTop: 3, cursor: 'pointer' }} />
                    <span
                      onClick={() => startEditPostIt(nota)}
                      title='Click per modificare'
                      style={{
                        flex: 1, fontSize: 12, color: nota.fatto ? '#a8a29e' : '#1c1917',
                        textDecoration: nota.fatto ? 'line-through' : 'none', wordBreak: 'break-word', cursor: 'text'
                      }}
                    >
                      {nota.testo}
                    </span>
                    <button onClick={() => deletePostIt(nota.id)} style={{ fontSize: 10, border: 'none', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', background: 'rgba(239,68,68,0.2)', color: '#b91c1c', flexShrink: 0 }}>✕</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
