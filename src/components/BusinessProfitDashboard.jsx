export default function BusinessProfitDashboard({
records,
expenses,
formatNaira,
profitStartDate,
setProfitStartDate,
profitEndDate,
setProfitEndDate,
expenseName,
setExpenseName,
expenseAmount,
setExpenseAmount,
expenseDate,
setExpenseDate,
expenseNotes,
setExpenseNotes,
handleAddExpense,
handleDeleteExpense,
}) {
    const validStart = profitStartDate
    const validEnd = profitEndDate
    const dateRangeValid = validStart <= validEnd


    const periodRecords = dateRangeValid
      ? records.filter((record) => record.date >= validStart && record.date <= validEnd)
      : []


    const periodExpenses = dateRangeValid
      ? expenses.filter((expense) => expense.date >= validStart && expense.date <= validEnd)
      : []


    const monthlyBaseSalary = 150000


    const totalEarnings = periodRecords.reduce(
      (sum, record) => sum + (Number(record.earnings) || 0), 0
    )


    // Accrue base salary only for dates that have saved streamer records.
    // const baseSalaryExpense = periodRecords.reduce((sum, record) => {
    //   const [year, month] = String(record.date || '').split('-').map(Number)
    //   if (!year || !month) return sum
    //   const daysInMonth = new Date(year, month, 0).getDate()
    //   return sum + (monthlyBaseSalary / daysInMonth)
    // }, 0)


    const baseSalaryExpense = periodRecords.reduce(
      (sum, record) => sum + (Number(record.allowance) || 0), 0
    )
    const allowanceExpense = periodRecords.reduce(
      (sum, record) => sum + (Number(record.allowance) || 0), 0
    )
    const targetBonusExpense = periodRecords.reduce(
      (sum, record) => sum + (Number(record.bonus) || 0), 0
    )
    const extraBonusExpense = periodRecords.reduce(
      (sum, record) => sum + (Number(record.extraBonus) || 0), 0
    )
    const manualExpensesTotal = periodExpenses.reduce(
      (sum, expense) => sum + (Number(expense.amount) || 0), 0
    )


    const totalAutomaticExpenses =
      baseSalaryExpense +
      allowanceExpense +
      targetBonusExpense +
      extraBonusExpense


    const totalExpenses = totalAutomaticExpenses + manualExpensesTotal
    const netProfit = totalEarnings - totalExpenses


    // Informational only: deductions are not counted as another expense.
    const totalDeductions = periodRecords.reduce(
      (sum, record) => sum + (Number(record.actualDeduction) || 0), 0
    )


    const sortedExpenses = [...periodExpenses].sort(
      (a, b) => String(b.date).localeCompare(String(a.date))
    )


    return (
      <>
        <header className="header profit-page-header">
          <h1>Business Profit</h1>
          <p>Track your earnings, expenses, and net profit.</p>
        </header>


        <section className="profit-net-card">
          <span>PERSONAL NET PROFIT</span>
          <strong>{formatNaira(netProfit)}</strong>
          <p>Total earnings minus recorded expenses</p>
        </section>


        <section className="profit-kpi-grid">
          <article className="profit-kpi-card">
            <span>Total Earnings</span>
            <strong>{formatNaira(totalEarnings)}</strong>
            <small>{periodRecords.length} saved streamer records</small>
          </article>
          <article className="profit-kpi-card">
            <span>Total Expenses</span>
            <strong>{formatNaira(totalExpenses)}</strong>
            <small>Automatic costs + {periodExpenses.length} manual expenses</small>
          </article>
        </section>


        <section className="profit-panel">
          <h2>Automatic Expense Breakdown</h2>
          <p>
            Base salary accrues only on dates with saved streamer records.
            Monthly base salary is {formatNaira(monthlyBaseSalary)} per streamer.
          </p>


          <div className="profit-kpi-grid">
            <article className="profit-kpi-card">
              <span>Base Salary Accrual</span>
              <strong>{formatNaira(baseSalaryExpense)}</strong>
              <small>Monthly salary divided by calendar days</small>
            </article>
            <article className="profit-kpi-card">
              <span>Allowances</span>
              <strong>{formatNaira(allowanceExpense)}</strong>
              <small>From saved daily records</small>
            </article>
            <article className="profit-kpi-card">
              <span>Target Bonuses</span>
              <strong>{formatNaira(targetBonusExpense)}</strong>
              <small>From saved daily records</small>
            </article>
            <article className="profit-kpi-card">
              <span>Extra Bonuses</span>
              <strong>{formatNaira(extraBonusExpense)}</strong>
              <small>Expense only; not added to salary balance</small>
            </article>
            <article className="profit-kpi-card">
              <span>Manual Expenses</span>
              <strong>{formatNaira(manualExpensesTotal)}</strong>
              <small>Expenses entered on this page</small>
            </article>
            <article className="profit-kpi-card">
              <span>Deductions (Information Only)</span>
              <strong>{formatNaira(totalDeductions)}</strong>
              <small>Not counted again as an expense</small>
            </article>
          </div>
        </section>


        <section className="profit-panel">
          <h2>Report Period</h2>
          <p>These dates apply to earnings, expenses, and net profit.</p>
          <div className="profit-period-controls">
            <label>
              Start date
              <input
                type="date"
                value={profitStartDate}
                onChange={(event) => setProfitStartDate(event.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={profitEndDate}
                onChange={(event) => setProfitEndDate(event.target.value)}
              />
            </label>
          </div>
          {!dateRangeValid && (
            <p className="profit-validation">Start date must be on or before end date.</p>
          )}
          <button
            type="button"
            className="profit-secondary-button"
            onClick={() => {
              const today = new Date().toISOString().split('T')[0]
              setProfitStartDate(today)
              setProfitEndDate(today)
            }}
          >
            Show Today
          </button>
          <button
            type="button"
            className="profit-secondary-button"
            onClick={() => {
              const today = new Date().toISOString().split('T')[0]
              setProfitStartDate(`${today.slice(0, 7)}-01`)
              setProfitEndDate(today)
            }}
          >
            This Month
          </button>
        </section>


        <section className="profit-panel">
          <h2>Add an Expense</h2>
          <p>Record business costs such as supplies, delivery, transport, or bills.</p>
          <form className="profit-expense-form" onSubmit={handleAddExpense}>
            <label>
              Expense name
              <input
                type="text"
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
                placeholder="e.g. Delivery, ingredients, electricity"
                required
              />
            </label>
            <label>
              Amount (₦)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="Enter amount"
                required
              />
            </label>
            <label>
              Expense date
              <input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
              />
            </label>
            <label>
              Notes (optional)
              <textarea
                value={expenseNotes}
                onChange={(event) => setExpenseNotes(event.target.value)}
                placeholder="Add a short description"
                rows="2"
              />
            </label>
            <button className="profit-primary-button" type="submit">
              Save Expense
            </button>
          </form>
        </section>


        <section className="profit-panel">
          <div className="profit-list-heading">
            <div>
              <h2>Expenses</h2>
              <p>Expenses within the selected date range.</p>
            </div>
            <strong>{periodExpenses.length}</strong>
          </div>


          {sortedExpenses.length === 0 ? (
            <p className="profit-empty-state">
              No expenses recorded for this period.
            </p>
          ) : (
            <div className="profit-expense-list">
              {sortedExpenses.map((expense) => (
                <article className="profit-expense-row" key={expense.id}>
                  <div className="profit-expense-details">
                    <strong>{expense.name}</strong>
                    <span>{expense.date}</span>
                    {expense.notes && <p>{expense.notes}</p>}
                  </div>
                  <div className="profit-expense-actions">
                    <strong>{formatNaira(expense.amount)}</strong>
                    <button
                      type="button"
                      className="profit-delete-button"
                      onClick={() => handleDeleteExpense(expense)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="profit-disclaimer">
          Earnings are summed from saved daily streamer records. Total expenses
          include base salary accrual of {formatNaira(monthlyBaseSalary)} per
          streamer per month (accrued only on saved-record dates), saved-record
          allowances and bonuses, plus manual expenses. Deductions are displayed
          separately and are not added again as expenses. Existing salary
          calculation rules and streamer balances are unchanged.
        </p>
      </>
    )
  }
