# Storage RLS Policies Setup Guide

## The Problem
You're getting "new row violates row-level security policy" because the storage bucket needs proper RLS policies to allow authenticated users to upload files.

## ✅ Step-by-Step Fix (Takes 2 minutes)

### 1. Go to Supabase Dashboard
- Open: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist
- Click **"Storage"** in the left sidebar

### 2. Click on "Policies" Tab
- Find the **master-portfolios** bucket
- Click **"New Policy"**

### 3. Create These 4 Policies:

#### Policy 1: Allow Uploads (INSERT)
```
Name: Allow authenticated uploads
Allowed operation: INSERT
Target roles: authenticated
Policy definition: bucket_id = 'master-portfolios'
```

#### Policy 2: Allow Viewing (SELECT) - Authenticated
```
Name: Allow authenticated viewing
Allowed operation: SELECT
Target roles: authenticated
Policy definition: bucket_id = 'master-portfolios'
```

#### Policy 3: Allow Viewing (SELECT) - Public
```
Name: Allow public viewing
Allowed operation: SELECT
Target roles: anon
Policy definition: bucket_id = 'master-portfolios'
```

#### Policy 4: Allow Deletion (DELETE)
```
Name: Allow authenticated deletion
Allowed operation: DELETE
Target roles: authenticated
Policy definition: bucket_id = 'master-portfolios'
```

### 4. Alternative: Use the "Quick Policy" Templates
If you see templates, use:
- **"Give users access to only their own top level folder"** 
- Then modify it to: `bucket_id = 'master-portfolios'`

### 5. Verify
After creating all 4 policies, you should see them listed under the master-portfolios bucket.

---

## Testing After Fix

1. Restart the app (to refresh the session)
2. Go to "Apply as Master"
3. Fill out all 4 steps
4. Select portfolio images on Step 4
5. Submit application
6. Images should upload successfully now!

---

## What These Policies Do

- **INSERT**: Allows authenticated users to upload new files
- **SELECT**: Allows viewing files (both authenticated and public users)
- **DELETE**: Allows authenticated users to delete their files

The `bucket_id = 'master-portfolios'` condition ensures these policies only apply to the master-portfolios bucket.

---

## Already Done For You ✅

- ✅ Deleted the existing application for daxyburn@gmail.com
- ✅ Fixed the FileSystem import (using legacy API)
- ⏳ Waiting for you to create the storage policies

**Create those 4 policies and image uploads will work!** 🚀
