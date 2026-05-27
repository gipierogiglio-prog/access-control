import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

interface Domain {
  id: string
  name: string
  content: string
  proxied: boolean
  protection: 'cloudflare' | 'wireguard' | 'none'
}

const isDotUk = (name: string) => name.endsWith('.devgiglio.uk')

function getProtectionLabel(t: string) {
  switch(t) {
    case 'cloudflare': return { icon: '🔒', label: 'Cloudflare Access', color: '#3b82f6' }
    case 'wireguard': return { icon: '🔐', label: 'WireGuard VPN', color: '#22c55e' }
    default: return { icon: '🌐', label: 'Público', color: '#f59e0b' }
  }
}

function App() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [newDomain, setNewDomain] = useState('')
  const [protectionType, setProtectionType] = useState<'cloudflare' | 'wireguard'>('cloudflare')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/domains`)
      if (res.ok) setDomains(await res.json())
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const setProtection = async (name: string, type: 'cloudflare' | 'wireguard' | 'none') => {
    await fetch(`${API}/api/protection/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type })
    })
    await load()
  }

  const addManual = async () => {
    if (!newDomain) return
    await fetch(`${API}/api/protection/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDomain, type: protectionType })
    })
    setNewDomain('')
    await load()
  }

  const filtered = domains.filter(d => {
    if (filter === 'protected') return d.protection !== 'none'
    if (filter === 'public') return d.protection === 'none'
    if (filter === 'wireguard') return d.protection === 'wireguard'
    if (filter === 'cloudflare') return d.protection === 'cloudflare'
    return true
  })

  const stats = {
    total: domains.length,
    protected: domains.filter(d => d.protection !== 'none').length,
    cloudflare: domains.filter(d => d.protection === 'cloudflare').length,
    wireguard: domains.filter(d => d.protection === 'wireguard').length,
    public: domains.filter(d => d.protection === 'none').length,
  }

  const btnFilter = (f: string, label: string) => (
    <button key={f} onClick={() => setFilter(f)}
      style={{ background: filter === f ? '#3b82f6' : '#1a1a1a', color: filter === f ? '#fff' : '#999', border: 'none', padding: '.4rem 1rem', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem' }}>
      {label}
    </button>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', minHeight: '100vh' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>🔐 Access Control</h1>
        <p style={{ color: '#666', margin: '.25rem 0 0', fontSize: '.9rem' }}>
          Domínios <span style={{ color: '#3b82f6' }}>.uk</span> são protegidos via <strong>Cloudflare Access</strong>.
          Demais domínios usam <strong>WireGuard + Traefik</strong>.
        </p>
      </header>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '.5rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total', value: stats.total, color: '#666' },
          { label: '🔒 Protegidos', value: stats.protected, color: '#3b82f6' },
          { label: '🔒 Cloudflare', value: stats.cloudflare, color: '#3b82f6' },
          { label: '🔐 WireGuard', value: stats.wireguard, color: '#22c55e' },
          { label: '🌐 Público', value: stats.public, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1a1a1a', borderRadius: 12, padding: '.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '.75rem', color: '#666', marginTop: '.15rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {btnFilter('all', '📋 Todos')}
        {btnFilter('protected', '🔒 Protegidos')}
        {btnFilter('cloudflare', '🔒 Cloudflare')}
        {btnFilter('wireguard', '🔐 WireGuard')}
        {btnFilter('public', '🌐 Público')}
        <span style={{ marginLeft: 'auto', color: '#555', fontSize: '.8rem', alignSelf: 'center' }}>
          {filtered.length} de {domains.length}
        </span>
      </div>

      {/* Add manual domain */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', background: '#1a1a1a', borderRadius: 12, padding: '.75rem 1rem', alignItems: 'center' }}>
        <span style={{ color: '#666', fontSize: '.85rem' }}>Adicionar domínio manual:</span>
        <input value={newDomain} onChange={e => setNewDomain(e.target.value)}
          placeholder="ex: app.externo.com"
          style={{ flex: 1, background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.4rem .75rem', borderRadius: 6, fontSize: '.85rem' }}
          onKeyDown={e => e.key === 'Enter' && addManual()} />
        <select value={protectionType} onChange={e => setProtectionType(e.target.value as any)}
          style={{ background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.4rem .5rem', borderRadius: 6, fontSize: '.85rem' }}>
          <option value="cloudflare">🔒 Cloudflare Access</option>
          <option value="wireguard">🔐 WireGuard</option>
        </select>
        <button onClick={addManual} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '.4rem .75rem', borderRadius: 6, cursor: 'pointer' }}>
          Adicionar
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#555', padding: '3rem' }}>Carregando...</p>
      ) : (
        <div style={{ background: '#1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a', fontSize: '.8rem', color: '#666', textAlign: 'left' }}>
                <th style={{ padding: '.75rem 1rem' }}>Domínio</th>
                <th style={{ padding: '.75rem 1rem' }}>Proteção</th>
                <th style={{ padding: '.75rem 1rem' }}>Método</th>
                <th style={{ padding: '.75rem 1rem' }}>Configurar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const p = getProtectionLabel(d.protection)
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #222', fontSize: '.9rem' }}>
                    <td style={{ padding: '.75rem 1rem', fontWeight: 500 }}>
                      {d.name}
                      {isDotUk(d.name) && <span style={{ fontSize: '.65rem', color: '#3b82f6', marginLeft: '.4rem', background: 'rgba(59,130,246,.15)', padding: '.1rem .35rem', borderRadius: 4 }}>.uk</span>}
                    </td>
                    <td style={{ padding: '.75rem 1rem' }}>
                      <span style={{ color: p.color }}>{p.icon} {p.label}</span>
                    </td>
                    <td style={{ padding: '.75rem 1rem', fontSize: '.8rem', color: '#666' }}>
                      {d.protection === 'cloudflare' && 'Dashboard Cloudflare → Zero Trust → Access'}
                      {d.protection === 'wireguard' && 'WireGuard + Traefik ipWhiteList'}
                      {d.protection === 'none' && 'Acesso livre'}
                    </td>
                    <td style={{ padding: '.75rem 1rem' }}>
                      <select value={d.protection} onChange={e => setProtection(d.name, e.target.value as any)}
                        style={{ background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.3rem .5rem', borderRadius: 6, fontSize: '.8rem', cursor: 'pointer' }}>
                        <option value="cloudflare">🔒 Cloudflare</option>
                        <option value="wireguard">🔐 WireGuard</option>
                        <option value="none">🌐 Público</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#555', padding: '2rem' }}>Nenhum domínio com esse filtro</p>}
        </div>
      )}

      <footer style={{ marginTop: '2rem', fontSize: '.8rem', color: '#444', textAlign: 'center' }}>
        {isDotUk && (
          <p style={{ marginBottom: '.25rem' }}>
            🔒 <strong style={{ color: '#3b82f6' }}>Cloudflare Access</strong> = Configurar em dash.cloudflare.com → Zero Trust → Access
          </p>
        )}
        <p>
          🔐 <strong style={{ color: '#22c55e' }}>WireGuard</strong> = Instalar WireGuard na VPS + Traefik ipWhiteList
        </p>
      </footer>
    </div>
  )
}

export default App
