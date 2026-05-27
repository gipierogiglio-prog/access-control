import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

interface Domain {
  id: string
  name: string
  zone: string
  content: string
  proxied: boolean
  protection: string
  hasAccess: boolean
}

function App() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [config, setConfig] = useState({ emails: [''], zones: { uk: '', com: '' } })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [newEmail, setNewEmail] = useState('')
  const [comDomain, setComDomain] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/domains`)
      if (res.ok) {
        const data = await res.json()
        setDomains(data.domains || [])
        setConfig(data.config || { emails: [''], zones: {} })
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const msg = (s: string) => { setActionMsg(s); setTimeout(() => setActionMsg(''), 4000) }

  const setProtection = async (name: string, type: string) => {
    await fetch(`${API}/api/protection/set`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type })
    })
    await load()
  }

  const activateAccess = async (name: string) => {
    msg(`⏳ Ativando Zero Trust para ${name}...`)
    const res = await fetch(`${API}/api/access/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.split('.')[0], domain: name })
    })
    const data = await res.json()
    if (data.success) {
      await setProtection(name, 'cloudflare')
      msg(`✅ ${name} protegido!`)
    } else {
      msg(`❌ ${data.errors?.[0]?.message || data.error || 'Erro'}`)
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
      msg(`✅ ${name} sem proteção`)
    } else {
      msg(`❌ ${data.error}`)
    }
  }

  const addEmail = async () => {
    if (!newEmail) return
    const emails = [...new Set([...config.emails, newEmail])]
    await fetch(`${API}/api/emails/set`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails })
    })
    setNewEmail('')
    await load()
    msg(`✅ Email ${newEmail} adicionado`)
  }

  const removeEmail = async (email: string) => {
    const emails = config.emails.filter(e => e !== email)
    await fetch(`${API}/api/emails/set`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails })
    })
    await load()
  }

  const syncEmails = async () => {
    msg('⏳ Sincronizando emails com todas as apps...')
    const res = await fetch(`${API}/api/access/sync`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      const total = data.results?.length || 0
      const ok = data.results?.filter((r: any) => r.success).length || 0
      msg(`✅ ${ok}/${total} aplicações atualizadas com os emails!`)
    } else {
      msg(`❌ ${data.error || 'Erro ao sincronizar'}`)
    }
  }

  const addComDomain = async () => {
    if (!comDomain) return
    await fetch(`${API}/api/protection/set`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: comDomain, type: 'cloudflare' })
    })
    setComDomain('')
    await load()
  }

  const filtered = domains.filter(d => {
    if (filter === 'protected') return d.protection !== 'none'
    if (filter === 'active') return d.hasAccess
    if (filter === 'com') return d.zone === 'com' || d.zone === 'manual'
    return true
  })

  const stats = {
    total: domains.length,
    active: domains.filter(d => d.hasAccess).length,
    cloudflare: domains.filter(d => d.protection === 'cloudflare').length,
    wireguard: domains.filter(d => d.protection === 'wireguard').length,
    pub: domains.filter(d => d.protection === 'none').length,
  }

  const btnF = (f: string, label: string) => (
    <button key={f} onClick={() => setFilter(f)}
      style={{ background: filter === f ? '#3b82f6' : '#1a1a1a', color: filter === f ? '#fff' : '#999', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem' }}>
      {label}
    </button>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', minHeight: '100vh' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>🔐 Access Control</h1>
        <p style={{ color: '#666', margin: '.25rem 0 0', fontSize: '.85rem' }}>
          Gerencie emails permitidos e ative Cloudflare Access para qualquer domínio
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
          { label: '✅ Ativo', value: stats.active, color: '#22c55e' },
          { label: '🔒 CF Pendente', value: stats.cloudflare - stats.active, color: '#f59e0b' },
          { label: '🔐 WireGuard', value: stats.wireguard, color: '#3b82f6' },
          { label: '🌐 Público', value: stats.pub, color: '#666' },
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
        {btnF('active', '✅ Zero Trust')}
        {btnF('protected', '🔒 Protegidos')}
        {btnF('com', '🌐 devgiglio.com')}
        {btnF('public', '🌎 Público')}
      </div>

      {/* Emails config */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '.75rem 1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '.9rem', margin: '0 0 .5rem', color: '#e5e5e5' }}>📧 Emails permitidos no Zero Trust</h3>
        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
          {config.emails.map(e => (
            <span key={e} style={{ background: '#262626', padding: '.25rem .6rem', borderRadius: 6, fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              {e}
              <button onClick={() => removeEmail(e)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '.85rem' }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
            placeholder="email@exemplo.com"
            style={{ flex: 1, background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.35rem .65rem', borderRadius: 6, fontSize: '.8rem' }}
            onKeyDown={e => e.key === 'Enter' && addEmail()} />
          <button onClick={addEmail} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem' }}>
            Adicionar
          </button>
          <button onClick={syncEmails} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
            🔄 Sincronizar com apps existentes
          </button>
        </div>
      </div>

      {/* .com domain quick-add */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '.75rem 1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '.9rem', margin: '0 0 .5rem', color: '#e5e5e5' }}>🌐 Adicionar domínio .com</h3>
        <p style={{ fontSize: '.75rem', color: '#666', margin: '0 0 .5rem' }}>
          Digite um domínio de {config.zones?.com || 'devgiglio.com'} para ativar o Zero Trust
        </p>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input value={comDomain} onChange={e => setComDomain(e.target.value)}
            placeholder="ex: dokploy.devgiglio.com"
            style={{ flex: 1, background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.35rem .65rem', borderRadius: 6, fontSize: '.8rem' }}
            onKeyDown={e => e.key === 'Enter' && addComDomain()} />
          <button onClick={addComDomain} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
            Adicionar à lista
          </button>
          <button onClick={() => activateAccess(comDomain)}
            style={{ background: '#22c55e', color: '#000', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
            ✅ Ativar Zero Trust
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#555', padding: '3rem' }}>Carregando...</p>
      ) : (
        <div style={{ background: '#1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a', fontSize: '.75rem', color: '#666', textAlign: 'left' }}>
                <th style={{ padding: '.6rem 1rem' }}>Domínio</th>
                <th style={{ padding: '.6rem 1rem' }}>Zona</th>
                <th style={{ padding: '.6rem 1rem' }}>Status</th>
                <th style={{ padding: '.6rem 1rem' }}>Método</th>
                <th style={{ padding: '.6rem 1rem' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const isUk = d.zone === 'uk'
                const isProtected = d.protection !== 'none'
                const statusColor = d.hasAccess ? '#22c55e' : isProtected ? '#f59e0b' : '#666'
                const statusIcon = d.hasAccess ? '✅' : isProtected ? '⏳' : '🌐'
                const statusLabel = d.hasAccess ? 'Ativo' : isProtected ? 'Pendente' : 'Público'
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #222', fontSize: '.85rem' }}>
                    <td style={{ padding: '.6rem 1rem', fontWeight: 500 }}>{d.name}</td>
                    <td style={{ padding: '.6rem 1rem', fontSize: '.75rem', color: '#666' }}>
                      {d.zone === 'uk' ? <span style={{ color: '#3b82f6' }}>.uk</span> :
                       d.zone === 'com' ? <span style={{ color: '#f59e0b' }}>.com</span> : '-'}
                    </td>
                    <td style={{ padding: '.6rem 1rem' }}>
                      <span style={{ color: statusColor }}>{statusIcon} {statusLabel}</span>
                    </td>
                    <td style={{ padding: '.6rem 1rem' }}>
                      <select value={d.protection} onChange={e => setProtection(d.name, e.target.value)}
                        style={{ background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.3rem .5rem', borderRadius: 6, fontSize: '.75rem', cursor: 'pointer' }}>
                        <option value="cloudflare">🔒 Cloudflare</option>
                        <option value="wireguard">🔐 WireGuard</option>
                        <option value="none">🌐 Público</option>
                      </select>
                    </td>
                    <td style={{ padding: '.6rem 1rem' }}>
                      {!d.hasAccess && d.protection === 'cloudflare' && (
                        <button onClick={() => activateAccess(d.name)}
                          style={{ background: '#22c55e', color: '#000', border: 'none', padding: '.3rem .6rem', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}>
                          ✅ Ativar
                        </button>
                      )}
                      {d.hasAccess && (
                        <button onClick={() => removeAccess(d.name)}
                          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '.3rem .6rem', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}>
                          🗑️ Remover
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#555', padding: '2rem', fontSize: '.8rem' }}>Nenhum domínio</p>}
        </div>
      )}

      <footer style={{ marginTop: '1.5rem', fontSize: '.75rem', color: '#444', textAlign: 'center' }}>
        <p>✅ Zero Trust = Autenticação via email antes de acessar</p>
        <p>🔐 WireGuard = Requer VPN na VPS</p>
      </footer>
    </div>
  )
}

export default App
