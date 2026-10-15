function requireNumber(settings, key, { min = 0, max = Infinity } = {}) {
  const value = settings?.[key];


  if (
    value === undefined ||
    value === null ||
    value === '' ||
    !Number.isFinite(Number(value))
  ) {
    throw new Error(`Missing or invalid Firestore setting: ${key}`);
  }


  const number = Number(value);


  if (number < min || number > max) {
    throw new Error(`Firestore setting "${key}" must be between ${min} and ${max}.`);
  }


  return number;
}


function requireBoolean(settings, key) {
  if (typeof settings?.[key] !== 'boolean') {
    throw new Error(`Missing or invalid Firestore setting: ${key}`);
  }


  return settings[key];
}


export function evaluateFormula() {
  throw new Error('Custom formula execution is disabled. Configure supported settings in Admin.');
}


export function calculateWithRules(earnings, openingBalance, settings) {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Firestore calculation settings are missing.');
  }


  const earned = Number(earnings);
  const opening = Number(openingBalance);


  if (!Number.isFinite(earned) || earned < 0) {
    throw new Error('Earnings must be a valid non-negative number.');
  }


  if (!Number.isFinite(opening)) {
    throw new Error('Opening balance must be a valid number.');
  }


  const target = requireNumber(settings, 'target');
  const deductionPercentage = requireNumber(settings, 'deductionPercentage', {
    min: 0,
    max: 100,
  });


  const deductionMode = settings.deductionMode;


  if (!['percentage', 'fullShortfall'].includes(deductionMode)) {
    throw new Error('Choose a valid deduction mode in Admin and save it to Firestore.');
  }


  const allowancePercentage = requireNumber(settings, 'allowancePercentage', {
    min: 0,
    max: 100,
  });


  const targetAllowance = requireNumber(settings, 'targetAllowance');
  const addAllowanceToBalance = requireBoolean(settings, 'addAllowanceToBalance');
  const bonusTiers = settings.bonusTiers;


  if (!Array.isArray(bonusTiers)) {
    throw new Error('Bonus tiers are missing from Firestore settings.');
  }


  for (const tier of bonusTiers) {
    if (
      !Number.isFinite(Number(tier?.threshold)) ||
      Number(tier.threshold) < 0 ||
      !Number.isFinite(Number(tier?.amount)) ||
      Number(tier.amount) < 0
    ) {
      throw new Error('A Firestore bonus tier is invalid.');
    }
  }


  const shortfall = Math.max(0, target - earned);


  const actualDeduction = deductionMode === 'fullShortfall'
    ? shortfall
    : shortfall * deductionPercentage / 100;


  const qualifyingTiers = bonusTiers
    .filter((tier) => earned >= Number(tier.threshold))
    .sort((a, b) => Number(b.threshold) - Number(a.threshold));


  const bonus = qualifyingTiers.length
    ? Number(qualifyingTiers[0].amount)
    : 0;


  const allowance = earned >= target
    ? targetAllowance
    : earned * allowancePercentage / 100;


  const extraBonusRate = requireNumber(settings, 'bonusPercentage', {
    min: 0,
    max: 100,
  });


  const extraBonus = Math.max(0, earned - target) * extraBonusRate / 100;
  const allowanceAdded = addAllowanceToBalance ? allowance : 0;


  const newBalance = Math.max(
    0,
    opening + bonus + allowanceAdded - actualDeduction
  );


  return {
    earnings: earned,
    previousBalance: opening,
    target,
    shortfall,
    deductionMode,
    deductionPercentage,
    actualDeduction,
    normalDeduction: 0,
    extraDeduction: 0,
    tenPercentDeduction: 0,
    standardDeduction: 0,
    bonus,
    allowance,
    extraBonus,
    newBalance,
    status: earned >= target ? 'TARGET ACHIEVED ✅' : 'BELOW TARGET 🚨',
  };
}
