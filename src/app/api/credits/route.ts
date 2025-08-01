import { NextRequest, NextResponse } from 'next/server'
import { addCredits, getCreditBalance, signUpUser, TRIAL_CREDITS, MONTHLY_CREDITS, YEARLY_CREDITS } from '@/lib/credit-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received webhook body:', JSON.stringify(body, null, 2));
    const { buyer_email: email, subscription_type, event, password, action } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Handle manual API calls with action parameter
    if (action === 'get_balance') {
      const balance = await getCreditBalance(email)
      return NextResponse.json({ credits: balance })
    }

    // Handle GrooveSell webhook events or manual add_credits calls
    if (event || action === 'add_credits') {
      let creditsToAdd: number
      let subscriptionTypeForDb: 'monthly' | 'yearly' | undefined

      // Only process specific events to avoid duplicate credit additions
      if (event === 'subscription-trial-start') {
        // Trial start event - give trial credits
        creditsToAdd = TRIAL_CREDITS
        subscriptionTypeForDb = undefined // Don't set subscription type for trial
      } else if (event === 'subscription-payment' && parseFloat(body.amount || '0') > 0) {
        // Paid subscription payment (amount > 0)
        creditsToAdd = MONTHLY_CREDITS
        subscriptionTypeForDb = 'monthly'
      } else if (action === 'add_credits') {
        // Manual API call
        if (subscription_type === 'trial') {
          creditsToAdd = TRIAL_CREDITS
          subscriptionTypeForDb = undefined
        } else if (subscription_type === 'monthly') {
          creditsToAdd = MONTHLY_CREDITS
          subscriptionTypeForDb = 'monthly'
        } else if (subscription_type === 'yearly') {
          creditsToAdd = YEARLY_CREDITS
          subscriptionTypeForDb = 'yearly'
        } else {
          creditsToAdd = TRIAL_CREDITS
          subscriptionTypeForDb = undefined
        }
      } else {
        // Ignore other events (like "sales" or $0.00 "subscription-payment")
        return NextResponse.json({
          success: true,
          message: `Event '${event}' ignored - no credits added`
        })
      }

      // First, ensure the user exists in the auth system
      const authUserId = await signUpUser(email, password)

      const updatedUser = await addCredits(email, creditsToAdd, subscriptionTypeForDb, authUserId || undefined)
      
      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: `Added ${creditsToAdd} credits for ${event || subscription_type || 'purchase'}`
      })
    }

    return NextResponse.json({ error: 'Invalid request - no valid action or event found' }, { status: 400 })

  } catch (error: unknown) {
    console.error('Error in credits API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    const credits = await getCreditBalance(email)
    return NextResponse.json({ credits })
    
  } catch (error: unknown) {
    console.error('Error getting credits:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 500 })
  }
}
