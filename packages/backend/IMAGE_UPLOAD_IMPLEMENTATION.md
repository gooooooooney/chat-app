# Image Upload Implementation with R2

## Overview
This document describes the image upload implementation following the `@convex-dev/r2` pattern for React Native.

## Architecture

### Data Flow
```
React Native App → useImageUpload Hook → R2 Upload → Convex Database → Real-time Sync
```

### Components

#### 1. Frontend Hook: `apps/native/hooks/useImageUpload.ts`
Handles the complete image upload flow with optimistic updates:

**Steps:**
1. Creates optimistic UI update (shows uploading state)
2. Converts React Native URI to Blob
3. Calls `uploadFile(blob)` from `@convex-dev/r2/react` → returns `imageKey`
   - Internally handles: generateUploadUrl + upload + syncMetadata
4. Calls `api.v1.messages.sendMessage()` to create message with imageKey
5. On success: removes optimistic update, invalidates queries

**Key Features:**
- ✅ Uses official `useUploadFile` hook from `@convex-dev/r2/react`
- ✅ Optimistic updates for instant UI feedback
- ✅ Proper error handling with failed state display
- ✅ Automatic cleanup of failed uploads after 5 seconds
- ✅ Works with React Native URIs (converts to Blob)

#### 2. Backend R2 Configuration: `packages/backend/convex/r2.ts`
Configures R2 component with proper callbacks:

**Callbacks:**
- `checkUpload`: Validates user permissions (testing mode allows anonymous)
- `onUpload`: Creates record in `images` table after successful upload
- `checkDelete`: Verifies user owns the image before deletion
- `onDelete`: Cleans up database records and updates affected messages

**Exported Functions:**
- `generateUploadUrl()`: Generates presigned upload URL with UUID key
- `syncMetadata()`: Finalizes upload and triggers onUpload callback
- `deleteObject()`: Deletes file from R2 and database
- `listImages()`: Lists all images with URLs

#### 3. Message Mutations: `packages/backend/convex/v1/messages.ts`
Extended to support image messages:

**sendMessage Mutation:**
- Accepts `imageKey`, `imageMetadata`, and `uploadStatus` parameters
- Validates imageKey is present for image-type messages
- Creates message record with image data
- Updates `images` table to link image with messageId
- Updates conversation last message preview

**getConversationMessages Query:**
- Dynamically generates `imageUrl` for messages with imageKey using `r2.getUrl()`
- Returns messages with embedded image URLs (presigned, valid for 15 minutes by default)
- No imageUrl stored in database - always fresh and secure

### 4. Database Schema: `packages/backend/convex/schema.ts`

**images Table:**
```typescript
{
  bucket: string,           // R2 bucket name
  key: string,              // R2 object key (UUID)
  uploadedBy?: string,      // User ID
  messageId?: Id<"messages">, // Associated message
  metadata?: {              // Optional image metadata
    width?: number,
    height?: number,
    size: number,
    mimeType: string
  },
  caption?: string          // Optional caption
}
```

**messages Table (Image Fields):**
```typescript
{
  // ... other fields
  imageKey?: string,        // R2 storage key
  imageMetadata?: {         // Cached metadata
    width: number,
    height: number,
    size: number,
    mimeType: string
  },
  uploadStatus?: "uploading" | "completed" | "failed"
}
```

## Usage Example

```typescript
import { useImageUpload } from '@/hooks/useImageUpload';

function ChatScreen() {
  const uploadImage = useImageUpload();

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];

      uploadImage.mutate({
        conversationId: currentConversation._id,
        senderId: currentUser.id,
        imageUri: asset.uri,
        fileName: asset.fileName || 'image.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
        width: asset.width,
        height: asset.height,
        size: asset.fileSize,
      });
    }
  };

  return (
    <View>
      <Button onPress={handleImagePick}>Upload Image</Button>
      {uploadImage.isPending && <Text>Uploading...</Text>}
    </View>
  );
}
```

## Key Differences from Web Implementation

### Web (`useUploadFile` hook):
```typescript
const uploadFile = useUploadFile(api.example);
const key = await uploadFile(file); // File object from input
```

### React Native (Uses same `useUploadFile` hook):
```typescript
// Internal implementation
const uploadFile = useUploadFile(api.r2);

// Convert React Native URI to Blob
const response = await fetch(imageUri);
const blob = await response.blob();

// Upload using official hook
const imageKey = await uploadFile(blob);
```

**Key Points:**
- ✅ Uses official `@convex-dev/r2/react` package (works with React Native)
- ✅ Converts React Native URIs to Blobs before upload
- ✅ Hook handles generateUploadUrl + upload + syncMetadata automatically
- ✅ Additional message creation logic wrapped in custom `useImageUpload` hook
- ✅ Optimistic updates for better UX

## Security Considerations

1. **Authentication:** checkUpload callback validates user (currently in testing mode)
2. **Authorization:** Users can only delete their own images
3. **URL Expiration:** Generated image URLs expire after 15 minutes (configurable)
4. **No Direct Storage:** Image URLs never stored in database, always generated fresh
5. **Metadata Validation:** File types and sizes can be validated in callbacks

## Testing

Run comprehensive R2 tests:
```bash
npx convex run v1/testR2Complete:runAllTests
```

Tests cover:
- ✅ Upload flow (generate URL → upload → sync metadata)
- ✅ List images
- ✅ Metadata validation
- ✅ Caption updates
- ✅ Cleanup (delete images)

## Future Improvements

1. **Image Optimization:**
   - Generate thumbnails on upload
   - Compress images before upload
   - Support multiple sizes

2. **Progress Tracking:**
   - Add upload progress percentage
   - Show network speed

3. **Offline Support:**
   - Queue uploads when offline
   - Retry failed uploads automatically

4. **Enhanced Features:**
   - Image editing before upload
   - Multiple image uploads
   - Image galleries

## References

- [Convex R2 Documentation](https://github.com/get-convex/r2)
- [R2 Configuration Guide](./R2_CONFIG_FIX.md)
- [R2 Troubleshooting Guide](./R2_403_TROUBLESHOOTING.md)
