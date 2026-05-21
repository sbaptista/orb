-- Push notification subscriptions for Web Push API
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth   text NOT NULL,
  user_agent  text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY "push_subscriptions: select own" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Users can create their own subscriptions
CREATE POLICY "push_subscriptions: insert own" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can delete their own subscriptions (unsubscribe)
CREATE POLICY "push_subscriptions: delete own" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- Index for looking up all subscriptions for a user (push sending)
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
