// Production loading screen. On launch the Tauri Rust side spawns the bundled
// KROEX (Next.js) server and navigates this window to it once ready; this view
// is what shows during that brief startup. In dev, Tauri loads the Next dev
// server directly (devUrl), so this file is not used there.
export default function App() {
  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#ffffff',
        color: '#1d1d1f',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid #e5e7eb',
          borderTopColor: '#0071e3',
          borderRadius: '50%',
          animation: 'kroex-spin 0.8s linear infinite',
        }}
      />
      <p style={{ fontSize: 14, color: '#6b7280' }}>Starting KROEX…</p>
      <style>{`@keyframes kroex-spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
