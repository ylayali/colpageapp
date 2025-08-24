import { supabase, supabaseAdmin, User } from './supabase'

export const INITIAL_CREDITS = 0   // No free credits - users must sign up through GrooveFunnels
export const TRIAL_CREDITS = 3     // Credits given during GrooveFunnels 1-week trial
export const MONTHLY_CREDITS = 5   // Credits per month after trial converts to paid
export const YEARLY_CREDITS = 60   // 5 credits per month * 12 months

// Error types for better error handling
export class CreditError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'CreditError'
  }
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    console.log(`[getUserByEmail] Searching for user with email: ${email}`);
    
    if (!supabase) {
      throw new CreditError('Supabase client not available', 'NO_SUPABASE_CLIENT')
    }
    
    // First, let's check if there are multiple users with this email
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)

    if (allUsersError) {
      console.error(`[getUserByEmail] Error fetching all users:`, allUsersError);
      throw new CreditError(`Failed to get users: ${allUsersError.message}`, 'GET_USERS_ERROR')
    }

    console.log(`[getUserByEmail] Found ${allUsers?.length || 0} users with email ${email}:`, allUsers);

    if (!allUsers || allUsers.length === 0) {
      console.log(`[getUserByEmail] No users found with email ${email}`);
      return null;
    }

    if (allUsers.length > 1) {
      console.warn(`[getUserByEmail] Multiple users found with email ${email}, using the first one`);
    }

    return allUsers[0];
  } catch (error) {
    console.error(`[getUserByEmail] Error:`, error);
    if (error instanceof CreditError) {
      throw error
    }
    throw new CreditError('Unknown error getting user', 'UNKNOWN_ERROR')
  }
}

// Create a new user with initial credits
export async function createUser(id: string, email: string): Promise<User> {
  try {
    if (!supabase) {
      throw new CreditError('Supabase client not available', 'NO_SUPABASE_CLIENT')
    }
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        id,
        email,
        credits: INITIAL_CREDITS,
        subscription_type: null,
        subscription_tier: null,
        subscription_expires_at: null
      })
      .select()
      .single()

    if (error) {
      throw new CreditError(`Failed to create user: ${error.message}`, 'CREATE_USER_ERROR')
    }

    return data
  } catch (error) {
    if (error instanceof CreditError) {
      throw error
    }
    throw new CreditError('Unknown error creating user', 'UNKNOWN_ERROR')
  }
}

// Get or create user (useful for first-time users)
export async function getOrCreateUser(id: string, email: string): Promise<User> {
  try {
    let user = await getUserByEmail(email)
    
    if (!user) {
      user = await createUser(id, email)
    }

    return user
  } catch (error) {
    if (error instanceof CreditError) {
      throw error
    }
    throw new CreditError('Unknown error getting or creating user', 'UNKNOWN_ERROR')
  }
}

// Sign up a new user in Supabase Auth
export async function signUpUser(email: string, password?: string): Promise<string | null> {
  if (!password) {
    // If no password is provided, try to find existing user's ID
    const existingUser = await getUserByEmail(email);
    return existingUser?.id || null;
  }

  if (!supabaseAdmin) {
    throw new CreditError('Admin client not available', 'NO_ADMIN_CLIENT')
  }

  // Try to create the user. If they already exist, Supabase will return an error.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm the user's email
  })

  if (error) {
    // If the error is because the user already exists, that's fine - get their ID
    if (error.message.includes('User already registered') || 
        error.message.includes('already exists') ||
        error.message.includes('already registered') ||
        error.message.includes('has already been registered')) {
      const existingUser = await getUserByEmail(email);
      return existingUser?.id || null;
    }
    
    // For any other error, throw it
    throw new CreditError(`Failed to sign up user: ${error.message}`, 'SIGNUP_USER_ERROR')
  }

  return data.user?.id || null;
}

// Check if user has enough credits
export async function hasEnoughCredits(email: string, requiredCredits: number = 1): Promise<boolean> {
  try {
    const user = await getUserByEmail(email)
    
    if (!user) {
      return false
    }

    return user.credits >= requiredCredits
  } catch (error) {
    // If there's an error checking credits, default to allowing the operation
    // This is the "fail-open" approach to protect your image generation
    console.error('Error checking credits, defaulting to allow:', error)
    return true
  }
}

// Use credits (decrement)
export async function useCredits(email: string, amount: number = 1): Promise<User> {
  try {
    if (!supabase) {
      throw new CreditError('Supabase client not available', 'NO_SUPABASE_CLIENT')
    }
    
    const user = await getUserByEmail(email)
    
    if (!user) {
      throw new CreditError('User not found', 'USER_NOT_FOUND')
    }

    if (user.credits < amount) {
      throw new CreditError('Insufficient credits', 'INSUFFICIENT_CREDITS')
    }

    // Use admin client for updates to bypass RLS
    if (!supabaseAdmin) {
      throw new CreditError('Admin client not available for credit deduction', 'NO_ADMIN_CLIENT_DEDUCTION')
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ 
        credits: user.credits - amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)  // Use ID instead of email for unique identification
      .select()
      .single()

    if (error) {
      throw new CreditError(`Failed to use credits: ${error.message}`, 'USE_CREDITS_ERROR')
    }

    // Log the transaction
    await logCreditTransaction(user.id, -amount, 'usage', 'Image generation')

    return data
  } catch (error) {
    if (error instanceof CreditError) {
      throw error
    }
    throw new CreditError('Unknown error using credits', 'UNKNOWN_ERROR')
  }
}

// Add credits (for purchases)
export async function addCredits(email: string, amount: number, subscriptionType?: 'monthly' | 'yearly', authUserId?: string): Promise<User> {
  try {
    console.log(`[addCredits] Starting for email: ${email}, amount: ${amount}, authUserId: ${authUserId}`);
    
    let user = await getUserByEmail(email);
    console.log(`[addCredits] Found existing user:`, user ? `ID: ${user.id}, credits: ${user.credits}` : 'null');
    
    if (!user && authUserId) {
      // User doesn't exist in public table but we have their auth ID, so create them
      console.log(`[addCredits] Creating new user with authUserId: ${authUserId}`);
      user = await createUser(authUserId, email);
      console.log(`[addCredits] Created user:`, user ? `ID: ${user.id}, credits: ${user.credits}` : 'null');
    } else if (!user) {
      throw new CreditError('User not found and no auth ID provided', 'USER_NOT_FOUND');
    }
    
    const userWithCredits = user;
    
    const updateData: Record<string, unknown> = {
      credits: userWithCredits.credits + amount,
      updated_at: new Date().toISOString()
    }

    if (subscriptionType) {
      updateData.subscription_type = subscriptionType
      // Set expiration date based on subscription type
      const expirationDate = new Date()
      if (subscriptionType === 'monthly') {
        expirationDate.setMonth(expirationDate.getMonth() + 1)
      } else {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1)
      }
      updateData.subscription_expires_at = expirationDate.toISOString()
    }

    console.log(`[addCredits] Updating user ${userWithCredits.id} with:`, updateData);

    // First, verify the user still exists before updating
    if (!supabase) {
      throw new CreditError('Supabase client not available', 'NO_SUPABASE_CLIENT')
    }
    
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userWithCredits.id)
      .single()

    if (checkError) {
      console.error(`[addCredits] User verification failed:`, checkError);
      throw new CreditError(`User verification failed: ${checkError.message}`, 'USER_VERIFICATION_ERROR')
    }

    if (!existingUser) {
      console.error(`[addCredits] User ${userWithCredits.id} not found in database`);
      throw new CreditError('User not found in database', 'USER_NOT_FOUND_IN_DB')
    }

    console.log(`[addCredits] User verified, current credits: ${existingUser.credits}`);

    // Use admin client for updates to bypass RLS
    if (!supabaseAdmin) {
      throw new CreditError('Admin client not available for update', 'NO_ADMIN_CLIENT_UPDATE')
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData as Record<string, unknown>)
      .eq('id', userWithCredits.id)
      .select()

    if (error) {
      console.error(`[addCredits] Update failed:`, error);
      throw new CreditError(`Failed to add credits: ${error.message}`, 'ADD_CREDITS_ERROR')
    }

    if (!data || data.length === 0) {
      console.error(`[addCredits] No rows were updated for user ${userWithCredits.id}`);
      throw new CreditError('No user record was updated', 'NO_ROWS_UPDATED')
    }

    if (data.length > 1) {
      console.warn(`[addCredits] Multiple rows updated for user ${userWithCredits.id}, using first one`);
    }

    console.log(`[addCredits] Update successful:`, data[0]);
    
    const updatedUser = data[0];

    // Log the transaction
    await logCreditTransaction(userWithCredits.id, amount, 'purchase', `${subscriptionType || 'manual'} credit purchase`)

    return updatedUser
  } catch (error) {
    console.error(`[addCredits] Error:`, error);
    if (error instanceof CreditError) {
      throw error
    }
    throw new CreditError('Unknown error adding credits', 'UNKNOWN_ERROR')
  }
}

// Check if user can access multiple photos feature
export async function canAccessMultiplePhotos(email: string): Promise<boolean> {
  try {
    const user = await getUserByEmail(email)
    
    if (!user) {
      return false // No user found
    }

    // Basic tier cannot access multiple photos, all other tiers can
    if (user.subscription_tier === 'basic') {
      return false
    }

    // Standard, premium, or null (trial/legacy users) can access multiple photos
    return true
  } catch (error) {
    // If there's an error checking tier, default to allowing the operation
    // This is the "fail-open" approach to protect functionality
    console.error('Error checking subscription tier, defaulting to allow:', error)
    return true
  }
}

// Get user's current credit balance
export async function getCreditBalance(email: string): Promise<number> {
  try {
    const user = await getUserByEmail(email)
    return user ? user.credits : 0
  } catch (error) {
    // If there's an error, return 0 credits (fail-safe)
    console.error('Error getting credit balance, defaulting to 0:', error)
    return 0
  }
}

// Log credit transactions for auditing
async function logCreditTransaction(
  userId: string, 
  amount: number, 
  transactionType: 'purchase' | 'usage' | 'refund',
  description: string
): Promise<void> {
  try {
    // Use admin client for transaction logging to bypass RLS
    if (!supabaseAdmin) {
      console.warn('Admin client not available for transaction logging, skipping...')
      return
    }

    const { error } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount,
        transaction_type: transactionType,
        description
      })

    if (error) {
      console.error('Failed to log credit transaction:', error)
      // Don't throw error here - logging failure shouldn't break the main operation
    }
  } catch (error) {
    console.error('Error logging credit transaction:', error)
    // Don't throw error here - logging failure shouldn't break the main operation
  }
}
