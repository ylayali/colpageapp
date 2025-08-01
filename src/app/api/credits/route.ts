import { NextRequest, NextResponse } from 'next/server'
import { addCredits, getCreditBalance, TRIAL_CREDITS, MONTHLY_CREDITS, YEARLY_CREDITS } from '@/lib/credit-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received webhook body:', JSON.stringify(body, null, 2));
    const { buyer_email: email, subscription_type, action } = body

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
