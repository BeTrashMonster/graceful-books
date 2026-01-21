/**
 * Scenario Modeler Service
 *
 * Enables "what-if" scenario modeling for runway planning.
 * Users can explore how changes in revenue or expenses affect runway.
 *
 * Implements J6: Emergency Fund & Runway Calculator from ROADMAP.md
 *
 * Features:
 * - Revenue scenario modeling (client loss, new contract, price changes)
 * - Expense scenario modeling (new hire, expense cuts, delayed purchases)
 * - Combined scenarios (revenue + expense changes)
 * - Smart scenario suggestions based on actual book data
 * - Real-time runway impact calculation
 */

import Decimal from 'decimal.js'
import type {
  RunwayScenario,
  SmartScenarioSuggestion,
  RevenueScenario,
  ExpenseScenario,
  RevenueBreakdown,
  BurnRateAnalysis,
} from '../../types/runway.types'

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Calculate runway months (extracted for reuse)
 */
function calculateRunwayMonths(availableCash: number, monthlyBurnRate: number): number | null {
  // If burning cash (negative net burn), calculate months of runway
  if (monthlyBurnRate < 0) {
    const monthlyBurn = Math.abs(monthlyBurnRate)
    if (monthlyBurn === 0) return null
    return availableCash / monthlyBurn
  }

  // If cash flow positive, runway is infinite
  return null
}

/**
 * Generate unique scenario ID
 */
function generateScenarioId(): string {
  return `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Determine scenario impact
 */
function determineImpact(
  currentRunway: number | null,
  newRunway: number | null
): 'positive' | 'negative' | 'neutral' {
  // If both infinite, neutral
  if (currentRunway === null && newRunway === null) return 'neutral'

  // If went from finite to infinite, positive
  if (currentRunway !== null && newRunway === null) return 'positive'

  // If went from infinite to finite, negative
  if (currentRunway === null && newRunway !== null) return 'negative'

  // Both finite, compare
  if (currentRunway !== null && newRunway !== null) {
    if (newRunway > currentRunway) return 'positive'
    if (newRunway < currentRunway) return 'negative'
  }

  return 'neutral'
}

/**
 * Generate impact description
 */
function generateImpactDescription(
  currentRunway: number | null,
  newRunway: number | null,
  _currentNetBurn: number,
  _newNetBurn: number
): string {
  const impact = determineImpact(currentRunway, newRunway)

  if (impact === 'positive') {
    if (currentRunway === null && newRunway === null) {
      return 'Your cash flow remains positive.'
    }
    if (newRunway === null) {
      return 'This would make you cash flow positive - runway extends indefinitely!'
    }
    const extension = (newRunway! - currentRunway!).toFixed(1)
    return `Runway extends from ${currentRunway!.toFixed(1)} to ${newRunway!.toFixed(1)} months (+${extension} months).`
  }

  if (impact === 'negative') {
    if (currentRunway === null) {
      return `This would make you cash flow negative - runway becomes ${newRunway!.toFixed(1)} months.`
    }
    if (newRunway === null) {
      return 'This scenario is not financially viable with current cash reserves.'
    }
    const reduction = (currentRunway! - newRunway!).toFixed(1)
    return `Runway reduces from ${currentRunway!.toFixed(1)} to ${newRunway!.toFixed(1)} months (-${reduction} months).`
  }

  return 'This change would have minimal impact on your runway.'
}

/**
 * Model a revenue change scenario
 */
export function modelRevenueScenario(
  currentRevenue: number,
  currentExpenses: number,
  currentCash: number,
  revenueChange: RevenueScenario,
  name?: string
): RunwayScenario {
  const currentNetBurn = currentRevenue - currentExpenses
  const currentRunway = calculateRunwayMonths(currentCash, currentNetBurn)

  const newRevenue = new Decimal(currentRevenue)
    .plus(revenueChange.type === 'increase' || revenueChange.type === 'new-contract' ? revenueChange.amount : 0)
    .minus(revenueChange.type === 'decrease' || revenueChange.type === 'client-loss' ? revenueChange.amount : 0)
    .toNumber()

  const newNetBurn = newRevenue - currentExpenses
  const newRunway = calculateRunwayMonths(currentCash, newNetBurn)

  const impact = determineImpact(currentRunway, newRunway)
  const impactDescription = generateImpactDescription(currentRunway, newRunway, currentNetBurn, newNetBurn)

  return {
    id: generateScenarioId(),
    name: name || revenueChange.description,
    scenarioType: 'revenue-decrease',
    revenueChange,
    currentNetBurn,
    newNetBurn,
    currentRunway,
    newRunway,
    impact,
    impactDescription,
    createdAt: new Date(),
    saved: false,
  }
}

/**
 * Model an expense change scenario
 */
export function modelExpenseScenario(
  currentRevenue: number,
  currentExpenses: number,
  currentCash: number,
  expenseChange: ExpenseScenario,
  name?: string
): RunwayScenario {
  const currentNetBurn = currentRevenue - currentExpenses
  const currentRunway = calculateRunwayMonths(currentCash, currentNetBurn)

  const newExpenses = new Decimal(currentExpenses)
    .plus(expenseChange.type === 'increase' || expenseChange.type === 'new-hire' ? expenseChange.amount : 0)
    .minus(expenseChange.type === 'decrease' || expenseChange.type === 'cut-expense' || expenseChange.type === 'delay-purchase' ? expenseChange.amount : 0)
    .toNumber()

  const newNetBurn = currentRevenue - newExpenses
  const newRunway = calculateRunwayMonths(currentCash, newNetBurn)

  const impact = determineImpact(currentRunway, newRunway)
  const impactDescription = generateImpactDescription(currentRunway, newRunway, currentNetBurn, newNetBurn)

  return {
    id: generateScenarioId(),
    name: name || expenseChange.description,
    scenarioType: 'expense-decrease',
    expenseChange,
    currentNetBurn,
    newNetBurn,
    currentRunway,
    newRunway,
    impact,
    impactDescription,
    createdAt: new Date(),
    saved: false,
  }
}

/**
 * Model a combined scenario (revenue + expense changes)
 */
export function modelCombinedScenario(
  currentRevenue: number,
  currentExpenses: number,
  currentCash: number,
  revenueChange: RevenueScenario,
  expenseChange: ExpenseScenario,
  name?: string
): RunwayScenario {
  const currentNetBurn = currentRevenue - currentExpenses
  const currentRunway = calculateRunwayMonths(currentCash, currentNetBurn)

  const newRevenue = new Decimal(currentRevenue)
    .plus(revenueChange.type === 'increase' || revenueChange.type === 'new-contract' ? revenueChange.amount : 0)
    .minus(revenueChange.type === 'decrease' || revenueChange.type === 'client-loss' ? revenueChange.amount : 0)
    .toNumber()

  const newExpenses = new Decimal(currentExpenses)
    .plus(expenseChange.type === 'increase' || expenseChange.type === 'new-hire' ? expenseChange.amount : 0)
    .minus(expenseChange.type === 'decrease' || expenseChange.type === 'cut-expense' || expenseChange.type === 'delay-purchase' ? expenseChange.amount : 0)
    .toNumber()

  const newNetBurn = newRevenue - newExpenses
  const newRunway = calculateRunwayMonths(currentCash, newNetBurn)

  const impact = determineImpact(currentRunway, newRunway)
  const impactDescription = generateImpactDescription(currentRunway, newRunway, currentNetBurn, newNetBurn)

  return {
    id: generateScenarioId(),
    name: name || `${revenueChange.description} + ${expenseChange.description}`,
    scenarioType: 'combined',
    revenueChange,
    expenseChange,
    currentNetBurn,
    newNetBurn,
    currentRunway,
    newRunway,
    impact,
    impactDescription,
    createdAt: new Date(),
    saved: false,
  }
}

/**
 * Model a custom scenario with slider values
 */
export function modelCustomScenario(
  currentRevenue: number,
  currentExpenses: number,
  currentCash: number,
  newRevenue: number,
  newExpenses: number,
  name: string = 'Custom scenario'
): RunwayScenario {
  const currentNetBurn = currentRevenue - currentExpenses
  const currentRunway = calculateRunwayMonths(currentCash, currentNetBurn)

  const newNetBurn = newRevenue - newExpenses
  const newRunway = calculateRunwayMonths(currentCash, newNetBurn)

  const impact = determineImpact(currentRunway, newRunway)
  const impactDescription = generateImpactDescription(currentRunway, newRunway, currentNetBurn, newNetBurn)

  const revenueDiff = newRevenue - currentRevenue
  const expenseDiff = newExpenses - currentExpenses

  return {
    id: generateScenarioId(),
    name,
    scenarioType: 'custom',
    revenueChange: {
      type: revenueDiff >= 0 ? 'increase' : 'decrease',
      amount: Math.abs(revenueDiff),
      description: `Revenue ${revenueDiff >= 0 ? 'increase' : 'decrease'} of $${Math.abs(revenueDiff).toFixed(0)}`,
    },
    expenseChange: {
      type: expenseDiff >= 0 ? 'increase' : 'decrease',
      amount: Math.abs(expenseDiff),
      description: `Expense ${expenseDiff >= 0 ? 'increase' : 'decrease'} of $${Math.abs(expenseDiff).toFixed(0)}`,
    },
    currentNetBurn,
    newNetBurn,
    currentRunway,
    newRunway,
    impact,
    impactDescription,
    createdAt: new Date(),
    saved: false,
  }
}

/**
 * Generate smart scenario suggestions based on actual book data
 */
export function generateSmartSuggestions(
  revenueBreakdown: RevenueBreakdown,
  burnRateAnalysis: BurnRateAnalysis,
  currentRevenue: number,
  _currentExpenses: number
): SmartScenarioSuggestion[] {
  const suggestions: SmartScenarioSuggestion[] = []

  // Suggest modeling loss of top client if they represent significant revenue
  if (revenueBreakdown.topClients.length > 0) {
    const topClient = revenueBreakdown.topClients[0]!
    if (topClient.percentage > 15) {
      suggestions.push({
        id: `suggestion-top-client`,
        title: `What if you lost ${topClient.name}?`,
        description: `Model the impact of losing your biggest client (${topClient.percentage.toFixed(0)}% of revenue).`,
        scenarioType: 'client-loss',
        priority: topClient.percentage > 30 ? 'high' : 'medium',
        reason: `High concentration: ${topClient.name} represents ${topClient.percentage.toFixed(0)}% of revenue`,
        revenueChange: {
          type: 'client-loss',
          amount: topClient.monthlyAmount,
          description: `Lost ${topClient.name} retainer`,
          clientId: topClient.id,
          clientName: topClient.name,
        },
      })
    }
  }

  // Suggest modeling discontinuing top product if it's significant
  if (revenueBreakdown.topProducts.length > 0) {
    const topProduct = revenueBreakdown.topProducts[0]!
    if (topProduct.percentage > 20) {
      suggestions.push({
        id: `suggestion-top-product`,
        title: `What if you stopped offering ${topProduct.name}?`,
        description: `Model the impact of discontinuing your top revenue source (${topProduct.percentage.toFixed(0)}% of revenue).`,
        scenarioType: 'product-discontinue',
        priority: 'medium',
        reason: `${topProduct.name} represents ${topProduct.percentage.toFixed(0)}% of revenue`,
        revenueChange: {
          type: 'decrease',
          amount: topProduct.monthlyAmount,
          description: `Discontinued ${topProduct.name}`,
        },
      })
    }
  }

  // Suggest modeling cutting top expense
  if (burnRateAnalysis.topExpenseCategories.length > 0) {
    const topExpense = burnRateAnalysis.topExpenseCategories[0]!
    if (topExpense.percentage > 15) {
      suggestions.push({
        id: `suggestion-top-expense`,
        title: `What if you reduced ${topExpense.name}?`,
        description: `Your top expense is ${topExpense.name} (${topExpense.percentage.toFixed(0)}% of spending). Model reducing it.`,
        scenarioType: 'expense-decrease',
        priority: 'medium',
        reason: `${topExpense.name} is your largest expense at ${topExpense.percentage.toFixed(0)}% of burn`,
        expenseChange: {
          type: 'cut-expense',
          amount: topExpense.monthlyAmount * 0.25, // Suggest 25% reduction
          description: `Reduce ${topExpense.name} by 25%`,
          categoryId: topExpense.id,
          categoryName: topExpense.name,
        },
      })
    }
  }

  // Suggest modeling 10% price increase
  if (currentRevenue > 0) {
    const priceIncrease = currentRevenue * 0.1
    suggestions.push({
      id: `suggestion-price-increase`,
      title: 'What if you raised prices by 10%?',
      description: 'Model the impact of a modest price increase across all offerings.',
      scenarioType: 'price-increase',
      priority: 'low',
      reason: 'Price optimization can significantly improve runway',
      revenueChange: {
        type: 'price-change',
        amount: priceIncrease,
        description: '10% price increase',
      },
    })
  }

  // Suggest modeling new hire impact
  const avgSalaryWithBenefits = 5000 // Reasonable estimate for mid-level hire
  suggestions.push({
    id: `suggestion-new-hire`,
    title: 'What if you hired a new team member?',
    description: 'Model the impact of adding a $5k/month team member (salary + benefits).',
    scenarioType: 'new-hire',
    priority: 'low',
    reason: 'Understanding hiring impact helps with growth planning',
    expenseChange: {
      type: 'new-hire',
      amount: avgSalaryWithBenefits,
      description: 'New hire at $5k/month',
    },
  })

  return suggestions
}

/**
 * Calculate target runway achievement plan
 */
export function calculateActionPlan(
  currentCash: number,
  currentRevenue: number,
  currentExpenses: number,
  currentRunway: number | null,
  targetMonths: number
): {
  approach: 'reduce-burn' | 'increase-cash' | 'both'
  monthlyBurnReduction?: number
  cashReserveIncrease?: number
  timeToTarget?: number
  description: string
} {
  // If already at or above target, no action needed
  if (currentRunway !== null && currentRunway >= targetMonths) {
    return {
      approach: 'both',
      description: `You've already reached your target of ${targetMonths} months. Great work!`,
    }
  }

  // If cash flow positive, user is already in good shape
  if (currentRunway === null) {
    const targetCash = targetMonths * currentExpenses
    const cashNeeded = targetCash - currentCash

    if (cashNeeded <= 0) {
      return {
        approach: 'both',
        description: `You're cash flow positive with ${targetMonths}+ months of reserves. Excellent!`,
      }
    }

    return {
      approach: 'increase-cash',
      cashReserveIncrease: cashNeeded,
      description: `Build reserves to $${cashNeeded.toFixed(0)} for ${targetMonths} months of buffer.`,
    }
  }

  const currentNetBurn = currentRevenue - currentExpenses
  const monthlyBurn = Math.abs(currentNetBurn)

  // Calculate what's needed to reach target
  const targetCash = targetMonths * monthlyBurn

  if (currentCash < targetCash) {
    const cashNeeded = targetCash - currentCash

    // Option 1: Reduce burn
    const burnReductionNeeded = monthlyBurn - currentCash / targetMonths

    // Option 2: Increase cash reserves
    const savingsPerMonth = Math.min(monthlyBurn * 0.2, 1000) // Save 20% of burn or $1k, whichever is less
    const monthsToSave = cashNeeded / savingsPerMonth

    if (burnReductionNeeded < monthlyBurn * 0.3) {
      // If less than 30% burn reduction needed, suggest that
      return {
        approach: 'reduce-burn',
        monthlyBurnReduction: burnReductionNeeded,
        description: `Reduce monthly burn by $${burnReductionNeeded.toFixed(0)} to reach ${targetMonths} months runway.`,
      }
    } else {
      // Otherwise suggest building reserves
      return {
        approach: 'increase-cash',
        cashReserveIncrease: cashNeeded,
        timeToTarget: Math.ceil(monthsToSave),
        description: `Add $${cashNeeded.toFixed(0)} to reserves, or save $${savingsPerMonth.toFixed(0)}/month for ${Math.ceil(monthsToSave)} months.`,
      }
    }
  }

  return {
    approach: 'both',
    description: 'You have sufficient cash reserves for your target runway.',
  }
}
