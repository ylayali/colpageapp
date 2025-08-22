import { NextRequest, NextResponse } from 'next/server'
import { addCredits, signUpUser, TRIAL_CREDITS, getUserByEmail } from '@/lib/credit-utils'

// Product ID to subscription tier mapping
const PRODUCT_TIER_MAPPING: Record<string, {
  tier: 'basic' | 'standard' | 'premium',
  monthlyCredits: number,
  yearlyCredits: number
}> = {
  // Basic Tier
  '90143': { tier: 'basic', monthlyCredits: 5, yearlyCredits: 60 },
  
  // Standard Tier  
  '90211': { tier: 'standard', monthlyCredits: 10, yearlyCredits: 120 },
  
  // Premium Tier
  '90212': { tier: 'premium', monthlyCredits: 30, yearlyCredits: 360 },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🎯 GrooveSell Webhook Received:', {
      event: body.event,
      email: body.buyer_email,
      productId: body.product_id,
      productName: body.product_name,
      subscriptionType: body.subscription_type,
      amount: body.amount,
      trialTransaction: body.trial_transaction
    })

    const { 
      event,
      buyer_email: email,
      product_id: productId,
      product_name: productName,
      subscription_type: subscriptionType,
      amount,
      trial_transaction: isTrialTransaction,
      password,
      confirm_password: confirmPassword
    } = body

    if (!email || !productId) {
      console.error('❌ Missing required fields:', { email, productId })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get product tier configuration
    const productConfig = PRODUCT_TIER_MAPPING[productId]
    if (!productConfig) {
      console.error('❌ Unknown product ID:', productId)
      return NextResponse.json({ error: `Unknown product ID: ${productId}` }, { status: 400 })
    }

    console.log('📦 Product Config:', productConfig)

    // Only process subscription-trial-start events for trials
    if (event === 'subscription-trial-start' && isTrialTransaction === 1) {
      console.log('🆕 Processing trial start for new user')
      
      // Create user in auth system if they don't exist
      let authUserId: string | null = null
      try {
        authUserId = await signUpUser(email, password)
        console.log('🔐 Auth user ID:', authUserId)
      } catch (error) {
        console.error('⚠️ Error creating auth user:', error)
        // Continue anyway - we can still create the user record
      }

      // Add trial credits and set subscription tier
      const updatedUser = await addCredits(
        email, 
        TRIAL_CREDITS, 
        undefined, // Don't set subscription_type for trial
        authUserId || undefined
      )

      // Now update the subscription tier
      if (updatedUser) {
        try {
          const { supabaseAdmin } = await import('@/lib/supabase')
          if (supabaseAdmin) {
            await supabaseAdmin
              .from('users')
              .update({ 
                subscription_tier: productConfig.tier,
                updated_at: new Date().toISOString()
              })
              .eq('id', updatedUser.id)
            
            console.log('🎯 Updated subscription tier:', productConfig.tier)
          }
        } catch (error) {
          console.error('⚠️ Error updating subscription tier:', error)
        }
      }

      console.log('✅ Trial setup complete:', {
        email,
        credits: TRIAL_CREDITS,
        tier: productConfig.tier,
        userId: updatedUser.id
      })

      return NextResponse.json({
        success: true,
        message: `Trial started: ${TRIAL_CREDITS} credits added`,
        user: {
          email: updatedUser.email,
          credits: updatedUser.credits,
          subscription_tier: productConfig.tier
        }
      })
    }

    // Handle subscription payments (after trial converts)
    else if (event === 'subscription-payment' && parseFloat(amount || '0') > 0) {
      console.log('💳 Processing subscription payment')

      // Determine credits based on subscription type
      const creditsToAdd = subscriptionType === 'Yearly' 
        ? productConfig.yearlyCredits 
        : productConfig.monthlyCredits

      const subscriptionTypeForDb: 'monthly' | 'yearly' = subscriptionType === 'Yearly' ? 'yearly' : 'monthly'

      const updatedUser = await addCredits(
        email,
        creditsToAdd,
        subscriptionTypeForDb
      )

      // Update subscription tier if needed
      try {
        const { supabaseAdmin } = await import('@/lib/supabase')
        if (supabaseAdmin) {
          await supabaseAdmin
            .from('users')
            .update({ 
              subscription_tier: productConfig.tier,
              updated_at: new Date().toISOString()
            })
            .eq('id', updatedUser.id)
        }
      } catch (error) {
        console.error('⚠️ Error updating subscription tier:', error)
      }

      console.log('✅ Subscription payment processed:', {
        email,
        credits: creditsToAdd,
        tier: productConfig.tier,
        subscriptionType: subscriptionTypeForDb
      })

      return NextResponse.json({
        success: true,
        message: `Subscription payment: ${creditsToAdd} credits added`,
        user: {
          email: updatedUser.email,
          credits: updatedUser.credits,
          subscription_tier: productConfig.tier,
          subscription_type: subscriptionTypeForDb
        }
      })
    }

    // Ignore other events
    else {
      console.log('ℹ️ Event ignored:', event, 'Amount:', amount, 'Trial:', isTrialTransaction)
      return NextResponse.json({
        success: true,
        message: `Event '${event}' acknowledged but not processed`
      })
    }

  } catch (error: unknown) {
    console.error('💥 GrooveSell webhook error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    
    // Always return success to prevent GrooveSell retries
    return NextResponse.json({ 
      success: true,
      message: 'Webhook received (error in processing)',
      error: errorMessage 
    })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'GrooveSell Webhook Endpoint',
    status: 'active',
    supportedEvents: [
      'subscription-trial-start',
      'subscription-payment'
    ],
    productMapping: PRODUCT_TIER_MAPPING
  })
}
