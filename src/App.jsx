import { useState } from 'react'
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
  const [streamers, setStreamers] = useState(startingStreamers)
  const [settings, setSettings] = useState(defaultSettings)
  const [records, setRecords] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [streamerId, setStreamerId] = useState('')
  const [earnings, setEarnings] = useState('')
  const [result, setResult] = useState(null)

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
      status = 'settings.target ACHIEVED ✅'
    } else if (earningsAmount >= 26000) {
      status = 'BELOW settings.target ⚠️'
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
          className={activePage === 'more' ? 'active' : ''}
          onClick={() => setActivePage('more')}
        >
          More
        </button>
      </nav>
    </div>
  )
}

export default App
