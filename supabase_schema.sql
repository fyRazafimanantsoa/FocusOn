-- Supabase Database Schema for FocusOn
-- Paste this script into your Supabase SQL Editor to provision the tables.

-- 1. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    adhd_mode BOOLEAN DEFAULT TRUE,
    weekly_goal_minutes INTEGER DEFAULT 150,
    theme VARCHAR(50) DEFAULT 'dark'
);

-- 2. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL, -- Color hex code e.g., #3B82F6
    is_archived BOOLEAN DEFAULT FALSE,
    custom_duration INTEGER,
    weekly_goal_hours INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Focus Sessions Table
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    tiny_step TEXT,
    original_duration_minutes INTEGER NOT NULL,
    actual_duration_seconds INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL, -- 'completed', 'interrupted', 'active'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    date_str VARCHAR(10) NOT NULL, -- 'YYYY-MM-DD'
    reflection_notes TEXT,
    next_step_suggested TEXT,
    stuck_count INTEGER DEFAULT 0,
    distraction_check_in_count INTEGER DEFAULT 0,
    project_id VARCHAR(255)
);

-- 4. Create Distraction Logs (Sudden Notes) Table
CREATE TABLE IF NOT EXISTS public.distraction_logs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    activity TEXT NOT NULL,
    choice VARCHAR(50) NOT NULL, -- 'learning', 'break', 'resume'
    notes TEXT
);

-- 5. Create Checkouts / Payment Log Table
CREATE TABLE IF NOT EXISTS public.checkouts (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL, -- e.g., 9.99
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL, -- 'completed', 'pending', 'failed'
    plan_type VARCHAR(100) NOT NULL, -- 'focuson_premium_monthly', 'focuson_premium_annual'
    stripe_session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.focus_sessions(date_str);
CREATE INDEX IF NOT EXISTS idx_distractions_session ON public.distraction_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_user ON public.checkouts(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
