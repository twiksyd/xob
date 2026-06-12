// Supplier restock economics — shared by CapitalReadinessTracker and RestockAdvisor
export const ACCOUNT_COST = 1035                       // PHP per supplier account
export const ACCOUNT_ROBUX = 4500                      // Robux per account
export const MAX_ACCOUNTS = 5                          // Maximum restock cycle
export const FIXED_CAPITAL = ACCOUNT_COST * MAX_ACCOUNTS    // 5,175
export const MAX_INVENTORY = ACCOUNT_ROBUX * MAX_ACCOUNTS   // 22,500

// Restock Advisor tuning
export const VELOCITY_WINDOW_DAYS = 14                 // rolling window for average daily Robux sold
export const TARGET_RUNWAY_DAYS = 14                   // minimum days of inventory to stay "Healthy"
