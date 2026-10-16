import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import './App.css'


const defaultSettings = {
  // Blank, unsaved configuration only. Calculations stay blocked until
  // an administrator enters and explicitly saves valid values.
  target: '',
  deductionMode: 'percentage',
  deductionPercentage: '',
  personalBonusRate: '',
  allowancePercentage: '',
  allowanceCap: '',
  bonusTiers: [],
  addAllowanceToBalance: false,
}

function formatNaira(amount) {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`
}

function validateSettings(settings) {
  const requiredNumbers = ['target', 'deductionPercentage', 'allowancePercentage', 'allowanceCap', 'personalBonusRate']
  for (const key of requiredNumbers) {
    if (settings[key] === '' || settings[key] === null || !Number.isFinite(Number(settings[key])) || Number(settings[key]) < 0) {
      throw new Error(`Enter a valid non-negative value for ${key} in Admin.`)
    }
  }
  if (Number(settings.deductionPercentage) > 100 || Number(settings.allowancePercentage) > 100 || Number(settings.personalBonusRate) > 100) {
    throw new Error('Percentage settings must be between 0 and 100.')
  }
  if (!['percentage', 'fullShortfall'].includes(settings.deductionMode)) {
    throw new Error('Choose a valid deduction mode in Admin.')
  }
  if (!Array.isArray(settings.bonusTiers) || settings.bonusTiers.length === 0 || settings.bonusTiers.some(t => t.threshold === '' || t.amount === '' || !Number.isFinite(Number(t.threshold)) || !Number.isFinite(Number(t.amount)) || Number(t.threshold) < 0 || Number(t.amount) < 0)) {
    throw new Error('Add at least one valid bonus tier in Admin.')
  }
}

function calculateNewRules(earnings, openingBalance, settings) {
  if (!settings || !Number.isFinite(Number(settings.target)) || settings.target < 0) {
    throw new Error('Save valid calculation settings in Admin before calculating.');
  }
  const earningsValue = Number(earnings);
  const previousBalance = Number(openingBalance);
  if (!Number.isFinite(earningsValue) || earningsValue < 0 || !Number.isFinite(previousBalance)) {
    throw new Error('Earnings and opening balance must be valid numbers.');
  }
  const dailyTarget = Number(settings.target);
  const shortfall = Math.max(0, dailyTarget - earningsValue);
  const deductionMode = settings.deductionMode;
  if (!['percentage', 'fullShortfall'].includes(deductionMode)) {
    throw new Error('Choose a valid deduction mode in Admin and save settings.');
  }
  const deductionPercentage = Number(settings.deductionPercentage);
  const allowanceRate = Number(settings.allowancePercentage);
  const allowanceCap = Number(settings.allowanceCap);
  const personalBonusRate = Number(settings.personalBonusRate);
  if (![deductionPercentage, allowanceRate, allowanceCap, personalBonusRate].every(Number.isFinite) || deductionPercentage < 0 || deductionPercentage > 100 || allowanceRate < 0 || allowanceRate > 100 || allowanceCap < 0 || personalBonusRate < 0 || personalBonusRate > 100) {
    throw new Error('One or more Admin calculation settings are invalid. Save valid settings before calculating.');
  }
  const actualDeduction = deductionMode === 'fullShortfall' ? shortfall : shortfall * deductionPercentage / 100;
  const bonusTiers = settings.bonusTiers;
  if (!Array.isArray(bonusTiers) || bonusTiers.length === 0 || bonusTiers.some(t => !Number.isFinite(Number(t.threshold)) || !Number.isFinite(Number(t.amount)) || Number(t.threshold) < 0 || Number(t.amount) < 0)) {
    throw new Error('Bonus tiers are missing or invalid. Check Admin settings.');
  }
  const qualifyingTier = [...bonusTiers].sort((a, b) => Number(b.threshold) - Number(a.threshold)).find(tier => earningsValue >= Number(tier.threshold));
  const bonus = qualifyingTier ? Number(qualifyingTier.amount) : 0;
  const allowance = Math.min(earningsValue, allowanceCap) * allowanceRate / 100;
  const extraBonus = Math.max(0, earningsValue - dailyTarget) * personalBonusRate / 100;
  const allowanceInBalance = settings.addAllowanceToBalance === true ? allowance : 0;
  const balance = Math.max(0, previousBalance  - actualDeduction);
  const newBalance = Math.max(0, previousBalance + bonus + allowanceInBalance - actualDeduction);
  return {
    earnings: earningsValue, target: dailyTarget,
    status: earningsValue >= dailyTarget ? 'Target achieved' : 'Below target',
    allowance, bonus, extraBonus, actualDeduction,
    normalDeduction: actualDeduction, extraDeduction: 0, tenPercentDeduction: 0,
    previousBalance, balance, newBalance, deductionMode,
    deductionPercentage: deductionMode === 'percentage' ? deductionPercentage : null,
    shortfall,
  };
}

function App() {
  const [activePage, setActivePage] = useState('calculator')
  const [adminSection, setAdminSection] = useState('')
  const [expandedStreamerId, setExpandedStreamerId] = useState(null)
  const [selectedAdminStreamerId, setSelectedAdminStreamerId] = useState('')
  const [streamers, setStreamers] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [records, setRecords] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0])
  const [streamerId, setStreamerId] = useState('')
  const [earnings, setEarnings] = useState('')
  const [result, setResult] = useState(null)
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [editEarnings, setEditEarnings] = useState('')
  const [firebaseReady, setFirebaseReady] = useState(false)
  const [settingsConfigured, setSettingsConfigured] = useState(false)
  const [firebaseLoading, setFirebaseLoading] = useState(true)

  useEffect(() => {
    async function loadFirebaseData() {
      try {
        const settingsSnapshot = await getDoc(doc(db, 'settings', 'app'))


        if (settingsSnapshot.exists()) {
          const loadedSettings = { ...defaultSettings, ...settingsSnapshot.data() }
          setSettings(loadedSettings)
          setSettingsConfigured(true)
        } else {
          setSettings(defaultSettings)
          setSettingsConfigured(false)
        }


        const streamersSnapshot = await getDocs(collection(db, 'streamers'))
        setStreamers(
          streamersSnapshot.docs.map((snapshot) => ({
            id: snapshot.id,
            ...snapshot.data(),
          }))
        )


        const recordsSnapshot = await getDocs(collection(db, 'records'))
        setRecords(
          recordsSnapshot.docs.map((snapshot) => ({
            id: snapshot.id,
            ...snapshot.data(),
          }))
        )


        setFirebaseReady(true)
      } catch (error) {
        console.error('Firebase loading error:', error)
        alert('Could not connect to Firebase. Check your Firestore setup and rules.')
      } finally {
        setFirebaseLoading(false)
      }
    }


    loadFirebaseData()
  }, [])


  async function saveSettings() {
    try {
      validateSettings(settings)
    } catch (error) {
      alert(error.message)
      return
    }


    try {
      const settingsToSave = {
        ...settings,
        personalBonusRate: Number(settings.personalBonusRate),
      }
      await setDoc(doc(db, 'settings', 'app'), settingsToSave, { merge: true })
      setSettings((current) => ({
        ...current,
        personalBonusRate: Number(current.personalBonusRate),
      }))
      setSettingsConfigured(true)
      alert('Settings saved to Firestore successfully.')
    } catch (error) {
      console.error('Firebase settings save error:', error)
      alert(`Could not save settings: ${error.message || 'Check your connection and Firestore rules.'}`)
    }
  }

  async function persistStreamer(streamer) {
    const { id, ...streamerData } = streamer
    await setDoc(doc(db, 'streamers', id), streamerData)
  }

  async function persistRecord(record) {
    const { id, ...recordData } = record
    await setDoc(doc(db, 'records', id), recordData)
  }

  function handleCalculate() {
    if (!settingsConfigured) { alert('Calculation settings have not been saved to Firestore yet. Open Admin, enter all required values, and explicitly save them first.'); return }
    const streamer = streamers.find(
      (person) => person.id === streamerId
    )
    const earningsAmount = Number(earnings)

    if (!streamer || earnings === '' || earningsAmount < 0) {
      alert(
        'Please select a streamer and enter a valid earnings amount.'
      )
      return
    }

    const existingRecord = records.find(
      (record) =>
        record.streamerId === streamerId &&
        record.date === date
    )

    if (existingRecord) {
      alert(
        'A saved record already exists for this streamer on this date. Please edit the existing record instead.'
      )
      return
    }

    let calculation
    try {
      calculation = calculateNewRules(earningsAmount, streamer.balance, settings)
    } catch (error) {
      alert(error.message || 'Could not calculate using the current settings.')
      return
    }


    const calculatedRecord = {
      id: `${streamerId}-${date}`,
      streamerId,
      streamerName: streamer.name,
      date,
      ...calculation,
      previousBalance: streamer.balance,
    }

    setResult({
      streamer,
      ...calculatedRecord,
    })
  }

  async function handleSaveRecord() {
    if (!result) {
      alert('Please calculate the result first.')
      return
    }

    const existingRecord = records.find(
      (record) => record.id === result.id
    )

    if (existingRecord) {
      alert(
        'This record has already been saved.'
      )
      return
    }

    const { streamer, ...recordToSave } = result

    const updatedStreamer = {
      ...streamer,
      balance: result.newBalance,
    }

    try {
      await persistRecord(recordToSave)
      await persistStreamer(updatedStreamer)
      setRecords((currentRecords) => [...currentRecords, recordToSave])
      setStreamers((currentStreamers) =>
        currentStreamers.map((person) =>
          person.id === result.streamerId ? updatedStreamer : person
        )
      )
      alert('Record saved successfully.')
      setResult(null)
      setEarnings('')
    } catch (error) {
      console.error('Record save error:', error)
      alert('Could not save the record to Firestore. No local success was reported.')
    }
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
            CALCULATE
          </button>
        </section>

        {result && (
          <section className="result-card">
            <h2>{result.streamerName}</h2>
            <p>Date: {result.date}</p>
             <p>Earned: {formatNaira(result.earnings)}</p>
             <p className="status">STATUS: {result.status}</p>
            <p>Allowance: {formatNaira(result.allowance)}</p>

            <p>
              Previous Salary:{' '}
              {formatNaira(result.previousBalance)}
            </p>
           
        
            <p>
              Deduction:
              {formatNaira(result.actualDeduction)}
            </p>
            <p>
              Balance: {formatNaira(result.previousBalance)} - {formatNaira(result.actualDeduction)} = {formatNaira(result.balance)}
            </p>

            <p>Bonus For meeting a Target : {formatNaira(result.bonus)}</p>
            <p>
              Extra Bonus (not added to balance):
              {formatNaira(result.extraBonus)}
            </p>
            
            <p className="new-balance">
  New Salary: {formatNaira(result.balance)} + {formatNaira(result.bonus)} = {formatNaira(result.newBalance)}
  <br />
  {/* <small>Final balance plus the applicable target bonus.</small> */}
</p>

            <button
              className="save-record-button"
              type="button"
              onClick={handleSaveRecord}
            >
              SAVE RECORD
            </button>
          </section>
        )}
      </>
    )
  }

  function startEditingRecord(record) {
    setEditingRecordId(record.id)
    setEditEarnings(String(record.earnings))
  }

  function cancelEditingRecord() {
    setEditingRecordId(null)
    setEditEarnings('')
  }

  async function saveRecordChanges(record) {
    const earningsAmount = Number(editEarnings)

    if (editEarnings === '' || earningsAmount < 0) {
      alert('Please enter a valid earnings amount.')
      return
    }

    const streamer = streamers.find(
      (person) => person.id === record.streamerId
    )

    if (!streamer) {
      alert('Could not find the streamer for this record.')
      return
    }

    const calculation = calculateNewRules(
      earningsAmount,
      record.previousBalance,
      settings
    )


    const oldBalanceEffect =
      record.newBalance - record.previousBalance


    const newBalanceEffect =
      calculation.newBalance - record.previousBalance


    const correctedBalance =
      streamer.balance -
      oldBalanceEffect +
      newBalanceEffect


    const updatedRecord = {
      ...record,
      ...calculation,
      newBalance: calculation.newBalance,
    }


    const updatedStreamer = { ...streamer, balance: correctedBalance }
    try {
      await persistRecord(updatedRecord)
      await persistStreamer(updatedStreamer)
      setRecords((currentRecords) =>
        currentRecords.map((currentRecord) =>
          currentRecord.id === record.id ? updatedRecord : currentRecord
        )
      )
      setStreamers((currentStreamers) =>
        currentStreamers.map((person) =>
          person.id === record.streamerId ? updatedStreamer : person
        )
      )
      setEditingRecordId(null)
      setEditEarnings('')
      alert('Record updated successfully.')
    } catch (error) {
      console.error('Record update error:', error)
      alert('Could not update the record in Firestore.')
    }
  }

  async function deleteRecord(record) {
    const confirmed = window.confirm(
      `Delete the record for ${record.streamerName} on ${record.date}?`
    )

    if (!confirmed) return

    const balanceEffect =
      record.newBalance - record.previousBalance

    const streamer = streamers.find((person) => person.id === record.streamerId)
    const updatedStreamer = streamer
      ? { ...streamer, balance: Math.max(0, streamer.balance - balanceEffect) }
      : null

    try {
      await deleteDoc(doc(db, 'records', record.id))
      if (updatedStreamer) await persistStreamer(updatedStreamer)
      setRecords((currentRecords) =>
        currentRecords.filter((currentRecord) => currentRecord.id !== record.id)
      )
      if (updatedStreamer) {
        setStreamers((currentStreamers) =>
          currentStreamers.map((person) =>
            person.id === record.streamerId ? updatedStreamer : person
          )
        )
      }
    } catch (error) {
      console.error('Record delete error:', error)
      alert('Could not delete the record from Firestore.')
      return
    }

    if (editingRecordId === record.id) {
      setEditingRecordId(null)
      setEditEarnings('')
    }

    alert('Record deleted successfully.')
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

                {editingRecordId === record.id ? (
                  <div className="record-edit-form">
                    <div className="form-group">
                      <label>Edit Earnings</label>
                      <div className="money-input">
                        <span>₦</span>
                        <input
                          type="number"
                          min="0"
                          value={editEarnings}
                          onChange={(event) =>
                            setEditEarnings(event.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="record-action-row">
                      <button
                        className="save-changes-button"
                        type="button"
                        onClick={() => saveRecordChanges(record)}
                      >
                        SAVE CHANGES
                      </button>

                      <button
                        className="cancel-record-button"
                        type="button"
                        onClick={cancelEditingRecord}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="record-details">
                      <p>
                        Earnings: {formatNaira(record.earnings)}
                      </p>
                      <p>
                        Bonus: {formatNaira(record.bonus)}
                      </p>
                      <p>
                        Allowance: {formatNaira(record.allowance)}
                      </p>
                      <p>
                        Deduction Applied:{' '}
                        {formatNaira(record.actualDeduction)}
                      </p>
                      <p>Status: {record.status}</p>
                    </div>

                    <div className="record-action-row">
                      <button
                        className="edit-record-button"
                        type="button"
                        onClick={() => startEditingRecord(record)}
                      >
                        ✏️ EDIT
                      </button>

                      <button
                        className="delete-record-button"
                        type="button"
                        onClick={() => deleteRecord(record)}
                      >
                        🗑️ DELETE
                      </button>
                    </div>
                  </>
                )}
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



  async function deleteStreamer(streamer) {
    const confirmed = window.confirm(
      `Delete streamer "${streamer.name}"?\n\n` +
      `Their saved daily records will be preserved. ` +
      `This action removes the streamer from the active streamer list.`
    )


    if (!confirmed) return


    try {
      // Delete only the streamer document. Do not touch daily records.
      await deleteDoc(doc(db, 'streamers', streamer.id))


      // Update the interface only after Firestore confirms deletion.
      setStreamers((current) =>
        current.filter((person) => person.id !== streamer.id)
      )


      // Clear any unsaved calculation involving this streamer.
      if (streamerId === streamer.id) {
        setStreamerId('')
        setResult(null)
        setEarnings('')
      }


      if (result?.streamerId === streamer.id) {
        setResult(null)
      }


      if (expandedStreamerId === streamer.id) {
        setExpandedStreamerId(null)
      }


      if (selectedAdminStreamerId === streamer.id) {
        setSelectedAdminStreamerId('')
      }


      alert(
        `Streamer "${streamer.name}" was deleted. Their historical records were preserved.`
      )
    } catch (error) {
      console.error('Streamer delete error:', error)
      alert(
        `Could not delete "${streamer.name}". Please check your connection and Firestore rules.`
      )
    }
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
          <button className="admin-add-button" type="button" onClick={saveSettings}>
            Save Settings to Firestore
          </button>
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
                <strong>{settings.personalBonusRate}%</strong>
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
              <>
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
                    <label htmlFor="adminPersonalBonusRate">Personal Extra Bonus Rate</label>
                    <div className="percentage-input">
                      <input id="adminPersonalBonusRate" type="number" min="0" max="100" value={settings.personalBonusRate} onChange={(event) => updateSetting('personalBonusRate', event.target.value === '' ? '' : Number(event.target.value))} />
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
                    <label htmlFor="adminAllowanceCap">
                      Allowance Earnings Cap
                    </label>

                    <div className="money-input">
                      <span>₦</span>
                      <input
                        id="adminAllowanceCap"
                        type="number"
                        min="0"
                        value={settings.allowanceCap}
                        onChange={(event) =>
                          updateSetting(
                            'allowanceCap',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="admin-subsection-heading">
                  <div><h2>Bonus Tiers</h2><p>Only the highest qualifying tier is applied.</p></div>
                  <button className="admin-add-button" type="button" onClick={() => updateSetting('bonusTiers', [...(settings.bonusTiers || []), { id: `tier-${Date.now()}`, threshold: '', amount: '' }])}>+ Add Tier</button>
                </div>
                {(settings.bonusTiers || []).map((tier, index) => (
                  <div className="admin-form-grid" key={tier.id || index}>
                    <div className="form-group"><label>Tier {index + 1} earnings threshold</label><div className="money-input"><span>₦</span><input type="number" min="0" value={tier.threshold} onChange={(event) => updateSetting('bonusTiers', settings.bonusTiers.map((item, i) => i === index ? { ...item, threshold: event.target.value === '' ? '' : Number(event.target.value) } : item))} /></div></div>
                    <div className="form-group"><label>Tier {index + 1} bonus amount</label><div className="money-input"><span>₦</span><input type="number" min="0" value={tier.amount} onChange={(event) => updateSetting('bonusTiers', settings.bonusTiers.map((item, i) => i === index ? { ...item, amount: event.target.value === '' ? '' : Number(event.target.value) } : item))} /></div></div>
                    <button className="admin-delete-button" type="button" onClick={() => updateSetting('bonusTiers', settings.bonusTiers.filter((_, i) => i !== index))}>Remove Tier</button>
                  </div>
                ))}

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
              </>
            )}
              <details className="advanced-rules-details">
                <summary>Calculation safeguards</summary>
                <p>The core deduction, tier bonus, allowance and balance formulas are enforced by the app. The legacy formula editor is disabled so it cannot introduce unintended deductions.</p>
              </details>
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
                  Choose exactly one deduction rule
                </small>
              </span>

              <span className="admin-section-arrow">
                {adminSection === 'deductions' ? '⌃' : '⌄'}
              </span>
            </button>

            {adminSection === 'deductions' && (
              <div className="admin-section-body">
                <div className="form-group admin-full-width">
                  <label htmlFor="deductionMode">Deduction Calculation Mode</label>
                  <select
                    id="deductionMode"
                    value={settings.deductionMode || 'percentage'}
                    onChange={(event) => updateSetting('deductionMode', event.target.value)}
                  >
                    <option value="percentage">Percentage of shortfall</option>
                    <option value="fullShortfall">Full shortfall amount</option>
                  </select>
                  {settings.deductionMode !== 'fullShortfall' && settings.deductionMode !== 'actual' && (
                    <div className="form-group">
                      <label htmlFor="deductionPercentage">Deduction Percentage</label>
                      <div className="percentage-input">
                        <input
                          id="deductionPercentage"
                          type="number"
                          min="0"
                          max="100"
                          value={settings.deductionPercentage}
                          onChange={(event) => updateSetting('deductionPercentage', Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  )}
                  <p className="settings-help">
                    Only this deduction is applied. Special Deduction and Danger Zones are retained for compatibility but do not affect calculations.
                  </p>
                </div>
                <p className="settings-help">Only the deduction mode and percentage above affect deductions. Special deductions and Danger Zones are disabled and never change a balance.</p>
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


                          </div>

                        <div className="streamer-row-actions">
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


  <button
    className="admin-delete-button"
    type="button"
    onClick={() => deleteStreamer(streamer)}
  >
    Delete
  </button>
</div>
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

                            <p className="settings-help">Special deductions are disabled for all streamers.</p>

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
                            <button
                              className="admin-add-button"
                              type="button"
                              onClick={async () => {
                                try {
                                  const currentStreamer = streamers.find((item) => item.id === streamer.id)
                                  if (!currentStreamer) return
                                  await persistStreamer(currentStreamer)
                                  alert('Streamer saved to Firestore.')
                                } catch (error) {
                                  console.error('Streamer save error:', error)
                                  alert('Could not save this streamer.')
                                }
                              }}
                            >
                              Save Streamer
                            </button>
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
                    {'Uses the Admin deduction rule'}
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
        (record) => record.date === summaryDate
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
        (record) => record.earnings < settings.target
      ).length

      return (
        <>
          <header className="header">
            <h1>Daily Summary History</h1>
            <p>Choose a date to view its saved summary.</p>
          </header>


          <section className="calculator-card">
            <div className="form-group">
              <label htmlFor="summaryDate">Select summary date</label>
              <input
                id="summaryDate"
                type="date"
                value={summaryDate}
                onChange={(event) => setSummaryDate(event.target.value)}
              />
            </div>


            <button
              type="button"
              className="admin-add-button"
              onClick={() => setSummaryDate(new Date().toISOString().split('T')[0])}
            >
              Go to Today
            </button>
          </section>

      

          {todayRecords.length === 0 ? (
            <section className="calculator-card">
              <p>No records saved for this date yet.</p>
            </section>
          ) : (
            <>
             <section className="summary-list" id="todays-summary">
                {todayRecords.map((record) => (
                  <article
                    className="summary-card"
                    key={record.id}
                  >
                    <h2>{record.streamerName}</h2>
<div className="summary-row">
                      <span>Previous Salary</span>
                      <strong>
                        {formatNaira(record.previousBalance)}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Earnings</span>
                      <strong>
                        {formatNaira(record.earnings)}
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


                     <div className="summary-row">
                      <span>Balance</span>
                      <strong>
                         {formatNaira(record.previousBalance)} - {formatNaira(record.actualDeduction)} = {formatNaira(record.balance)}
                      </strong>
                    </div>


                    <div className="summary-row">
                      <span>Bonus For meeting a Target</span>
                      <strong>
                        {formatNaira(record.bonus)}
                      </strong>
                    </div>


                    <div className="summary-row">
                      <span>
              Extra Bonus (not added to balance):
             
            </span>
                      <strong>
                         {formatNaira(record.extraBonus)}
                      </strong>
                    </div>
                   

                    <div className="summary-row final-row">
                      <span>
                        New Salary
                      </span>
                      <strong>

                        {formatNaira(record.balance)} + {formatNaira(record.bonus)} = {formatNaira(record.newBalance)}

                      </strong>

                      
                      
                    </div>

                  </article>
                ))}
              </section>

              <section className="totals-card">
                {/* <h2>Daily Totals</h2>

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
                </div> */}


                <div className="report-actions">


                  

<button
  className="whatsapp-button"
  type="button"
  onClick={() => {
    const summary = document.getElementById('todays-summary')


    if (!summary) {
      alert("Today's Summary could not be found.")
      return
    }


    

const reportDate = new Date(
  `${summaryDate}T12:00:00`
).toLocaleDateString('en-NG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).toUpperCase()


const streamerReports = todayRecords
  .map((record) => {
    return `${record.streamerName}


Previous Salary: ${formatNaira(record.previousBalance)}


Earnings: ${formatNaira(record.earnings)}


Allowance: ${formatNaira(record.allowance)}


Deduction: ${formatNaira(record.actualDeduction)}


Balance: ${formatNaira(record.previousBalance)} - ${formatNaira(record.actualDeduction)} = ${formatNaira(record.balance)}


Bonus For meeting a Target: ${formatNaira(record.bonus)}


Extra Bonus (not added to balance): ${formatNaira(record.extraBonus)}


New Salary: ${formatNaira(record.balance)} + ${formatNaira(record.bonus)} = ${formatNaira(record.newBalance)}`
  })
  .join('\n\n━━━━━━━━━━━━━━━━━━\n\n')


const message = `DAILY STREAMER REPORT


${reportDate}


━━━━━━━━━━━━━━━━━━


${streamerReports}`




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
              <label htmlFor="legacyAllowanceCap">
                Allowance Earnings Cap
              </label>
              <div className="money-input">
                <span>₦</span>
                <input
                  id="legacyAllowanceCap"
                  type="number"
                  min="0"
                  value={settings.allowanceCap}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      allowanceCap: Number(event.target.value),
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

            <p className="settings-help">Special deductions and Danger Zones are disabled. Save changes from the Admin page.</p>

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
