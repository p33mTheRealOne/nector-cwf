BEGIN;

-- =========================================================
-- 0) EXTENSIONS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =========================================================
-- 1) TABLE: profiles
-- =========================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  wallet_address text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT profiles_bio_length_check
    CHECK (char_length(bio) <= 160)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 2) TABLE: usernames
-- =========================================================

CREATE TABLE IF NOT EXISTS public.usernames (
  user_id uuid NOT NULL,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usernames_pkey PRIMARY KEY (user_id),

  CONSTRAINT usernames_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT usernames_username_unique
    UNIQUE (username),

  CONSTRAINT usernames_username_length_check
    CHECK (
      char_length(username) >= 3
      AND char_length(username) <= 32
    )
);

ALTER TABLE public.usernames ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 3) TABLE: contacts
-- =========================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  owner_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contacts_pkey
    PRIMARY KEY (owner_id, contact_id),

  CONSTRAINT contacts_owner_id_fkey
    FOREIGN KEY (owner_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT contacts_contact_id_fkey
    FOREIGN KEY (contact_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT contacts_not_self_check
    CHECK (owner_id <> contact_id)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 4) TABLE: messages
-- =========================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  body text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT messages_pkey
    PRIMARY KEY (id),

  CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT messages_receiver_id_fkey
    FOREIGN KEY (receiver_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT messages_type_check
    CHECK (
      message_type IN (
        'text',
        'escrow',
        'escrow_update'
      )
    ),

  CONSTRAINT messages_not_self_check
    CHECK (sender_id <> receiver_id)
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 5) TABLE: escrow_orders
-- =========================================================

CREATE TABLE IF NOT EXISTS public.escrow_orders (
  escrow_pda text NOT NULL,

  tx_signature text,

  conversation_id text NOT NULL,

  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,

  seller_name text,
  buyer_name text,

  seller_wallet text,
  buyer_wallet text,

  type text NOT NULL,

  dispute_mode text,

  description text,

  price_usd numeric,

  order_name text,
  order_index text,

  nft_mint text,
  image_path text,

  status text NOT NULL DEFAULT 'onchain_created',

  ship_date date,
  ship_time_hours text,
  shipping_deadline bigint,

  funded_tx text,

  seller_funded_tx text,
  seller_funded_at_unix bigint,

  shipped_tx text,
  shipped_at_unix bigint,

  confirm_tx text,

  refund_tx text,
  seller_refund_tx text,

  dispute_tx text,
  dispute_opened_at_unix bigint,

  seller_respond_tx text,
  seller_responded_at_unix bigint,

  pay_seller_tx text,

  delivery_file_path text,
  delivery_file_name text,
  delivery_file_size bigint,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT escrow_orders_pkey
    PRIMARY KEY (escrow_pda),

  CONSTRAINT escrow_orders_seller_id_fkey
    FOREIGN KEY (seller_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT escrow_orders_buyer_id_fkey
    FOREIGN KEY (buyer_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT escrow_orders_type_check
    CHECK (
      type IN (
        'physical',
        'digital',
        'nft'
      )
    ),

  CONSTRAINT escrow_orders_dispute_mode_check
    CHECK (
      dispute_mode IS NULL
      OR dispute_mode IN (
        'BTR',
        'STR'
      )
    ),

  CONSTRAINT escrow_orders_status_check
    CHECK (
      status IN (
        'onchain_created',
        'BuyerFunded',
        'Shipping',
        'Shipped',
        'Completed',
        'Cancelled',
        'Dispute',
        'Discuss'
      )
    ),

  CONSTRAINT escrow_orders_nft_mint_check
    CHECK (
      type = 'nft'
      OR nft_mint IS NULL
    )
);

ALTER TABLE public.escrow_orders ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 6) TABLE: feedbacks
-- AppHome.tsx ใช้งานตารางนี้ด้วย
-- =========================================================

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feedbacks_pkey
    PRIMARY KEY (id),

  CONSTRAINT feedbacks_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT feedbacks_type_check
    CHECK (
      type IN (
        'Bug',
        'Idea',
        'Other'
      )
    )
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 7) INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_contacts_owner
  ON public.contacts(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_contact
  ON public.contacts(contact_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
  ON public.messages(receiver_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_receiver
  ON public.messages(receiver_id);

CREATE INDEX IF NOT EXISTS idx_escrow_orders_conversation
  ON public.escrow_orders(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escrow_orders_seller
  ON public.escrow_orders(seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escrow_orders_buyer
  ON public.escrow_orders(buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escrow_orders_nft_mint
  ON public.escrow_orders(nft_mint);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user
  ON public.feedbacks(user_id, created_at DESC);


-- =========================================================
-- IMPORTANT:
-- Allow same NFT mint to be listed again after old listing
-- becomes Cancelled / Completed.
--
-- Only one ACTIVE NFT listing per seller + mint.
-- Cancelled and Completed rows do NOT block relisting.
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  escrow_orders_one_active_nft_per_seller_mint
ON public.escrow_orders (
  seller_id,
  nft_mint
)
WHERE
  type = 'nft'
  AND nft_mint IS NOT NULL
  AND status = 'onchain_created';


-- =========================================================
-- 8) PROFILES RLS
-- =========================================================

DROP POLICY IF EXISTS profiles_insert_own
  ON public.profiles;

DROP POLICY IF EXISTS profiles_select_authenticated
  ON public.profiles;

DROP POLICY IF EXISTS profiles_update_own
  ON public.profiles;

CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
);

CREATE POLICY profiles_select_authenticated
ON public.profiles
FOR SELECT
TO authenticated
USING (
  true
);

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);


-- =========================================================
-- 9) USERNAMES RLS
-- =========================================================

DROP POLICY IF EXISTS usernames_insert_own
  ON public.usernames;

DROP POLICY IF EXISTS usernames_select_authenticated
  ON public.usernames;

DROP POLICY IF EXISTS usernames_update_own
  ON public.usernames;

CREATE POLICY usernames_insert_own
ON public.usernames
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY usernames_select_authenticated
ON public.usernames
FOR SELECT
TO authenticated
USING (
  true
);

CREATE POLICY usernames_update_own
ON public.usernames
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);


-- =========================================================
-- 10) CONTACTS RLS
-- =========================================================

DROP POLICY IF EXISTS contacts_delete_own
  ON public.contacts;

DROP POLICY IF EXISTS contacts_insert_own
  ON public.contacts;

DROP POLICY IF EXISTS contacts_select_own
  ON public.contacts;

CREATE POLICY contacts_delete_own
ON public.contacts
FOR DELETE
TO authenticated
USING (
  auth.uid() = owner_id
);

CREATE POLICY contacts_insert_own
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
);

CREATE POLICY contacts_select_own
ON public.contacts
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
);


-- =========================================================
-- 11) MESSAGES RLS
-- =========================================================

DROP POLICY IF EXISTS messages_insert_as_sender
  ON public.messages;

DROP POLICY IF EXISTS messages_select_participant
  ON public.messages;

DROP POLICY IF EXISTS messages_update_as_receiver
  ON public.messages;

CREATE POLICY messages_insert_as_sender
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> receiver_id
);

CREATE POLICY messages_select_participant
ON public.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id
  OR auth.uid() = receiver_id
);

CREATE POLICY messages_update_as_receiver
ON public.messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() = receiver_id
)
WITH CHECK (
  auth.uid() = receiver_id
);


-- =========================================================
-- 12) ESCROW ORDERS RLS
-- =========================================================

DROP POLICY IF EXISTS escrow_orders_insert_as_seller
  ON public.escrow_orders;

DROP POLICY IF EXISTS escrow_orders_select_participant
  ON public.escrow_orders;

DROP POLICY IF EXISTS escrow_orders_update_participant
  ON public.escrow_orders;

CREATE POLICY escrow_orders_insert_as_seller
ON public.escrow_orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = seller_id
);

CREATE POLICY escrow_orders_select_participant
ON public.escrow_orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = seller_id
  OR auth.uid() = buyer_id
);

CREATE POLICY escrow_orders_update_participant
ON public.escrow_orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = seller_id
  OR auth.uid() = buyer_id
)
WITH CHECK (
  auth.uid() = seller_id
  OR auth.uid() = buyer_id
);


-- =========================================================
-- 13) FEEDBACKS RLS
-- AppHome.tsx INSERT feedback
-- =========================================================

DROP POLICY IF EXISTS feedbacks_insert_own
  ON public.feedbacks;

CREATE POLICY feedbacks_insert_own
ON public.feedbacks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);


-- =========================================================
-- 14) PROFILE updated_at TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at
ON public.profiles;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profiles_updated_at();


-- =========================================================
-- 15) STORAGE BUCKET: profiles
-- Public
-- 5 MB
-- jpeg/png/webp
-- =========================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'profiles',
  'profiles',
  true,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =========================================================
-- 16) STORAGE BUCKET: chat-images
-- Private
-- 10 MB
-- jpeg/png/webp
-- =========================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'chat-images',
  'chat-images',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =========================================================
-- 17) STORAGE BUCKET: chat-voice
-- Private
-- 20 MB
-- =========================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'chat-voice',
  'chat-voice',
  false,
  20971520,
  ARRAY[
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/m4a',
    'audio/mpeg'
  ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =========================================================
-- 18) STORAGE BUCKET: escrow
-- Private
-- 10 MB
-- jpeg/png/webp
-- =========================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'escrow',
  'escrow',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =========================================================
-- 19) STORAGE BUCKET: digital-delivery
-- Private
-- 100 MB
-- Any MIME type
-- =========================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'digital-delivery',
  'digital-delivery',
  false,
  104857600,
  NULL
)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =========================================================
-- 20) STORAGE RLS: profiles
--
-- AppHome path:
-- `${userId}.jpg`
-- =========================================================

DROP POLICY IF EXISTS profiles_bucket_public_read
ON storage.objects;

DROP POLICY IF EXISTS profiles_bucket_owner_insert
ON storage.objects;

DROP POLICY IF EXISTS profiles_bucket_owner_update
ON storage.objects;

DROP POLICY IF EXISTS profiles_bucket_owner_delete
ON storage.objects;

CREATE POLICY profiles_bucket_public_read
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'profiles'
);

CREATE POLICY profiles_bucket_owner_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND name = auth.uid()::text || '.jpg'
);

CREATE POLICY profiles_bucket_owner_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND name = auth.uid()::text || '.jpg'
)
WITH CHECK (
  bucket_id = 'profiles'
  AND name = auth.uid()::text || '.jpg'
);

CREATE POLICY profiles_bucket_owner_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND name = auth.uid()::text || '.jpg'
);


-- =========================================================
-- 21) STORAGE RLS: chat-images
--
-- AppHome path:
-- `${conversationId}/${timestamp}_${uuid}.jpg`
--
-- conversationId = [userA, userB].sort().join('__')
-- =========================================================

DROP POLICY IF EXISTS chat_images_participant_select
ON storage.objects;

DROP POLICY IF EXISTS chat_images_participant_insert
ON storage.objects;

CREATE POLICY chat_images_participant_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    split_part(name, '/', 1) = auth.uid()::text
    OR
    split_part(name, '/', 1) LIKE auth.uid()::text || '__%'
    OR
    split_part(name, '/', 1) LIKE '%__' || auth.uid()::text
  )
);

CREATE POLICY chat_images_participant_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (
    split_part(name, '/', 1) = auth.uid()::text
    OR
    split_part(name, '/', 1) LIKE auth.uid()::text || '__%'
    OR
    split_part(name, '/', 1) LIKE '%__' || auth.uid()::text
  )
);


-- =========================================================
-- 22) STORAGE RLS: chat-voice
-- Same conversation path structure
-- =========================================================

DROP POLICY IF EXISTS chat_voice_participant_select
ON storage.objects;

DROP POLICY IF EXISTS chat_voice_participant_insert
ON storage.objects;

CREATE POLICY chat_voice_participant_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-voice'
  AND (
    split_part(name, '/', 1) = auth.uid()::text
    OR
    split_part(name, '/', 1) LIKE auth.uid()::text || '__%'
    OR
    split_part(name, '/', 1) LIKE '%__' || auth.uid()::text
  )
);

CREATE POLICY chat_voice_participant_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-voice'
  AND (
    split_part(name, '/', 1) = auth.uid()::text
    OR
    split_part(name, '/', 1) LIKE auth.uid()::text || '__%'
    OR
    split_part(name, '/', 1) LIKE '%__' || auth.uid()::text
  )
);


-- =========================================================
-- 23) STORAGE RLS: escrow
--
-- AppHome path:
-- `${sellerId}/${escrowPda}.jpg`
--
-- Upload happens BEFORE escrow_orders INSERT,
-- therefore INSERT must be validated by sellerId path.
-- =========================================================

DROP POLICY IF EXISTS escrow_bucket_seller_insert
ON storage.objects;

DROP POLICY IF EXISTS escrow_bucket_participant_select
ON storage.objects;

DROP POLICY IF EXISTS escrow_bucket_seller_update
ON storage.objects;

DROP POLICY IF EXISTS escrow_bucket_seller_delete
ON storage.objects;

CREATE POLICY escrow_bucket_seller_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'escrow'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY escrow_bucket_participant_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'escrow'
  AND EXISTS (
    SELECT 1
    FROM public.escrow_orders eo
    WHERE eo.escrow_pda = split_part(name, '/', 2)
      AND (
        eo.seller_id = auth.uid()
        OR eo.buyer_id = auth.uid()
      )
  )
);

CREATE POLICY escrow_bucket_seller_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'escrow'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'escrow'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY escrow_bucket_seller_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'escrow'
  AND split_part(name, '/', 1) = auth.uid()::text
);


-- =========================================================
-- 24) STORAGE RLS: digital-delivery
--
-- AppHome path:
-- `${escrowPda}/${timestamp}_${safeName}`
-- =========================================================

DROP POLICY IF EXISTS digital_delivery_seller_insert
ON storage.objects;

DROP POLICY IF EXISTS digital_delivery_participant_select
ON storage.objects;

CREATE POLICY digital_delivery_seller_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'digital-delivery'
  AND EXISTS (
    SELECT 1
    FROM public.escrow_orders eo
    WHERE eo.escrow_pda = split_part(name, '/', 1)
      AND eo.seller_id = auth.uid()
  )
);

CREATE POLICY digital_delivery_participant_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'digital-delivery'
  AND EXISTS (
    SELECT 1
    FROM public.escrow_orders eo
    WHERE eo.escrow_pda = split_part(name, '/', 1)
      AND (
        eo.seller_id = auth.uid()
        OR eo.buyer_id = auth.uid()
      )
  )
);


-- =========================================================
-- 25) REALTIME
-- messages + escrow_orders
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'escrow_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.escrow_orders;
  END IF;
END
$$;


-- =========================================================
-- 26) AUTH NONCES (Sign In With Solana)
--
-- One row per wallet login attempt.
-- The server creates the row, the wallet signs the stored
-- message, and the row can be used only once before it expires.
--
-- No policies on purpose: only the service role (server
-- API routes) can read or write this table.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.auth_nonces (
  nonce text NOT NULL,
  wallet text NOT NULL,
  domain text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT auth_nonces_pkey PRIMARY KEY (nonce)
);

ALTER TABLE public.auth_nonces ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_nonces FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet
  ON public.auth_nonces(wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires
  ON public.auth_nonces(expires_at);


COMMIT;
