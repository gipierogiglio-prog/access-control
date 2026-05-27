import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

interface Domain {
  id: string
  name: string
  content: string
  proxied: boolean
  protection: 'cloudflare' | 'wireguard' | 'none'
  hasAccess: boolean
}

function getProtectionInfo(t: string, hasAccess: boolean) {
  if (t === 'cloudflare' && hasAccess) return { icon: '✅', label: 'Cloudflare Ativo', color: '#22c55e' }
  if (t === 'cloudflare' && !hasAccess) return { icon: '⏳', label: 'Cloudflare Pendente', color: '#f59e0b' }
  if (t === 'wireguard') return { icon: '🔐', label: 'WireGuard', color: '#3b82f6' }
  return { icon: '🌐', label: 'Público', color: '#666' }
}

function App() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [newDomain, setNewDomain] = useState('')
  const [newType, setNewType] = useState<'cloudflare' | 'wireguard'>('cloudflare')
  const [actionMsg, setActionMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/domains`)
      if (res.ok) setDomains(await res.json())
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const msg = (s: string) => { setActionMsg(s); setTimeout(() => setActionMsg(''), 3000) }

  const setProtection = async (name: string, type: 'cloudflare' | 'wireguard' | 'none') => {
    await fetch(`${API}/api/protection/set`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type })
    })
    await load()
    msg(type === 'none' ? `🌐 ${name} agora é público` : `🔒 ${name} definido como ${type}`)
  }

  const activateAccess = async (name: string) => {
    msg(`⏳ Criando Zero Trust para ${name}...`)
    const res = await fetch(`${API}/api/access/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.replace('.devgiglio.uk', ''), domain: name })
    })
    const data = await res.json()
    if (data.success) {
      await setProtection(name, 'cloudflare')
      msg(`✅ ${name} protegido com Cloudflare Access!`)
    } else {
      msg(`❌ Erro: ${data.errors?.[0]?.message || data.error || 'desconhecido'}`)
    }
  }

  const removeAccess = async (name: string) => {
    msg(`⏳ Removendo Zero Trust de ${name}...`)
    const res = await fetch(`${API}/api/access/remove`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: name })
    })
    const data = await res.json()
    if (data.success) {
      await setProtection(name, 'none')
      msg(`✅ ${name} sem proteção!`)
    } else {
      msg(`❌ Erro: ${data.error || 'desconhecido'}`)
    }
  }

  const addManual = async () => {
    if (!newDomain) return
    await fetch(`${API}/api/protection/add`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDomain, type: newType })
    })
    setNewDomain('')
    await load()
    msg(`✅ ${newDomain} adicionado como ${newType}`)
  }

  const filtered = domains.filter(d => {
    if (filter === 'protected') return d.protection !== 'none'
    if (filter === 'cloudflare') return d.protection === 'cloudflare'
    if (filter === 'wireguard') return d.protection === 'wireguard'
    if (filter === 'public') return d.protection === 'none'
    if (filter === 'active') return d.hasAccess
    return true
  })

  const stats = {
    total: domains.length,
    active: domains.filter(d => d.hasAccess).length,
    cloudflare: domains.filter(d => d.protection === 'cloudflare').length,
    wireguard: domains.filter(d => d.protection === 'wireguard').length,
    public: domains.filter(d => d.protection === 'none').length,
  }

  const btnF = (f: string, label: string) => (
    <button key={f} onClick={() => setFilter(f)}
      style={{ background: filter === f ? '#3b82f6' : '#1a1a1a', color: filter === f ? '#fff' : '#999', border: 'none', padding: '.35rem .85rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem' }}>
      {label}
    </button>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', minHeight: '100vh' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>🔐 Access Control</h1>
        <p style={{ color: '#666', margin: '.25rem 0 0', fontSize: '.85rem' }}>
          Controle de acesso por domínio — Cloudflare Access (Zero Trust) ou WireGuard
        </p>
      </header>

      {actionMsg && (
        <div style={{ background: '#1a3a2a', padding: '.5rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '.85rem', color: '#22c55e' }}>
          {actionMsg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '.5rem', marginBottom: '1rem' }}>
        {[
          { label: 'Total', value: stats.total, color: '#666' },
          { label: '✅ Zero Trust Ativo', value: stats.active, color: '#22c55e' },
          { label: '🔒 CF Pendente', value: stats.cloudflare - stats.active, color: '#f59e0b' },
          { label: '🔐 WireGuard', value: stats.wireguard, color: '#3b82f6' },
          { label: '🌐 Público', value: stats.public, color: '#666' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1a1a1a', borderRadius: 10, padding: '.65rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '.7rem', color: '#666', marginTop: '.1rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '.35rem', marginBottom: '.75rem', flexWrap: 'wrap' }}>
        {btnF('all', '📋 Todos')}
        {btnF('protected', '🔒 Protegidos')}
        {btnF('active', '✅ Zero Trust')}
        {btnF('cloudflare', '⏳ CF Pendente')}
        {btnF('wireguard', '🔐 WireGuard')}
        {btnF('public', '🌐 Público')}
        <span style={{ marginLeft: 'auto', color: '#555', fontSize: '.75rem', alignSelf: 'center' }}>
          {filtered.length} de {domains.length}
        </span>
      </div>

      {/* Add manual */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', background: '#1a1a1a', borderRadius: 10, padding: '.65rem 1rem', alignItems: 'center', fontSize: '.85rem' }}>
        <span style={{ color: '#666', flexShrink: 0 }}>➕</span>
        <input value={newDomain} onChange={e => setNewDomain(e.target.value)}
          placeholder="dominio.externo.com"
          style={{ flex: 1, background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.35rem .65rem', borderRadius: 6, fontSize: '.8rem' }}
          onKeyDown={e => e.key === 'Enter' && addManual()} />
        <select value={newType} onChange={e => setNewType(e.target.value as any)}
          style={{ background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.35rem .5rem', borderRadius: 6, fontSize: '.8rem' }}>
          <option value="cloudflare">Cloudflare Access</option>
          <option value="wireguard">WireGuard</option>
        </select>
        <button onClick={addManual} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
          Adicionar
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#555', padding: '3rem' }}>Carregando...</p>
      ) : (
        <div style={{ background: '#1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a', fontSize: '.75rem', color: '#666', textAlign: 'left' }}>
                <th style={{ padding: '.65rem 1rem' }}>Domínio</th>
                <th style={{ padding: '.65rem 1rem' }}>Status</th>
                <th style={{ padding: '.65rem 1rem' }}>Método</th>
                <th style={{ padding: '.65rem 1rem', minWidth: 200 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const p = getProtectionInfo(d.protection, d.hasAccess)
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #222', fontSize: '.85rem' }}>
                    <td style={{ padding: '.65rem 1rem', fontWeight: 500 }}>
                      {d.name}
                      {d.name.endsWith('.devgiglio.uk') && <span style={{ fontSize: '.6rem', color: '#3b82f6', marginLeft: '.35rem', background: 'rgba(59,130,246,.15)', padding: '.1rem .3rem', borderRadius: 4 }}>.uk</span>}
                    </td>
                    <td style={{ padding: '.65rem 1rem' }}>
                      <span style={{ color: p.color, fontSize: '.8rem' }}>{p.icon} {p.label}</span>
                    </td>
                    <td style={{ padding: '.65rem 1rem' }}>
                      <select value={d.protection} onChange={e => setProtection(d.name, e.target.value as any)}
                        style={{ background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.3rem .5rem', borderRadius: 6, fontSize: '.75rem', cursor: 'pointer' }}>
                        <option value="cloudflare">🔒 Cloudflare Access</option>
                        <option value="wireguard">🔐 WireGuard</option>
                        <option value="none">🌐 Público</option>
                      </select>
                    </td>
                    <td style={{ padding: '.65rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '.35rem' }}>
                        {d.name.endsWith('.devgiglio.uk') && !d.hasAccess && (
                          <button onClick={() => activateAccess(d.name)}
                            style={{ background: '#22c55e', color: '#000', border: 'none', padding: '.3rem .65rem', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}>
                            ✅ Ativar Zero Trust
                          </button>
                        )}
                        {d.hasAccess && (
                          <button onClick={() => removeAccess(d.name)}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '.3rem .65rem', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}>
                            🗑️ Remover Zero Trust
                          </button>
                        )}
                        {!d.name.endsWith('.devgiglio.uk') && d.protection !== 'wireguard' && d.protection !== 'none' && (
                          <span style={{ color: '#555', fontSize: '.75rem', alignSelf: 'center' }}>WireGuard manual</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#555', padding: '2rem', fontSize: '.85rem' }}>Nenhum domínio encontrado</p>}
        </div>
      )}

      <footer style={{ marginTop: '1.5rem', fontSize: '.75rem', color: '#444', textAlign: 'center' }}>
        <p>✅ <strong style={{ color: '#22c55e' }}>Zero Trust</strong> = Criado no Cloudflare Access (autenticação via email)</p>
        <p>🔐 <strong style={{ color: '#3b82f6' }}>WireGuard</strong> = Requer VPN instalada na VPS</p>
        <p>🌐 <strong>Público</strong> = Acesso livre</p>
      </footer>
    </div>
  )
}

export default App
