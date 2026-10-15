import { useEffect, useState } from 'react'
import { calculateWithRules } from './calculationEngine.js'


function formatNaira(value) {
  return `₦${Math.round(Number(value) || 0).toLocaleString('en-NG')}`
}


export default function CalculationRulesEditor({ settings, onActivate }) {
  const [draft, setDraft] = useState(
    () => (settings.calculationRules || []).map((rule) => ({ ...rule }))
  )
  const [testEarnings, setTestEarnings] = useState('73000')
  const [testBalance, setTestBalance] = useState('1828000')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')


  useEffect(() => {
    setDraft((settings.calculationRules || []).map((rule) => ({ ...rule })))
    setPreview(null)
    setError('')
    setMessage('')
  }, [settings.calculationRules])


  function updateRule(index, changes) {
    setDraft((current) =>
      current.map((rule, i) => i === index ? { ...rule, ...changes } : rule)
    )
    setPreview(null)
    setMessage('')
  }


  function moveRule(index, direction) {
    setDraft((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setPreview(null)
  }


  function testRules() {
    setError('')
    setMessage('')
    setPreview(null)


    const earnings = Number(testEarnings)
    const balance = Number(testBalance)


    if (
      testEarnings.trim() === '' ||
      testBalance.trim() === '' ||
      !Number.isFinite(earnings) ||
      !Number.isFinite(balance) ||
      earnings < 0 ||
      balance < 0
    ) {
      setError('Enter valid, non-negative earnings and opening balance.')
      return
    }


    try {
      setPreview(calculateWithRules(earnings, balance, settings, draft))
    } catch (err) {
      setError(err.message || 'The rules could not be calculated.')
    }
  }


  function activateRules() {
    setError('')
    setMessage('')


    if (draft.some((rule) => !rule.label.trim() || !rule.key.trim() || !rule.formula.trim())) {
      setError('Every rule needs a label, key, and formula.')
      return
    }


    if (new Set(draft.map((rule) => rule.key)).size !== draft.length) {
      setError('Each rule must have a unique key.')
      return
    }


    try {
      calculateWithRules(73000, 1828000, settings, draft)
      onActivate(draft.map((rule) => ({ ...rule })))
      setMessage('Rules activated. Your app will save the settings to Firebase.')
    } catch (err) {
      setError(`Cannot activate these rules: ${err.message || 'Invalid formula.'}`)
    }
  }


  function addRule() {
    const key = `customRule${Date.now()}`
    setDraft((current) => [
      ...current,
      {
        id: key,
        label: 'New Rule',
        key,
        formula: 'earnings',
        enabled: true,
        display: true,
        balanceEffect: 'none',
      },
    ])
    setPreview(null)
    setMessage('')
  }


  return (
    <div className="calculation-editor">
      <div className="calculation-editor-heading">
        <div className="calculation-editor-icon">ƒx</div>
        <div>
          <h3>Calculation Rule Editor</h3>
          <p>Customize how earnings, bonuses and balances are calculated.</p>
        </div>
      </div>


      <div className="calculation-editor-notice">
        <span>ⓘ</span>
        <p>Changes here are a draft until you activate them. Test your rules before saving.</p>
      </div>


      <div className="calculation-rules-list">
        {draft.map((rule, index) => (
          <article className="calculation-rule-card" key={rule.id || rule.key}>
            <div className="calculation-rule-heading">
              <div className="calculation-rule-number">{String(index + 1).padStart(2, '0')}</div>
              <div className="calculation-rule-title">
                <h4>{rule.label || 'Untitled rule'}</h4>
                <span>{rule.enabled ? 'Enabled' : 'Disabled'} · {rule.display ? 'Visible in report' : 'Hidden from report'}</span>
              </div>
              <div className={`calculation-rule-status ${rule.enabled ? 'is-enabled' : ''}`}>
                {rule.enabled ? 'ACTIVE' : 'OFF'}
              </div>
            </div>


            <div className="calculation-rule-fields">
              <label className="calculation-field">
                <span>Report label</span>
                <input
                  value={rule.label}
                  onChange={(event) => updateRule(index, { label: event.target.value })}
                  placeholder="e.g. Daily allowance"
                />
              </label>


              <label className="calculation-field">
                <span>Formula key</span>
                <input value={rule.key} readOnly />
                <small>Unique identifier used by the calculation engine.</small>
              </label>


              <label className="calculation-field calculation-formula-field">
                <span>Formula</span>
                <input
                  value={rule.formula}
                  onChange={(event) => updateRule(index, { formula: event.target.value })}
                  placeholder="Enter a formula"
                  spellCheck="false"
                />
                <small>Use only formulas supported by the calculation engine.</small>
              </label>


              <label className="calculation-field">
                <span>Effect on balance</span>
                <select
                  value={rule.balanceEffect || 'none'}
                  onChange={(event) => updateRule(index, { balanceEffect: event.target.value })}
                >
                  <option value="none">Do not change balance</option>
                  <option value="add">Add result to balance</option>
                  <option value="subtract">Subtract result from balance</option>
                </select>
              </label>
            </div>


            <div className="calculation-rule-footer">
              <div className="calculation-rule-toggles">
                <label className="calculation-check">
                  <input
                    type="checkbox"
                    checked={Boolean(rule.enabled)}
                    onChange={(event) => updateRule(index, { enabled: event.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
                <label className="calculation-check">
                  <input
                    type="checkbox"
                    checked={Boolean(rule.display)}
                    onChange={(event) => updateRule(index, { display: event.target.checked })}
                  />
                  <span>Show in report</span>
                </label>
              </div>


              <div className="calculation-rule-actions">
                <button type="button" className="calculation-button calculation-button-light" disabled={index === 0} onClick={() => moveRule(index, -1)}>↑ Move up</button>
                <button type="button" className="calculation-button calculation-button-light" disabled={index === draft.length - 1} onClick={() => moveRule(index, 1)}>↓ Move down</button>
                <button
                  type="button"
                  className="calculation-button calculation-button-danger"
                  onClick={() => {
                    setDraft((current) => current.filter((_, i) => i !== index))
                    setPreview(null)
                    setMessage('')
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>


      <button type="button" className="calculation-button calculation-button-add" onClick={addRule}>
        <span>＋</span> Add a calculation rule
      </button>


      <section className="calculation-test-panel">
        <div className="calculation-test-heading">
          <div>
            <span className="calculation-eyebrow">SANDBOX</span>
            <h3>Test your calculations</h3>
            <p>Try sample values before applying changes to your app.</p>
          </div>
          <span className="calculation-test-icon">⌘</span>
        </div>


        <div className="calculation-test-fields">
          <label className="calculation-field">
            <span>Test earnings (₦)</span>
            <input type="number" min="0" value={testEarnings} onChange={(event) => setTestEarnings(event.target.value)} />
          </label>
          <label className="calculation-field">
            <span>Opening balance (₦)</span>
            <input type="number" min="0" value={testBalance} onChange={(event) => setTestBalance(event.target.value)} />
          </label>
        </div>


        <button type="button" className="calculation-button calculation-button-test" onClick={testRules}>
          Run calculation preview <span>→</span>
        </button>


        {error && <div className="calculation-feedback calculation-feedback-error" role="alert">{error}</div>}


        {preview && (
          <div className="calculation-preview">
            <div className="calculation-preview-heading">
              <span>✓</span>
              <div>
                <h4>Preview results</h4>
                <p>Based on your draft rules</p>
              </div>
            </div>
            <div className="calculation-preview-grid">
              {draft.filter((rule) => rule.enabled && rule.display).map((rule) => (
                <div className="calculation-preview-item" key={rule.id || rule.key}>
                  <span>{rule.label}</span>
                  <strong>{preview[rule.key] === undefined ? 'No result' : formatNaira(preview[rule.key])}</strong>
                </div>
              ))}
              <div className="calculation-preview-item">
                <span>Opening balance</span>
                <strong>{formatNaira(preview.previousBalance ?? Number(testBalance))}</strong>
              </div>
              <div className="calculation-preview-item calculation-preview-total">
                <span>New balance</span>
                <strong>{formatNaira(preview.newBalance)}</strong>
              </div>
            </div>
          </div>
        )}
      </section>


      <div className="calculation-activate-row">
        <div>
          <strong>Ready to apply these rules?</strong>
          <p>Activating saves your rule settings to the app.</p>
        </div>
        <button type="button" className="calculation-button calculation-button-activate" onClick={activateRules}>
          Activate rules <span>→</span>
        </button>
      </div>


      {message && <div className="calculation-feedback calculation-feedback-success" role="status">✓ {message}</div>}
    </div>
  )
}
