-- Supabase Database Setup Script
-- Run this in your Supabase SQL Editor to create the necessary tables

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    credits INTEGER DEFAULT 0 NOT NULL,
    subscription_type TEXT CHECK (subscription_type IN ('monthly', 'yearly')) NULL,
    subscription_expires_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create credit_transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT CHECK (transaction_type IN ('purchase', 'usage', 'refund')) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);

-- Enable Row Level Security on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can read their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Users can update their own data (credits will be managed server-side)
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.jwt() ->> 'email' = email);

-- Service role (your app) can do everything
CREATE POLICY "Service role can manage users" ON public.users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow anon users to insert (for registration)
CREATE POLICY "Allow registration" ON public.users
    FOR INSERT WITH CHECK (true);

-- RLS Policies for credit_transactions table
-- Users can read their own transactions
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Only service role can insert/update transactions
CREATE POLICY "Service role can manage transactions" ON public.credit_transactions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT ON public.credit_transactions TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert a test user (optional - remove this if you don't want test data)
-- INSERT INTO public.users (email, credits) VALUES ('test@example.com', 0);

-- Verification queries (run these to check if setup worked)
-- SELECT * FROM public.users LIMIT 5;
-- SELECT * FROM public.credit_transactions LIMIT 5;
