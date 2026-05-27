import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

interface AppDomain {
  id: string
  name: string
  appName: string
  created: string
}

interface Subdomain {
  name: string
  full: string
}

function App() {
  const [domains, setDomains] = useState<AppDomain[]>([])
  const [subdomains, setSubdomains] = useState<Subdomain[]>([])
  const [zones, setZones] = useState<{ name: string }[]>([])
  const [config, setConfig] = useState({ emails: [''] })
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // New domain form
  const [subInput, setSubInput] = useState('')
  const [selectedZone, setSelectedZone] = useState('devgiglio.uk')
  const [zoneDisabled, setZoneDisabled] = useState(false)

  // Check if input matches a .uk subdomain
  const matchUk = subInput ? subdomains.find(s => s.name === subInput.trim()) : null
  
  const handleSubChange = (val: string) => {
    setSubInput(val)
    const match = subdomains.find(s => s.name === val.trim())
    if (match) {
      setSelectedZone('devgiglio.uk')
      setZoneDisabled(true)
    } else {
      setZoneDisabled(false)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [domRes, subRes] = await Promise.all([
        fetch(`${API}/api/domains`),
        fetch(`${API}/api/subdomains`)
      ])
      if (domRes.ok) {
        const d = await domRes.json()
        setDomains(d.domains || [])
        setConfig(d.config || { emails: [''] })
      }
      if (subRes.ok) {
        const s = await subRes.json()
        setSubdomains(s.uk || [])
        setZones(s.zones || [])
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const msg = (s: string) => { setActionMsg(s); setTimeout(() => setActionMsg(''), 4000) }

  const getFullDomain = () => {
    const sub = subInput.trim()
    if (!sub) return ''
    return `${sub}.${selectedZone}`
  }

  const activateAccess = async () => {
    const full = getFullDomain()
    if (!full) return
    msg(`⏳ Ativando Zero Trust para ${full}...`)
    const name = full.split('.')[0]
    const res = await fetch(`${API}/api/access/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domain: full })
    })
    const data = await res.json()
    if (data.success) {
      msg(`✅ ${full} protegido com Zero Trust!`)
      setSubInput('')
      setSelectedZone('devgiglio.uk')
      setZoneDisabled(false)
      await load()
    } else {
      msg(`❌ ${data.errors?.[0]?.message || data.error || 'Erro'}`)
    }
  }

  const removeAccess = async (name: string) => {
    msg(`⏳ Removendo ${name}...`)
    const res = await fetch(`${API}/api/access/remove`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: name })
    })
    const data = await res.json()
    if (data.success) {
      msg(`✅ ${name} removido`)
      await load()
    } else { msg(`❌ ${data.error}`) }
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
    msg('⏳ Sincronizando emails...')
    const res = await fetch(`${API}/api/access/sync`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      const total = data.results?.length || 0
      const ok = data.results?.filter((r: any) => r.success).length || 0
      msg(`✅ ${ok}/${total} apps atualizadas`)
    } else { msg(`❌ ${data.error}`) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && getFullDomain()) activateAccess()
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', minHeight: '100vh' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>🔐 Cloudflare Access</h1>
        <p style={{ color: '#666', margin: '.25rem 0 0', fontSize: '.85rem' }}>
          Gerencie quais domínios têm autenticação via Cloudflare Zero Trust
        </p>
      </header>

      {actionMsg && (
        <div style={{ background: '#1a3a2a', padding: '.5rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '.85rem', color: '#22c55e' }}>
          {actionMsg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.5rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{domains.length}</div>
          <div style={{ fontSize: '.75rem', color: '#666' }}>✅ Domínios com Zero Trust</div>
        </div>
        <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{config.emails.length}</div>
          <div style={{ fontSize: '.75rem', color: '#666' }}>📧 Emails autorizados</div>
        </div>
      </div>

      {/* New domain form */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '.9rem', margin: '0 0 .75rem', color: '#e5e5e5' }}>🛡️ Adicionar domínio ao Zero Trust</h3>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Combobox: input + datalist */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <input value={subInput}
              onChange={e => handleSubChange(e.target.value)}
              placeholder="Digite ou selecione um subdomínio"
              list="sub-list"
              style={{ width: '100%', background: '#262626', border: '1px solid #333', color: '#e5e5e5', padding: '.4rem .65rem', borderRadius: 6, fontSize: '.85rem', boxSizing: 'border-box' }}
              onKeyDown={handleKeyDown} />
            <datalist id="sub-list">
              {subdomains.map(s => (
                <option key={s.full} value={s.name} />
              ))}
            </datalist>
          </div>

          {/* Separator dot */}
          <span style={{ color: '#666', fontSize: '1.2rem', fontWeight: 700 }}>.</span>

          {/* Domain zone - disabled if .uk match */}
          <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)}
            disabled={zoneDisabled}
            style={{ background: zoneDisabled ? '#1a1a1a' : '#262626', border: '1px solid #333', color: zoneDisabled ? '#555' : '#e5e5e5', padding: '.4rem .65rem', borderRadius: 6, fontSize: '.85rem', cursor: zoneDisabled ? 'not-allowed' : 'pointer' }}>
            {zones.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
          </select>

          {matchUk && <span style={{ color: '#3b82f6', fontSize: '.75rem' }}>🔒 .uk detectado</span>}
        </div>

        {/* Preview + button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.75rem' }}>
          <span style={{ color: '#666', fontSize: '.85rem' }}>
            {getFullDomain() ? (
              <>Domínio: <strong style={{ color: '#22c55e' }}>{getFullDomain()}</strong></>
            ) : (
              'Selecione ou digite um subdomínio'
            )}
          </span>
          <button onClick={activateAccess} disabled={!getFullDomain()}
            style={{ background: getFullDomain() ? '#22c55e' : '#333', color: getFullDomain() ? '#000' : '#666', border: 'none', padding: '.4rem 1rem', borderRadius: 6, cursor: getFullDomain() ? 'pointer' : 'default', fontSize: '.85rem', fontWeight: 600 }}>
            ✅ Ativar Zero Trust
          </button>
        </div>
      </div>

      {/* Active domains */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '.9rem', margin: '0 0 .5rem', color: '#e5e5e5' }}>✅ Domínios protegidos</h3>
        {loading ? (
          <p style={{ color: '#555', padding: '1rem', fontSize: '.85rem' }}>Carregando...</p>
        ) : domains.length === 0 ? (
          <p style={{ color: '#555', padding: '1rem', fontSize: '.85rem', background: '#1a1a1a', borderRadius: 10 }}>Nenhum domínio com Zero Trust ativo</p>
        ) : (
          <div style={{ background: '#1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a', fontSize: '.75rem', color: '#666', textAlign: 'left' }}>
                  <th style={{ padding: '.6rem 1rem' }}>Domínio</th>
                  <th style={{ padding: '.6rem 1rem' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {domains.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #222', fontSize: '.85rem' }}>
                    <td style={{ padding: '.6rem 1rem', fontWeight: 500, color: '#22c55e' }}>
                      ✅ {d.name}
                    </td>
                    <td style={{ padding: '.6rem 1rem' }}>
                      <button onClick={() => removeAccess(d.name)}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '.3rem .65rem', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}>
                        🗑️ Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Emails */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '.9rem', margin: '0 0 .5rem', color: '#e5e5e5' }}>📧 Emails autorizados</h3>
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
          <button onClick={addEmail} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem' }}>Adicionar</button>
          <button onClick={syncEmails} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '.35rem .75rem', borderRadius: 6, cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
            🔄 Sincronizar
          </button>
        </div>
      </div>

      <footer style={{ fontSize: '.75rem', color: '#444', textAlign: 'center' }}>
        <p>✅ Zero Trust = autenticação via email antes de acessar o domínio</p>
        <p>Configuração gerenciada via Cloudflare Zero Trust API</p>
      </footer>
    </div>
  )
}

export default App
