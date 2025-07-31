# Credit System Setup Guide

This guide explains how to implement the credit-based authentication system for your Personalized Coloring Page Generator. The system has been designed to be **safe and non-intrusive** to your existing image generation functionality.

## 🛡️ Safety Features Built-In

- **Fail-Open Approach**: If the credit system fails, image generation will still work
- **Minimal Code Changes**: Only a few integration points that can be easily disabled
- **Isolated Components**: All credit logic is in separate files
- **Database Errors Don't Break Generation**: Credit checks default to allowing access if there's an error

## 📋 Setup Steps

### 1. Supabase Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-setup.sql`
4. Run the script to create tables and policies

### 2. Environment Variables

1. Copy your existing `.env.local` file (if you have one)
2. Add these new environment variables:

```bash
# Add these to your .env.local file
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under "API".

### 3. Test the System

**Important**: Users don't sign up directly in the app. They sign up through your GrooveFunnels page.

For testing:
1. Start your development server: `npm run dev`
2. Go to `http://localhost:3000`
3. You'll see a "Sign In" button - users can only sign in if they already have an account
4. For testing, you'll need to manually create a test user in Supabase and add credits via the API

### 4. Verify Image Generation Still Works

The most important test is to ensure your existing functionality works:

1. Generate a coloring page with the test account
2. Check that the image generation process completes normally
3. Verify that credits are decremented after successful generation

## 🔧 Integration with GrooveFunnels

Your GrooveFunnels page handles all signups and payments. Use these API endpoints with webhooks:

### API Endpoints for Credit Management

**1. Start Free Trial (when user signs up on GrooveFunnels):**
```bash
POST /api/credits
Content-Type: application/json

{
  "email": "customer@example.com",
  "subscription_type": "trial",
  "action": "add_credits"
}
```
This gives the user 3 credits for their 1-week trial.

**2. Convert to Paid Subscription (after trial ends and payment processes):**
```bash
POST /api/credits
Content-Type: application/json

{
  "email": "customer@example.com",
  "subscription_type": "monthly", // or "yearly"
  "action": "add_credits"
}
```
This gives:
- 5 credits for monthly subscription 
- 60 credits for yearly subscription (5 per month × 12 months)
- Updates their subscription status and expiration date

### GrooveFunnels Webhook Setup

Set up webhooks in GrooveFunnels for:
1. **Trial Start** → Call API with `"subscription_type": "trial"`
2. **Payment Success** → Call API with `"subscription_type": "monthly"` or `"yearly"`
3. **Recurring Payment** → Call API to add monthly credits

## 🚨 Emergency Rollback Plan

If something goes wrong, you can quickly disable the credit system:

### Quick Disable Method

In `src/app/page.tsx`, comment out these lines:

```typescript
// Comment out these lines to disable credit checking:
/*
// Check if user is authenticated
if (!user) {
    setError('Please sign in to generate images.');
    setIsLoading(false);
    return;
}

// Check if user has enough credits
if (user.credits < 1) {
    setError('You have no credits remaining. Please purchase more credits to continue.');
    setIsLoading(false);
    return;
}
*/
```

And comment out the credit decrementing:

```typescript
// Comment out this section to disable credit decrementing:
/*
// Decrease user credits in database
try {
    await useCredits(user.email, 1);
    await refreshCredits(); // Refresh the user data to show updated credits
} catch (creditError) {
    console.error('Error updating credits:', creditError);
    // Don't fail the whole operation if credit update fails
}
*/
```

This will restore the app to its original functionality.

## 🔍 Testing Checklist

Before going live, test these scenarios:

- [ ] API endpoints work for adding trial credits (3)
- [ ] API endpoints work for adding monthly credits (5)
- [ ] API endpoints work for adding yearly credits (60)
- [ ] Sign in works for users created via GrooveFunnels
- [ ] Credit balance displays correctly
- [ ] Image generation works when user has credits
- [ ] Image generation is blocked when user has 0 credits
- [ ] Credits are decremented after successful generation
- [ ] Error messages direct users to GrooveFunnels appropriately
- [ ] Existing password functionality still works (if applicable)
- [ ] Image generation still works if Supabase is down (fail-open)

## 📊 User Flow

1. **User Discovery**: User finds your GrooveFunnels landing page
2. **Trial Signup**: User signs up on GrooveFunnels → Gets 1-week trial → Webhook adds 3 credits
3. **App Access**: User gets login credentials → Signs into your app → Sees 3 credits
4. **Trial Usage**: User generates up to 3 coloring pages during trial week
5. **Auto-Conversion**: After 1 week, GrooveFunnels auto-charges → Webhook adds 5 monthly credits
6. **Ongoing Use**: User gets 5 new credits each month → Generates images → Credits decrement
7. **No Credits**: User sees message directing them back to GrooveFunnels to manage subscription
8. **Subscription Management**: All billing, cancellations, etc. handled by GrooveFunnels

## 🛠️ Customization Options

### Change Trial Credits
Edit `TRIAL_CREDITS` in `src/lib/credit-utils.ts` (currently 3)

### Change Subscription Credits
Edit `MONTHLY_CREDITS` and `YEARLY_CREDITS` in `src/lib/credit-utils.ts` (currently 5 and 60)

### Update GrooveFunnels Link
Edit the link in `src/components/auth-dialog.tsx` to point to your actual GrooveFunnels page

### Modify UI
The authentication dialog is in `src/components/auth-dialog.tsx`

## 📈 Analytics & Monitoring

The system logs all credit transactions in the `credit_transactions` table, so you can track:
- User registration patterns
- Credit usage patterns
- Revenue from subscriptions
- Popular features

## 🔒 Security Features

- Row Level Security (RLS) ensures users can only see their own data
- Passwords are handled by Supabase authentication
- Credit transactions are logged for audit trail
- API endpoints validate user permissions

## 💡 Tips for Success

1. **Test Thoroughly**: Test the entire flow before going live
2. **Monitor Logs**: Check server logs for any credit-related errors
3. **Have a Rollback Plan**: Keep the emergency disable method handy
4. **Communicate Changes**: Let existing users know about the new system
5. **Offer Transition Credits**: Consider giving existing users bonus credits

## 🆘 Troubleshooting

### Common Issues

**"Please sign in to generate images" even when signed in**
- Check that Supabase environment variables are set correctly
- Verify the user is actually authenticated in the browser dev tools

**Credits not decrementing**
- Check the browser console for errors
- Verify the `/api/credits` endpoint is working
- Check Supabase logs for database errors

**Image generation stopped working**
- The system is designed to fail-open, so this shouldn't happen
- Check that the original image generation API is still functional
- Verify no changes were made to the core generation logic

## 📞 Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the server logs
3. Test the individual components (auth, credits, image generation) separately
4. Use the rollback method if needed

The system has been designed with safety as the top priority - your existing image generation functionality should continue to work even if there are issues with the credit system.
