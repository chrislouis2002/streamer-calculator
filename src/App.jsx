import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

const startingStreamers = [
  { id: 'fantasy', name: 'Fantasy / Ade', balance: 1025000, specialDeduction: false },
  { id: 'daisy', name: 'Daisy', balance: 1139000, specialDeduction: false },
  { id: 'vip', name: 'VIP / Mona', balance: 204000, specialDeduction: true },
  { id: 'nini', name: 'Nini / Paris', balance: 202000, specialDeduction: false },
  { id: 'sicily', name: 'Sicily / Success', balance: 290000, specialDeduction: false },
  { id: 'treasure', name: 'Treasure / Tokyo', balance: 140000, specialDeduction: false },
  { id: 'lora', name: 'Lora', balance: 934000, specialDeduction: false },
  { id: 'bliss', name: 'Bliss / Ivy', balance: 959000, specialDeduction: false },
  { id: 'dammy', name: 'Dammy / Exclusive', balance: 1828000, specialDeduction: false },
  { id: 'nova', name: 'Nova / Preshie', balance: 1778000, specialDeduction: false },
]

const defaultSettings = {
  target: 45000,
  bonusPercentage: 50,
  allowancePercentage: 10,
  targetAllowance: 5000,
  addAllowanceToBalance: false,
  specialDeductionPercentage: 10,
  dangerZones: [
    { id: 'zone-1', min: 0, max: 5000, deduction: 195000 },
    { id: 'zone-2', min: 6000, max: 15000, deduction: 150000 },
    { id: 'zone-3', min: 16000, max: 25000, deduction: 90000 },
  ],
}

function formatNaira(amount) {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`
}

function getDangerDeduction(earnings, dangerZones) {
  const matchingZone = dangerZones.find(
    (zone) =>
      earnings >= Number(zone.min) &&
      earnings <= Number(zone.max)
  )

  return matchingZone
    ? Number(matchingZone.deduction)
    : 0
}

function App() {
  const [activePage, setActivePage] = useState('calculator')
  const [adminSection, setAdminSection] = useState('')
  const [expandedStreamerId, setExpandedStreamerId] = useState(null)
  const [selectedAdminStreamerId, setSelectedAdminStreamerId] = useState('')
  const [streamers, setStreamers] = useState(startingStreamers)
  const [settings, setSettings] = useState(defaultSettings)
  const [records, setRecords] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [streamerId, setStreamerId] = useState('')
  const [earnings, setEarnings] = useState('')
  const [result, setResult] = useState(null)
  const [firebaseReady, setFirebaseReady] = useState(false)
  const [firebaseLoading, setFirebaseLoading] = useState(true)

  useEffect(() => {
    async function loadFirebaseData() {
      try {
        const settingsSnapshot = await getDoc(doc(db, 'settings', 'app'))

        if (settingsSnapshot.exists()) {
          setSettings(settingsSnapshot.data())
        } else {
          await setDoc(
            doc(db, 'settings', 'app'),
            defaultSettings
          )
        }

        const streamersSnapshot = await getDocs(
          collection(db, 'streamers')
        )

        if (!streamersSnapshot.empty) {
          setStreamers(
            streamersSnapshot.docs.map((snapshot) => ({
              id: snapshot.id,
              ...snapshot.data(),
            }))
          )
        } else {
          await Promise.all(
            startingStreamers.map((streamer) =>
              setDoc(
                doc(db, 'streamers', streamer.id),
                streamer
              )
            )
          )
        }

        const recordsSnapshot = await getDocs(
          collection(db, 'records')
        )

        if (!recordsSnapshot.empty) {
          setRecords(
            recordsSnapshot.docs.map((snapshot) => ({
              id: snapshot.id,
              ...snapshot.data(),
            }))
          )
        }

        setFirebaseReady(true)
      } catch (error) {
        console.error('Firebase loading error:', error)
        alert(
          'Could not connect to Firebase. Check your Firestore setup and rules.'
        )
      } finally {
        setFirebaseLoading(false)
      }
    }

    loadFirebaseData()
  }, [])

  useEffect(() => {
    if (!firebaseReady) return

    setDoc(doc(db, 'settings', 'app'), settings).catch((error) => {
      console.error('Firebase settings save error:', error)
    })
  }, [settings, firebaseReady])

  useEffect(() => {
    if (!firebaseReady) return

    streamers.forEach((streamer) => {
      const { id, ...streamerData } = streamer

      setDoc(
        doc(db, 'streamers', id),
        streamerData
      ).catch((error) => {
        console.error('Firebase streamer save error:', error)
      })
    })
  }, [streamers, firebaseReady])

  useEffect(() => {
    if (!firebaseReady) return

    records.forEach((record) => {
      const { id, ...recordData } = record

      setDoc(
        doc(db, 'records', id),
        recordData
      ).catch((error) => {
        console.error('Firebase record save error:', error)
      })
    })
  }, [records, firebaseReady])

  function handleCalculate() {
    const streamer = streamers.find((person) => person.id === streamerId)
    const earningsAmount = Number(earnings)

    if (!streamer || earnings === '' || earningsAmount < 0) {
      alert('Please select a streamer and enter a valid earnings amount.')
      return
    }

    const existingRecord = records.find(
      (record) =>
        record.streamerId === streamerId &&
        record.date === date
    )

    if (existingRecord) {
      alert(
        'A record already exists for this streamer on this date. Editing will be added later.'
      )
      return
    }

    const bonus =
      earningsAmount > settings.target
        ? (earningsAmount - settings.target) *
          (settings.bonusPercentage / 100)
        : 0

    const allowance =
      earningsAmount >= settings.target
        ? settings.targetAllowance
        : earningsAmount *
          (settings.allowancePercentage / 100)

    const normalDeduction =
      earningsAmount < settings.target
        ? settings.target - earningsAmount
        : 0

    const extraDeduction = getDangerDeduction(
      earningsAmount,
      settings.dangerZones
    )

    const totalStandardDeductions =
      normalDeduction + extraDeduction

    const tenPercentDeduction = streamer.specialDeduction
      ? totalStandardDeductions *
        (settings.specialDeductionPercentage / 100)
      : 0

    const actualDeduction = streamer.specialDeduction
      ? tenPercentDeduction
      : totalStandardDeductions

    const newBalance =
      streamer.balance +
      bonus +
      (settings.addAllowanceToBalance ? allowance : 0) -
      actualDeduction

    let status = 'DANGER ZONE 🚨'

    if (earningsAmount >= settings.target) {
      status = 'TARGET ACHIEVED ✅'
    } else if (earningsAmount >= 26000) {
      status = 'BELOW TARGET ⚠️'
    }

    const newRecord = {
      id: `${streamerId}-${date}`,
      streamerId,
      streamerName: streamer.name,
      date,
      earnings: earningsAmount,
      bonus,
      allowance,
      normalDeduction,
      extraDeduction,
      tenPercentDeduction,
      actualDeduction,
      previousBalance: streamer.balance,
      newBalance,
      status,
    }

    setRecords((currentRecords) => [
      ...currentRecords,
      newRecord,
    ])

    setStreamers((currentStreamers) =>
      currentStreamers.map((person) =>
        person.id === streamerId
          ? { ...person, balance: newBalance }
          : person
      )
    )

    setResult({
      streamer,
      ...newRecord,
    })

    alert('Calculation saved successfully.')
  }

  function renderCalculator() {
    return (
      <>
        <header className="header">
          <h1>Daily Streamer Calculator</h1>
          <p>Select streamer, enter earnings, then calculate.</p>
        </header>

        <section className="calculator-card">
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="streamer">Select Streamer</label>
            <select
              id="streamer"
              value={streamerId}
              onChange={(event) => setStreamerId(event.target.value)}
            >
              <option value="">Select a streamer</option>

              {streamers.map((streamer) => (
                <option key={streamer.id} value={streamer.id}>
                  {streamer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="earnings">Today's Earnings</label>

            <div className="money-input">
              <span>₦</span>

              <input
                id="earnings"
                type="number"
                min="0"
                value={earnings}
                onChange={(event) => setEarnings(event.target.value)}
                placeholder="Enter amount"
              />
            </div>
          </div>

          <button
            className="calculate-button"
            type="button"
            onClick={handleCalculate}
          >
            CALCULATE & SAVE
          </button>
        </section>

        {result && (
          <section className="result-card">
            <h2>{result.streamerName}</h2>
            <p>Date: {result.date}</p>
            <p>Today's Earnings: {formatNaira(result.earnings)}</p>
            <p>Target: {formatNaira(settings.target)}</p>
            <p>Daily Bonus: {formatNaira(result.bonus)}</p>
            <p>Daily Allowance: {formatNaira(result.allowance)}</p>
            <p>Normal Deduction: {formatNaira(result.normalDeduction)}</p>
            <p>Extra Deduction: {formatNaira(result.extraDeduction)}</p>
            <p>
              Special 10% Deduction:{' '}
              {formatNaira(result.tenPercentDeduction)}
            </p>
            <p>
              Total Deduction Applied:{' '}
              {formatNaira(result.actualDeduction)}
            </p>
            <p>
              Previous Balance:{' '}
              {formatNaira(result.previousBalance)}
            </p>
            <p className="new-balance">
              New Balance: {formatNaira(result.newBalance)}
            </p>
            <p className="status">STATUS: {result.status}</p>
          </section>
        )}
      </>
    )
  }

  function renderRecords() {
    return (
      <>
        <header className="header">
          <h1>Daily Records</h1>
          <p>All calculations saved during this session.</p>
        </header>

        {records.length === 0 ? (
          <section className="calculator-card">
            <p>No daily records yet.</p>
          </section>
        ) : (
          <section className="records-list">
            {records.map((record) => (
              <article className="record-card" key={record.id}>
                <div className="record-top">
                  <div>
                    <h2>{record.streamerName}</h2>
                    <p>{record.date}</p>
                  </div>
                  <strong>{formatNaira(record.newBalance)}</strong>
                </div>

                <div className="record-details">
                  <p>Earnings: {formatNaira(record.earnings)}</p>
                  <p>Bonus: {formatNaira(record.bonus)}</p>
                  <p>Allowance: {formatNaira(record.allowance)}</p>
                  <p>
                    Deduction Applied:{' '}
                    {formatNaira(record.actualDeduction)}
                  </p>
                  <p>Status: {record.status}</p>
                </div>
              </article>
            ))}
          </section>
        )}
      </>
    )
  }


  function updateSetting(key, value) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }))
  }

  function updateStreamer(id, key, value) {
    setStreamers((currentStreamers) =>
      currentStreamers.map((streamer) =>
        streamer.id === id
          ? { ...streamer, [key]: value }
          : streamer
      )
    )
  }

  function updateDangerZone(id, key, value) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      dangerZones: currentSettings.dangerZones.map((zone) =>
        zone.id === id
          ? { ...zone, [key]: Number(value) }
          : zone
      ),
    }))
  }

  function addDangerZone() {
    setSettings((currentSettings) => ({
      ...currentSettings,
      dangerZones: [
        ...currentSettings.dangerZones,
        {
          id: `zone-${Date.now()}`,
          min: 0,
          max: 0,
          deduction: 0,
        },
      ],
    }))
  }

  function removeDangerZone(id) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      dangerZones: currentSettings.dangerZones.filter(
        (zone) => zone.id !== id
      ),
    }))
  }

  function addStreamer() {
    const newName = window.prompt(
      'Enter the new streamer name:'
    )

    if (!newName || !newName.trim()) return

    setStreamers((currentStreamers) => [
      ...currentStreamers,
      {
        id: `streamer-${Date.now()}`,
        name: newName.trim(),
        balance: 0,
        specialDeduction: false,
        active: true,
      },
    ])
  }

  function toggleAdminSection(section) {
    setAdminSection((currentSection) =>
      currentSection === section ? '' : section
    )
  }

  function renderAdminSettings() {
    return (
      <>
        <header className="header admin-header">
          <div className="admin-title-row">
            <div>
              <p className="admin-eyebrow">CONTROL PANEL</p>
              <h1>Admin Settings</h1>
              <p>
                Manage your rules, deductions and streamers.
              </p>
            </div>

            <div className="admin-header-badge">
              <span>{streamers.filter(
                (streamer) => streamer.active !== false
              ).length}</span>
              <small>Active</small>
            </div>
          </div>
        </header>

        <section className="admin-dashboard">

          <div className="admin-overview">
            <article className="admin-stat-card">
              <span className="admin-stat-icon">🎯</span>
              <div>
                <small>Daily Target</small>
                <strong>{formatNaira(settings.target)}</strong>
              </div>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-icon">⚡</span>
              <div>
                <small>Bonus</small>
                <strong>{settings.bonusPercentage}%</strong>
              </div>
            </article>

            <article className="admin-stat-card">
              <span className="admin-stat-icon">👥</span>
              <div>
                <small>Streamers</small>
                <strong>{streamers.length}</strong>
              </div>
            </article>
          </div>

          <section className="admin-section-card">
            <button
              className="admin-section-trigger"
              type="button"
              onClick={() => toggleAdminSection('rules')}
              aria-expanded={adminSection === 'rules'}
            >
              <span className="admin-section-icon">🎯</span>

              <span className="admin-section-text">
                <strong>Calculation Rules</strong>
                <small>
                  Target, bonus and allowance settings
                </small>
              </span>

              <span className="admin-section-arrow">
                {adminSection === 'rules' ? '⌃' : '⌄'}
              </span>
            </button>

            {adminSection === 'rules' && (
              <div className="admin-section-body">
                <div className="admin-form-grid">
                  <div className="form-group admin-full-width">
                    <label htmlFor="adminTarget">
                      Daily Target
                    </label>

                    <div className="money-input">
                      <span>₦</span>
                      <input
                        id="adminTarget"
                        type="number"
                        min="0"
                        value={settings.target}
                        onChange={(event) =>
                          updateSetting(
                            'target',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="adminBonus">
                      Bonus Percentage
                    </label>

                    <div className="percentage-input">
                      <input
                        id="adminBonus"
                        type="number"
                        min="0"
                        max="100"
                        value={settings.bonusPercentage}
                        onChange={(event) =>
                          updateSetting(
                            'bonusPercentage',
                            Number(event.target.value)
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="adminAllowance">
                      Allowance Percentage
                    </label>

                    <div className="percentage-input">
                      <input
                        id="adminAllowance"
                        type="number"
                        min="0"
                        max="100"
                        value={settings.allowancePercentage}
                        onChange={(event) =>
                          updateSetting(
                            'allowancePercentage',
                            Number(event.target.value)
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </div>

                  <div className="form-group admin-full-width">
                    <label htmlFor="adminTargetAllowance">
                      Allowance When Target Is Reached
                    </label>

                    <div className="money-input">
                      <span>₦</span>
                      <input
                        id="adminTargetAllowance"
                        type="number"
                        min="0"
                        value={settings.targetAllowance}
                        onChange={(event) =>
                          updateSetting(
                            'targetAllowance',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="admin-toggle-row">
                  <div>
                    <strong>Add allowance to balance</strong>
                    <small>
                      Include daily allowance in the final balance.
                    </small>
                  </div>

                  <button
                    className={`admin-switch ${
                      settings.addAllowanceToBalance
                        ? 'is-on'
                        : ''
                    }`}
                    type="button"
                    onClick={() =>
                      updateSetting(
                        'addAllowanceToBalance',
                        !settings.addAllowanceToBalance
                      )
                    }
                  >
                    <span />
                    {settings.addAllowanceToBalance
                      ? 'ON'
                      : 'OFF'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="admin-section-card">
            <button
              className="admin-section-trigger"
              type="button"
              onClick={() => toggleAdminSection('deductions')}
              aria-expanded={adminSection === 'deductions'}
            >
              <span className="admin-section-icon">⚠️</span>

              <span className="admin-section-text">
                <strong>Deduction Rules</strong>
                <small>
                  Special percentage and danger zones
                </small>
              </span>

              <span className="admin-section-arrow">
                {adminSection === 'deductions' ? '⌃' : '⌄'}
              </span>
            </button>

            {adminSection === 'deductions' && (
              <div className="admin-section-body">
                <div className="special-rule-card">
                  <div>
                    <span className="rule-label">
                      SPECIAL DEDUCTION
                    </span>
                    <strong>
                      Selected streamers pay only this percentage
                      of their normal deduction.
                    </strong>
                  </div>

                  <div className="special-percentage-input">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        settings.specialDeductionPercentage
                      }
                      onChange={(event) =>
                        updateSetting(
                          'specialDeductionPercentage',
                          Number(event.target.value)
                        )
                      }
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="admin-subsection-heading">
                  <div>
                    <h2>Danger Zones</h2>
                    <p>
                      Apply extra deductions based on earnings.
                    </p>
                  </div>

                  <button
                    className="admin-add-button"
                    type="button"
                    onClick={addDangerZone}
                  >
                    + Add Zone
                  </button>
                </div>

                <div className="danger-zone-list">
                  {settings.dangerZones.map(
                    (zone, index) => (
                      <article
                        className="admin-danger-card"
                        key={zone.id}
                      >
                        <div className="danger-card-top">
                          <div>
                            <span className="zone-number">
                              {index + 1}
                            </span>
                            <strong>
                              Danger Zone {index + 1}
                            </strong>
                          </div>

                          <button
                            className="admin-delete-button"
                            type="button"
                            onClick={() =>
                              removeDangerZone(zone.id)
                            }
                          >
                            Remove
                          </button>
                        </div>

                        <div className="admin-form-grid">
                          <div className="form-group">
                            <label>From</label>
                            <div className="money-input">
                              <span>₦</span>
                              <input
                                type="number"
                                min="0"
                                value={zone.min}
                                onChange={(event) =>
                                  updateDangerZone(
                                    zone.id,
                                    'min',
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label>To</label>
                            <div className="money-input">
                              <span>₦</span>
                              <input
                                type="number"
                                min="0"
                                value={zone.max}
                                onChange={(event) =>
                                  updateDangerZone(
                                    zone.id,
                                    'max',
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="form-group admin-full-width">
                            <label>Extra Deduction</label>
                            <div className="money-input">
                              <span>₦</span>
                              <input
                                type="number"
                                min="0"
                                value={zone.deduction}
                                onChange={(event) =>
                                  updateDangerZone(
                                    zone.id,
                                    'deduction',
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="admin-section-card">
            <button
              className="admin-section-trigger"
              type="button"
              onClick={() => toggleAdminSection('streamers')}
              aria-expanded={adminSection === 'streamers'}
            >
              <span className="admin-section-icon">👥</span>

              <span className="admin-section-text">
                <strong>Manage Streamers</strong>
                <small>
                  {streamers.length} streamers · edit balances
                  and special rules
                </small>
              </span>

              <span className="admin-section-arrow">
                {adminSection === 'streamers' ? '⌃' : '⌄'}
              </span>
            </button>

            {adminSection === 'streamers' && (
              <div className="admin-section-body">
                <div className="admin-subsection-heading">
                  <div>
                    <h2>Your Streamers</h2>
                    <p>
                      Edit one streamer at a time.
                    </p>
                  </div>

                  <button
                    className="admin-add-button"
                    type="button"
                    onClick={addStreamer}
                  >
                    + Add Streamer
                  </button>
                </div>

                <div className="streamer-admin-list">
                  {streamers.map((streamer) => {
                    const isOpen =
                      expandedStreamerId === streamer.id

                    return (
                      <article
                        className={`streamer-admin-card ${
                          isOpen ? 'expanded' : ''
                        }`}
                        key={streamer.id}
                      >
                        <div className="streamer-admin-summary">
                          <div className="streamer-avatar">
                            {streamer.name
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="streamer-admin-info">
                            <strong>{streamer.name}</strong>

                            <span>
                              {formatNaira(streamer.balance)}
                            </span>
                          </div>

                          <div className="streamer-statuses">
                            {streamer.active === false ? (
                              <span className="status-pill inactive">
                                Inactive
                              </span>
                            ) : (
                              <span className="status-pill active">
                                Active
                              </span>
                            )}

                            {streamer.specialDeduction && (
                              <span className="status-pill special">
                                {settings.specialDeductionPercentage}%
                                Special
                              </span>
                            )}
                          </div>

                          <button
                            className="streamer-edit-button"
                            type="button"
                            onClick={() =>
                              setExpandedStreamerId(
                                isOpen ? null : streamer.id
                              )
                            }
                          >
                            {isOpen ? 'Close' : 'Edit'}
                          </button>
                        </div>

                        {isOpen && (
                          <div className="streamer-admin-editor">
                            <div className="admin-form-grid">
                              <div className="form-group admin-full-width">
                                <label>Streamer Name</label>
                                <input
                                  type="text"
                                  value={streamer.name}
                                  onChange={(event) =>
                                    updateStreamer(
                                      streamer.id,
                                      'name',
                                      event.target.value
                                    )
                                  }
                                />
                              </div>

                              <div className="form-group admin-full-width">
                                <label>Current Balance</label>
                                <div className="money-input">
                                  <span>₦</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={streamer.balance}
                                    onChange={(event) =>
                                      updateStreamer(
                                        streamer.id,
                                        'balance',
                                        Number(
                                          event.target.value
                                        )
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="admin-toggle-row">
                              <div>
                                <strong>
                                  Special deduction
                                </strong>
                                <small>
                                  Apply the{' '}
                                  {
                                    settings.specialDeductionPercentage
                                  }
                                  % special rule.
                                </small>
                              </div>

                              <button
                                className={`admin-switch ${
                                  streamer.specialDeduction
                                    ? 'is-on'
                                    : ''
                                }`}
                                type="button"
                                onClick={() =>
                                  updateStreamer(
                                    streamer.id,
                                    'specialDeduction',
                                    !streamer.specialDeduction
                                  )
                                }
                              >
                                <span />
                                {streamer.specialDeduction
                                  ? 'ON'
                                  : 'OFF'}
                              </button>
                            </div>

                            <div className="admin-toggle-row">
                              <div>
                                <strong>
                                  Active streamer
                                </strong>
                                <small>
                                  Show this streamer in the
                                  calculator.
                                </small>
                              </div>

                              <button
                                className={`admin-switch ${
                                  streamer.active !== false
                                    ? 'is-on'
                                    : ''
                                }`}
                                type="button"
                                onClick={() =>
                                  updateStreamer(
                                    streamer.id,
                                    'active',
                                    streamer.active === false
                                  )
                                }
                              >
                                <span />
                                {streamer.active !== false
                                  ? 'ON'
                                  : 'OFF'}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </section>
      </>
    )
  }

  function renderPlaceholder(title, message) {
    return (
      <>
        <header className="header">
          <h1>{title}</h1>
          <p>{message}</p>
        </header>

        <section className="calculator-card">
          <p>This page is next to be built.</p>
        </section>
      </>
    )
  }

  function renderPage() {
    if (activePage === 'calculator') return renderCalculator()
    if (activePage === 'records') return renderRecords()
    if (activePage === 'admin') return renderAdminSettings()

    if (activePage === 'balances') {
      return (
        <>
          <header className="header">
            <h1>Streamer Balances</h1>
            <p>Current balance for every streamer.</p>
          </header>

          <section className="balance-list">
            {streamers.map((streamer) => (
              <article className="balance-card" key={streamer.id}>
                <div>
                  <h2>{streamer.name}</h2>
                  <p>
                    {streamer.specialDeduction
                      ? 'Special 10% deduction'
                      : 'Standard deductions'}
                  </p>
                </div>

                <strong>{formatNaira(streamer.balance)}</strong>
              </article>
            ))}
          </section>
        </>
      )
    }

    if (activePage === 'summary') {
      const todayRecords = records.filter(
        (record) => record.date === date
      )

      const totalEarnings = todayRecords.reduce(
        (total, record) => total + record.earnings,
        0
      )

      const totalBonuses = todayRecords.reduce(
        (total, record) => total + record.bonus,
        0
      )

      const totalAllowances = todayRecords.reduce(
        (total, record) => total + record.allowance,
        0
      )

      const totalDeductions = todayRecords.reduce(
        (total, record) => total + record.actualDeduction,
        0
      )

      const targetAchieved = todayRecords.filter(
        (record) => record.earnings >= settings.target
      ).length

      const belowTarget = todayRecords.filter(
        (record) =>
          record.earnings >= 26000 &&
          record.earnings < settings.target
      ).length

      const dangerZone = todayRecords.filter(
        (record) => record.earnings < 26000
      ).length

      return (
        <>
          <header className="header">
            <h1>Today's Summary</h1>
            <p>{date}</p>
          </header>

          {todayRecords.length === 0 ? (
            <section className="calculator-card">
              <p>No records saved for this date yet.</p>
            </section>
          ) : (
            <>
              <section className="summary-list">
                {todayRecords.map((record) => (
                  <article
                    className="summary-card"
                    key={record.id}
                  >
                    <h2>{record.streamerName}</h2>

                    <div className="summary-row">
                      <span>Earnings</span>
                      <strong>
                        {formatNaira(record.earnings)}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Bonus</span>
                      <strong>
                        {formatNaira(record.bonus)}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Allowance</span>
                      <strong>
                        {formatNaira(record.allowance)}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Deduction</span>
                      <strong>
                        {formatNaira(record.actualDeduction)}
                      </strong>
                    </div>

                    <div className="summary-row final-row">
                      <span>Final Balance</span>
                      <strong>
                        {formatNaira(record.newBalance)}
                      </strong>
                    </div>

                    <p className="summary-status">
                      {record.status}
                    </p>
                  </article>
                ))}
              </section>

              <section className="totals-card">
                <h2>Daily Totals</h2>

                <div className="summary-row">
                  <span>Total Earnings</span>
                  <strong>{formatNaira(totalEarnings)}</strong>
                </div>

                <div className="summary-row">
                  <span>Total Bonuses</span>
                  <strong>{formatNaira(totalBonuses)}</strong>
                </div>

                <div className="summary-row">
                  <span>Total Allowances</span>
                  <strong>{formatNaira(totalAllowances)}</strong>
                </div>

                <div className="summary-row">
                  <span>Total Deductions</span>
                  <strong>{formatNaira(totalDeductions)}</strong>
                </div>

                <div className="summary-row">
                  <span>Target Achieved</span>
                  <strong>{targetAchieved}</strong>
                </div>

                <div className="summary-row">
                  <span>Below Target</span>
                  <strong>{belowTarget}</strong>
                </div>

                <div className="summary-row">
                  <span>Danger Zone</span>
                  <strong>{dangerZone}</strong>
                </div>

                <div className="report-actions">
                  <button
                    className="whatsapp-button"
                    type="button"
                    onClick={() => {
                      const reportDate = new Date(
                        `${date}T12:00:00`
                      ).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }).toUpperCase()

                      const streamerReports = todayRecords
                        .map(
                          (record) => `${record.streamerName}
Earnings: ${formatNaira(record.earnings)}
Bonus: ${formatNaira(record.bonus)}
Allowance: ${formatNaira(record.allowance)}
Deduction: ${formatNaira(record.actualDeduction)}
Balance: ${formatNaira(record.newBalance)}
Status: ${record.status}`
                        )
                        .join('\n\n')

                      const message = `DAILY STREAMER REPORT
${reportDate}

${streamerReports}

---
TOTAL EARNINGS: ${formatNaira(totalEarnings)}
TOTAL BONUS: ${formatNaira(totalBonuses)}
TOTAL ALLOWANCES: ${formatNaira(totalAllowances)}
TOTAL DEDUCTIONS: ${formatNaira(totalDeductions)}`

                      window.open(
                        `https://wa.me/?text=${encodeURIComponent(message)}`,
                        '_blank'
                      )
                    }}
                  >
                    📱 SHARE TO WHATSAPP
                  </button>

                  <button
                    className="print-button"
                    type="button"
                    onClick={() => window.print()}
                  >
                    🖨️ PRINT DAILY REPORT
                  </button>
                </div>
              </section>
            </>
          )}
        </>
      )
    }

    if (activePage === 'more') {
      return (
        <>
          <header className="header">
            <h1>Admin Settings</h1>
            <p>Control the calculation rules.</p>
          </header>

          <section className="settings-card">
            <h2>General Rules</h2>

            <div className="form-group">
              <label htmlFor="target">Daily Target</label>
              <div className="money-input">
                <span>₦</span>
                <input
                  id="target"
                  type="number"
                  min="0"
                  value={settings.target}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      target: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bonusPercentage">
                Bonus Percentage
              </label>
              <div className="percentage-input">
                <input
                  id="bonusPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.bonusPercentage}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      bonusPercentage: Number(event.target.value),
                    }))
                  }
                />
                <span>%</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="allowancePercentage">
                Allowance Percentage
              </label>
              <div className="percentage-input">
                <input
                  id="allowancePercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.allowancePercentage}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      allowancePercentage: Number(event.target.value),
                    }))
                  }
                />
                <span>%</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="targetAllowance">
                Target-Achieved Allowance
              </label>
              <div className="money-input">
                <span>₦</span>
                <input
                  id="targetAllowance"
                  type="number"
                  min="0"
                  value={settings.targetAllowance}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      targetAllowance: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <h2 className="settings-section-title">
              Balance Rules
            </h2>

            <label className="toggle-row">
              <span>Add Daily Allowance to Balance?</span>
              <select
                value={
                  settings.addAllowanceToBalance ? 'yes' : 'no'
                }
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    addAllowanceToBalance:
                      event.target.value === 'yes',
                  }))
                }
              >
                <option value="no">NO</option>
                <option value="yes">YES</option>
              </select>
            </label>

            <div className="form-group">
              <label htmlFor="specialDeductionPercentage">
                Special Deduction Percentage
              </label>
              <div className="percentage-input">
                <input
                  id="specialDeductionPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.specialDeductionPercentage}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      specialDeductionPercentage: Number(
                        event.target.value
                      ),
                    }))
                  }
                />
                <span>%</span>
              </div>
            </div>

            <p className="settings-help">
              Special streamers only have this percentage of their
              normal and danger deductions applied to their balance.
            </p>
          </section>
        </>
      )
    }

    return null
  }

  if (firebaseLoading) {
    return (
      <div className="app">
        <main className="container">
          <section className="calculator-card">
            <h2>Loading...</h2>
            <p>Connecting to your streamer data.</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <main className="container">
        {renderPage()}
      </main>

      <nav className="bottom-nav">
        <button
          className={activePage === 'calculator' ? 'active' : ''}
          onClick={() => setActivePage('calculator')}
        >
          Calculator
        </button>

        <button
          className={activePage === 'records' ? 'active' : ''}
          onClick={() => setActivePage('records')}
        >
          Records
        </button>

        <button
          className={activePage === 'balances' ? 'active' : ''}
          onClick={() => setActivePage('balances')}
        >
          Balances
        </button>

        <button
          className={activePage === 'summary' ? 'active' : ''}
          onClick={() => setActivePage('summary')}
        >
          Summary
        </button>

        <button
          className={activePage === 'admin' ? 'active' : ''}
          onClick={() => setActivePage('admin')}
        >
          Admin
        </button>
      </nav>
    </div>
  )
}

export default App
