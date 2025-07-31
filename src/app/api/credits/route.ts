import { NextRequest, NextResponse } from 'next/server'
import { addCredits, getCreditBalance, TRIAL_CREDITS, MONTHLY_CREDITS, YEARLY_CREDITS } from '@/lib/credit-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, subscription_type, action } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (action === 'get_balance') {
      const balance = await getCreditBalance(email)
      return NextResponse.json({ credits: balance })
    }

    if (action === 'add_credits') {
      if (!subscription_type || !['trial', 'monthly', 'yearly'].includes(subscription_type)) {
        return NextResponse.json({ error: 'Valid subscription_type is required (trial, monthly, or yearly)' }, { status: 400 })
      }

      let creditsToAdd: number
      let subscriptionTypeForDb: 'monthly' | 'yearly' | undefined

      if (subscription_type === 'trial') {
        creditsToAdd = TRIAL_CREDITS
        subscriptionTypeForDb = undefined // Don't set subscription type for trial
      } else if (subscription_type === 'monthly') {
        creditsToAdd = MONTHLY_CREDITS
        subscriptionTypeForDb = 'monthly'
      } else {
        creditsToAdd = YEARLY_CREDITS
        subscriptionTypeForDb = 'yearly'
      }

      const updatedUser = await addCredits(email, creditsToAdd, subscriptionTypeForDb)
      
      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: `Added ${creditsToAdd} credits for ${subscription_type}`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Error in credits API:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process credit request' 
    }, { status: 500 })
  }
}

// GET endpoint to check credit balance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 })
    }

    const balance = await getCreditBalance(email)
    return NextResponse.json({ credits: balance })

  } catch (error: any) {
    console.error('Error getting credit balance:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to get credit balance' 
    }, { status: 500 })
  }
}
