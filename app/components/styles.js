export const container = { minHeight: '100vh', background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)', color: '#e5eefb', padding: 'clamp(12px, 2.4vw, 24px) clamp(10px, 2vw, 16px) 48px', overflowX: 'hidden' }
export const pageWrap = { maxWidth: 1500, width: '100%', minWidth: 0, margin: '0 auto' }
export const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }
export const title = { margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.05, color: '#f8fafc' }
export const subtitle = { margin: '8px 0 0', color: '#94a3b8', fontSize: 15 }
export const copyrightBox = { border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(15,23,42,0.72)', color: '#cbd5e1', padding: '12px 16px', borderRadius: 16, fontSize: 13, fontWeight: 700 }

export const tabsBar = {
  display: 'flex',
  gap: 10,
  flexWrap: 'nowrap',
  marginBottom: 18,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 4,
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'thin'
}

export const tabButton = {
  background: 'rgba(15,23,42,0.82)',
  color: '#cbd5e1',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 14,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 700,
  flex: '0 0 auto',
  whiteSpace: 'nowrap',
  minHeight: 42
}

export const activeTabButton = {
  ...tabButton,
  background: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(56,189,248,0.16))',
  color: '#f8fafc',
  border: '1px solid rgba(56,189,248,0.5)',
  boxShadow: '0 0 0 1px rgba(56,189,248,0.08) inset'
}

export const successBox = {
  background: 'rgba(34,197,94,0.14)',
  border: '1px solid rgba(34,197,94,0.35)',
  color: '#bbf7d0',
  padding: '12px 14px',
  borderRadius: 14,
  marginBottom: 16,
  fontWeight: 700
}

export const errorBox = {
  background: 'rgba(239,68,68,0.14)',
  border: '1px solid rgba(239,68,68,0.35)',
  color: '#fecaca',
  padding: '12px 14px',
  borderRadius: 14,
  marginBottom: 16,
  fontWeight: 700
}

export const tabContent = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16
}

export const statsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  gap: 14,
  minWidth: 0
}

export const statsGridCompact = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  gap: 14,
  minWidth: 0
}

export const stimeMonthsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(460px, 100%), 1fr))',
  gap: 16,
  alignItems: 'start'
}

export const stimeMonthCard = {
  background: 'linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.99))',
  borderRadius: 20,
  padding: 14,
  boxShadow: '0 20px 48px rgba(0,0,0,0.24)',
  minHeight: 320
}

export const stimeMonthHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid rgba(51,65,85,0.75)'
}

export const stimeMonthTitle = {
  fontSize: 16,
  fontWeight: 900,
  color: '#f8fafc',
  textTransform: 'lowercase'
}

export const stimeMonthTotal = {
  fontSize: 16,
  fontWeight: 900,
  color: '#fde68a',
  whiteSpace: 'nowrap'
}

export const stimeMonthBody = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6
}

export const stimeRow = {
  display: 'grid',
  gridTemplateColumns: 'minmax(140px, 170px) minmax(82px, 95px) minmax(180px, 1fr)',
  gap: 8,
  alignItems: 'center'
}

export const stimeDoneCol = { minWidth: 0 }

export const stimeStatusButtons = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
  width: '100%'
}

export const stimeStatusButton = {
  border: '1px solid rgba(71,85,105,0.95)',
  background: 'rgba(15,23,42,0.82)',
  color: '#e2e8f0',
  fontWeight: 700,
  padding: '6px 8px',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 11,
  width: '100%',
  textAlign: 'center'
}

export const stimeStatusButtonPrevisto = {
  background: 'rgba(59,130,246,0.22)',
  border: '1px solid rgba(59,130,246,0.50)',
  color: '#dbeafe'
}

export const stimeStatusButtonFatto = {
  background: 'rgba(34,197,94,0.22)',
  border: '1px solid rgba(34,197,94,0.50)',
  color: '#dcfce7'
}

export const stimeStatusButtonAnnullato = {
  background: 'rgba(239,68,68,0.22)',
  border: '1px solid rgba(239,68,68,0.50)',
  color: '#fecaca'
}

export const stimeImportoCol = {}
export const stimeVoceCol = {}

export const stimeMiniInput = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0b1220',
  color: '#f8fafc',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 10,
  padding: '7px 8px',
  outline: 'none',
  fontSize: 12
}

export const statCard = {
  background: 'linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.98))',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 20,
  padding: 18,
  boxShadow: '0 18px 44px rgba(0,0,0,0.28)'
}

export const statLabel = {
  fontSize: 13,
  color: '#94a3b8',
  marginBottom: 8,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0.6
}

export const statValue = {
  fontSize: 28,
  color: '#f8fafc',
  fontWeight: 900,
  lineHeight: 1.05
}

export const statSub = {
  marginTop: 8,
  color: '#aab8ce',
  fontSize: 13
}

export const heroGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
  gap: 16,
  minWidth: 0
}

export const heroSideGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 14,
  alignContent: 'start'
}

export const dashboardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
  gap: 16,
  minWidth: 0
}

export const transactionsLayout = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
  gap: 16,
  minWidth: 0
}

export const panel = {
  background: 'linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.99))',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 22,
  padding: 'clamp(12px, 2vw, 18px)',
  boxShadow: '0 20px 48px rgba(0,0,0,0.26)',
  overflow: 'hidden',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box'
}

export const panelForm = {
  ...panel,
  minWidth: 0,
  width: '100%'
}

export const heroCard = {
  background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(56,189,248,0.08), rgba(15,23,42,0.96))',
  border: '1px solid rgba(56,189,248,0.22)',
  borderRadius: 26,
  padding: 'clamp(16px, 3vw, 24px)',
  boxShadow: '0 22px 52px rgba(0,0,0,0.28)',
  minHeight: 'clamp(300px, 42vw, 420px)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between'
}

export const heroLabel = {
  fontSize: 13,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: '#7dd3fc',
  marginBottom: 10
}

export const heroValue = {
  fontSize: 'clamp(34px, 4vw, 50px)',
  lineHeight: 1,
  fontWeight: 900,
  color: '#f8fafc',
  marginBottom: 10
}

export const heroSub = {
  color: '#cbd5e1',
  fontSize: 14,
  marginBottom: 18
}

export const heroMiniRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
  gap: 12
}

export const heroMiniBox = {
  background: 'rgba(2,6,23,0.42)',
  border: '1px solid rgba(71,85,105,0.45)',
  borderRadius: 18,
  padding: '14px 16px'
}

export const heroMiniLabel = {
  fontSize: 12,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: 0.7,
  marginBottom: 6,
  fontWeight: 700
}

export const heroMiniValue = {
  fontSize: 20,
  color: '#f8fafc',
  fontWeight: 800
}

export const panelHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 16,
  flexWrap: 'wrap'
}

export const panelTitle = {
  margin: 0,
  color: '#f8fafc',
  fontSize: 22
}

export const panelSubtitle = {
  margin: '6px 0 0',
  color: '#94a3b8',
  fontSize: 14
}

export const sectionTopBar = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap'
}

export const sectionTitle = {
  margin: 0,
  color: '#f8fafc',
  fontSize: 24
}

export const sectionDescription = {
  margin: '6px 0 0',
  color: '#94a3b8',
  fontSize: 14
}

export const primaryButtonGreen = {
  border: 'none',
  background: 'linear-gradient(135deg, #16a34a, #22c55e)',
  color: '#f8fafc',
  fontWeight: 800,
  padding: '12px 16px',
  borderRadius: 14,
  cursor: 'pointer',
  minHeight: 44,
  touchAction: 'manipulation'
}

export const primaryButtonBlue = {
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
  color: '#f8fafc',
  fontWeight: 800,
  padding: '12px 16px',
  borderRadius: 14,
  cursor: 'pointer',
  minHeight: 44,
  touchAction: 'manipulation'
}

export const secondaryButton = {
  border: '1px solid rgba(71,85,105,0.95)',
  background: 'rgba(15,23,42,0.82)',
  color: '#e2e8f0',
  fontWeight: 700,
  padding: '10px 14px',
  borderRadius: 14,
  cursor: 'pointer',
  minHeight: 42,
  touchAction: 'manipulation'
}

export const tinyGreenButton = {
  border: 'none',
  background: 'linear-gradient(135deg, #16a34a, #22c55e)',
  color: '#f8fafc',
  fontWeight: 800,
  padding: '8px 12px',
  borderRadius: 12,
  cursor: 'pointer'
}

export const tinyBlueButton = {
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
  color: '#f8fafc',
  fontWeight: 800,
  padding: '8px 12px',
  borderRadius: 12,
  cursor: 'pointer'
}

export const tinyOrangeButton = {
  border: 'none',
  background: 'linear-gradient(135deg, #ea580c, #f97316)',
  color: '#fff7ed',
  fontWeight: 800,
  padding: '8px 12px',
  borderRadius: 12,
  cursor: 'pointer'
}

export const tinyOrangeButtonLarge = {
  ...tinyOrangeButton,
  padding: '12px 16px',
  borderRadius: 14
}

export const tinyRedButton = {
  border: 'none',
  background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
  color: '#fff1f2',
  fontWeight: 800,
  padding: '8px 12px',
  borderRadius: 12,
  cursor: 'pointer'
}

export const filterRow = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 16
}

export const input = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  background: '#0b1220',
  color: '#f8fafc',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 14,
  padding: '12px 14px',
  outline: 'none',
  marginBottom: 12,
  fontSize: 16
}

export const textarea = {
  ...input,
  minHeight: 90,
  resize: 'vertical'
}

export const filterInput = {
  flex: '1 1 160px',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
  background: '#0b1220',
  color: '#f8fafc',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 14,
  padding: '12px 14px',
  outline: 'none',
  fontSize: 16
}

export const filterInputWide = {
  ...filterInput,
  flex: '2 1 260px'
}

export const tableWrap = {
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  maxWidth: '100%',
  borderRadius: 18,
  border: '1px solid rgba(51,65,85,0.85)',
  position: 'relative'
}

export const table = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 760
}

export const tableLarge = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 1100
}

export const th = {
  textAlign: 'left',
  padding: '14px 14px',
  fontSize: 12,
  color: '#94a3b8',
  background: '#0b1220',
  borderBottom: '1px solid rgba(51,65,85,0.85)',
  textTransform: 'uppercase',
  letterSpacing: 0.7
}

export const thActions = {
  ...th,
  minWidth: 140,
  position: 'sticky',
  right: 0,
  background: '#0b1220',
  zIndex: 3,
  boxShadow: '-8px 0 12px rgba(2,6,23,0.35)'
}

export const tr = {
  borderBottom: '1px solid rgba(30,41,59,0.9)'
}

export const td = {
  padding: '14px 14px',
  color: '#e2e8f0',
  verticalAlign: 'top',
  fontSize: 14
}

export const tdStrong = {
  ...td,
  fontWeight: 800,
  color: '#f8fafc'
}

export const tdNote = {
  ...td,
  minWidth: 250
}

export const tdNoteText = {
  ...td,
  minWidth: 280
}

export const tdActions = {
  ...td,
  minWidth: 140,
  position: 'sticky',
  right: 0,
  background: '#0b1220',
  zIndex: 2,
  boxShadow: '-8px 0 12px rgba(2,6,23,0.35)'
}

export const noteTextarea = {
  width: '100%',
  maxWidth: '340px',
  background: '#0b1220',
  color: '#f8fafc',
  border: '1px solid rgba(51,65,85,0.9)',
  borderRadius: 10,
  padding: '8px 10px',
  minHeight: 52,
  resize: 'vertical',
  boxSizing: 'border-box',
  overflow: 'hidden'
}

export const stackList = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12
}

export const miniRowTitle = {
  color: '#f8fafc',
  fontWeight: 800
}

export const miniRowSub = {
  color: '#94a3b8',
  fontSize: 13,
  marginTop: 4
}

export const rankRow = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr auto',
  gap: 12,
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(11,18,32,0.78)',
  border: '1px solid rgba(51,65,85,0.75)'
}

export const rankBadge = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(56,189,248,0.16)',
  border: '1px solid rgba(56,189,248,0.28)',
  color: '#e0f2fe',
  fontWeight: 900,
  fontSize: 13
}

export const rankMain = {
  minWidth: 0
}

export const rankValue = {
  color: '#f8fafc',
  fontWeight: 900,
  whiteSpace: 'nowrap',
  fontSize: 15
}

export const modalOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2,6,23,0.78)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'clamp(8px, 3vw, 16px)',
  zIndex: 1000,
  overflowY: 'auto'
}

export const modalCard = {
  width: '100%',
  maxWidth: 620,
  maxHeight: 'calc(100vh - 24px)',
  overflowY: 'auto',
  boxSizing: 'border-box',
  background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,1))',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 22,
  padding: 'clamp(12px, 3vw, 18px)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.42)'
}

export const modalHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 14
}

export const modalTitle = {
  margin: 0,
  color: '#f8fafc'
}

export const modalSubtitle = {
  margin: '6px 0 0',
  color: '#94a3b8',
  fontSize: 14
}

export const modalClose = {
  border: '1px solid rgba(71,85,105,0.95)',
  background: 'rgba(15,23,42,0.82)',
  color: '#e2e8f0',
  width: 38,
  height: 38,
  borderRadius: 12,
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1
}

export const modalActions = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 6
}

export const loadingScreen = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20
}

export const loadingCard = {
  background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,1))',
  color: '#f8fafc',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 20,
  padding: '24px 28px',
  fontWeight: 800,
  boxShadow: '0 24px 60px rgba(0,0,0,0.36)'
}

export const hintBox = {
  marginTop: 10,
  border: '1px solid rgba(56,189,248,0.25)',
  background: 'rgba(56,189,248,0.08)',
  color: '#cfefff',
  padding: '12px 14px',
  borderRadius: 14,
  fontSize: 13,
  lineHeight: 1.5
}


// ============================================================
// RESPONSIVE UI
// ============================================================

export const responsiveCss = `
  * { box-sizing: border-box; }

  html, body {
    max-width: 100%;
    overflow-x: hidden;
  }

  button, input, select, textarea {
    font: inherit;
  }

  img, svg, canvas {
    max-width: 100%;
  }

  .pt-mobile-scroll {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  @media (max-width: 900px) {
    .pt-two-col,
    .pt-three-col,
    .pt-four-col {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .pt-flex-stack {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .pt-flex-stack > * {
      width: 100% !important;
      max-width: 100% !important;
    }
  }

  @media (max-width: 768px) {
    .pt-mobile-hide {
      display: none !important;
    }

    .pt-mobile-full {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }

    .pt-mobile-actions {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      width: 100% !important;
      gap: 8px !important;
    }

    .pt-mobile-actions > button,
    .pt-mobile-actions > a,
    .pt-mobile-actions > select,
    .pt-mobile-actions > input {
      width: 100% !important;
      min-height: 44px !important;
    }

    .pt-mobile-grid {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 10px !important;
    }

    .pt-mobile-table {
      display: block !important;
      width: max-content !important;
      min-width: 720px !important;
    }

    .pt-mobile-modal-row {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 8px !important;
    }

    .pt-tabs-scroll {
      display: flex !important;
      flex-wrap: nowrap !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      padding-bottom: 5px;
    }

    .pt-tabs-scroll > * {
      flex: 0 0 auto !important;
      white-space: nowrap !important;
    }

    .pt-toast-mobile {
      left: 10px !important;
      right: 10px !important;
      transform: none !important;
      width: auto !important;
      white-space: normal !important;
      text-align: center !important;
    }
  }

  @media (max-width: 520px) {
    body {
      font-size: 14px;
    }

    h1 {
      font-size: clamp(25px, 8vw, 34px) !important;
    }

    h2 {
      font-size: clamp(20px, 6.4vw, 27px) !important;
    }

    h3 {
      font-size: clamp(17px, 5.2vw, 22px) !important;
    }

    .pt-compact-mobile {
      padding: 10px !important;
      border-radius: 16px !important;
    }

    .pt-mobile-small-text {
      font-size: 12px !important;
      line-height: 1.4 !important;
    }
  }
`;
